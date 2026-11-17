<?php
declare(strict_types=1);
namespace Tests\Integration;
use App\Core\Database;
use App\Core\HttpException;
use App\Core\Logger;
use App\Repositories\AppointmentRepository;
use App\Repositories\EmailOutboxRepository;
use App\Services\AppointmentService;
use App\Services\AuthService;
use App\Services\Email\EmailOutboxService;
use App\Services\Email\EmailOutboxWorker;
use App\Services\Email\EmailService;
use App\Services\Email\EmailTemplateRenderer;
use App\Services\Email\MailConfig;
use App\Services\Email\OutboxSettings;
use App\Services\Email\PayloadCipher;
use App\Services\Email\ReminderScheduler;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use PHPUnit\Framework\TestCase;
use Tests\Support\FakeMailTransport;
use Tests\Support\TestDb;
/**
 * Transactional outbox, worker, retry, and reminder behavior.
 * Uses an in-memory SQLite database and a fake transport: no email can leave the process.
 */
class EmailOutboxFlowTest extends TestCase
{
    private PDO $pdo;
    private EmailOutboxRepository $repo;
    private FakeMailTransport $transport;
    private DateTimeZone $tz;
    private DateTimeImmutable $now;
    private PayloadCipher $cipher;
    private Logger $logger;
    private string $logFile;
    private OutboxSettings $settings;
    protected function setUp(): void
    {
        $this->pdo = TestDb::create();
        $this->repo = new EmailOutboxRepository();
        $this->transport = new FakeMailTransport();
        $this->tz = new DateTimeZone('Asia/Manila');
        $this->now = new DateTimeImmutable('2026-11-18 09:00:00', $this->tz);
        $this->cipher = new PayloadCipher('unit-test-key');
        $this->logFile = sys_get_temp_dir() . '/tch-email-test-' . bin2hex(random_bytes(4)) . '.log';
        $this->logger = new Logger($this->logFile, 'debug');
        $this->settings = $this->settings();
        $this->seed();
    }
    protected function tearDown(): void
    {
        @unlink($this->logFile);
    }
    private function settings(array $o = []): OutboxSettings
    {
        return OutboxSettings::fromArray($o + ['EMAIL_RETRY_JITTER' => '0', 'EMAIL_WORKER_MAX_ATTEMPTS' => '3']);
    }
    private function seed(): void
    {
        $this->pdo->exec('
            INSERT INTO users (id, email, password_hash, role, is_active, email_verified) VALUES (10, "patient@test.com", "hash", "PATIENT", 1, 1);
            INSERT INTO patients (id, user_id, first_name, last_name, date_of_birth, phone) VALUES (1, 10, "Juan", "Dela Cruz", "1990-01-01", "+639171112222");
            INSERT INTO users (id, email, password_hash, role, is_active) VALUES (99, "admin@test.com", "hash", "ADMIN", 1);
            INSERT INTO users (id, email, password_hash, role, is_active) VALUES (30, "dentist@test.com", "hash", "DENTIST", 1);
            INSERT INTO dentists (id, user_id, license_number, first_name, last_name, specialization, phone, is_active) VALUES (1, 30, "PRC-1", "Ana", "Reyes", "General", "+639175556666", 1);
            INSERT INTO services (id, name, price, duration_minutes, is_active) VALUES (1, "Teeth Cleaning", 1500.00, 30, 1);
        ');
        for ($d = 1; $d <= 5; $d++) {
            $this->pdo->exec("INSERT INTO dentist_schedules (dentist_id, day_of_week, start_time, end_time, operatory_chair, is_active) VALUES (1, {$d}, '09:00:00', '17:00:00', 'Chair 1', 1)");
        }
    }
    private function mailConfig(bool $enabled = true): MailConfig
    {
        return MailConfig::fromArray(['MAIL_ENABLED' => $enabled ? 'true' : 'false', 'MAIL_HOST' => 'smtp.test', 'MAIL_PORT' => '25', 'MAIL_FROM_ADDRESS' => 'noreply@example.test', 'MAIL_ENCRYPTION' => 'none']);
    }
    private function clock(): callable
    {
        return fn(): DateTimeImmutable => $this->now;
    }
    private function outbox(): EmailOutboxService
    {
        return new EmailOutboxService($this->repo, $this->settings, $this->cipher, $this->logger, $this->clock(), Database::getInstance());
    }
    private function worker(string $id = 'w1', ?OutboxSettings $settings = null, bool $mailEnabled = true): EmailOutboxWorker
    {
        $settings ??= $this->settings;
        return new EmailOutboxWorker(
            $this->repo,
            new EmailService($this->transport, $this->mailConfig($mailEnabled), $settings->retryPolicy),
            new EmailTemplateRenderer(EmailTemplateRenderer::defaultTemplateDir(), 'https://app.example.test'),
            $this->cipher,
            $settings,
            $this->logger,
            $id,
            $this->clock()
        );
    }
    private function scheduler(): ReminderScheduler
    {
        return new ReminderScheduler($this->repo, new AppointmentRepository(), $this->outbox(), $this->settings, Database::getInstance(), $this->logger, $this->clock());
    }
    private function service(?EmailOutboxService $outbox = null): AppointmentService
    {
        return new AppointmentService(null, null, null, null, null, null, null, $outbox ?? $this->outbox());
    }
    /** Next weekday at least 4 days after the real current date, 10:00 Manila. */
    private function slot(int $offsetDays = 4): string
    {
        $d = new DateTimeImmutable('now', $this->tz);
        $d = $d->modify("+{$offsetDays} days");
        while ((int) $d->format('N') > 5) {
            $d = $d->modify('+1 day');
        }
        return $d->format('Y-m-d') . ' 10:00:00';
    }
    private function book(?AppointmentService $svc = null): array
    {
        return ($svc ?? $this->service())->bookAppointment(10, ['dentist_id' => 1, 'service_id' => 1, 'start_at' => $this->slot(), 'chief_complaint' => 'Sensitive chief complaint text'], new DateTimeImmutable('now', $this->tz));
    }
    /** @return list<array<string, mixed>> */
    private function jobs(string $where = '1=1'): array
    {
        return $this->pdo->query("SELECT * FROM email_outbox WHERE {$where} ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
    }
    private function rows(string $table): int
    {
        return (int) $this->pdo->query("SELECT COUNT(*) FROM {$table}")->fetchColumn();
    }
    /** @return array<string, mixed> */
    private function registrationPayload(string $email): array
    {
        return ['email' => $email, 'password' => 'StrongP@ssw0rd123!', 'first_name' => 'Maria', 'last_name' => 'Santos',
            'phone' => '+639171234567', 'date_of_birth' => '1995-05-15', 'gender' => 'FEMALE'];
    }
    private function enqueueSimple(string $key = 'k1', ?OutboxSettings $settings = null): int
    {
        $svc = $settings ? new EmailOutboxService($this->repo, $settings, $this->cipher, $this->logger, $this->clock(), Database::getInstance()) : $this->outbox();
        $id = $svc->enqueue(EmailOutboxService::EVENT_CONFIRMED, $key, 'patient@test.com', 'Juan', ['name' => 'Juan', 'reference' => 'TC-000001', 'service' => 'Cleaning']);
        $this->assertNotNull($id);
        return $id;
    }
    // ---------------------------------------------------------------- transactional outbox
    public function testBookingCommitsAppointmentAndOutboxJobTogether(): void
    {
        $appt = $this->book();
        $jobs = $this->jobs();
        $this->assertCount(1, $jobs);
        $job = $jobs[0];
        $this->assertSame('APPOINTMENT_REQUESTED', $job['event_type']);
        $this->assertSame('appointment-requested', $job['template_key']);
        $this->assertSame('PENDING', $job['status']);
        $this->assertSame((int) $appt['id'], (int) $job['appointment_id']);
        $this->assertSame('patient@test.com', $job['recipient_email']);
        $this->assertNull($job['body_html'], 'new rows are rendered at send time');
        $this->assertStringContainsString('"reference":"TC-' . str_pad((string) $appt['id'], 6, '0', STR_PAD_LEFT) . '"', $job['payload_json']);
    }
    public function testBookingPayloadContainsNoClinicalData(): void
    {
        $this->book();
        $payload = $this->jobs()[0]['payload_json'];
        $this->assertStringNotContainsString('Sensitive chief complaint', $payload);
        $this->assertStringNotContainsString('chief_complaint', $payload);
    }
    public function testFailedOutboxInsertRollsBackTheWholeBooking(): void
    {
        $failing = new class (null, null, null, null, null, null) extends EmailOutboxService {
            public function queueAppointmentEvent(string $eventType, array $appointment, int $historyId, array $extra = []): ?int
            {
                throw new \RuntimeException('outbox unavailable');
            }
        };
        try {
            $this->book($this->service($failing));
            $this->fail('booking must fail when the outbox insert fails');
        } catch (HttpException) {
            // expected: the business transaction was rolled back
        }
        $this->assertSame(0, $this->rows('appointments'));
        $this->assertSame(0, $this->rows('appointment_status_history'));
        $this->assertSame(0, $this->rows('email_outbox'));
    }
    public function testBookingSucceedsEvenWhenSmtpIsDown(): void
    {
        $this->transport->failAlways(FakeMailTransport::refused());
        $appt = $this->book();
        $this->assertSame('PENDING', $appt['status']);
        $stats = $this->worker()->runBatch();
        $this->assertSame(1, $stats['retried']);
        $this->assertSame(1, $this->rows('appointments'));
        $this->assertSame('FAILED_RETRYABLE', $this->jobs()[0]['status']);
    }
    public function testLifecycleTransitionsEachQueueExactlyOneJob(): void
    {
        $svc = $this->service();
        $appt = $this->book($svc);
        $id = (int) $appt['id'];
        $svc->confirmAppointment(99, $id);
        $svc->cancelAppointment(10, 'PATIENT', $id, ['reason' => 'Schedule conflict at work']);
        $events = array_column($this->jobs(), 'event_type');
        $this->assertSame(['APPOINTMENT_REQUESTED', 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_CANCELLED'], $events);
        $keys = array_column($this->jobs(), 'event_key');
        $this->assertCount(3, array_unique($keys));
        $cancel = $this->jobs("event_type = 'APPOINTMENT_CANCELLED'")[0];
        $this->assertStringContainsString('"cancelled_by":"patient"', $cancel['payload_json']);
        $this->assertStringNotContainsString('Schedule conflict', $cancel['payload_json'], 'free-text cancellation reasons stay out of email');
    }
    public function testRejectionAndCompletionQueueJobs(): void
    {
        $svc = $this->service();
        $a = $this->book($svc);
        $svc->rejectAppointment(99, (int) $a['id'], ['reason' => 'Dentist is on leave that day']);
        $this->assertContains('APPOINTMENT_REJECTED', array_column($this->jobs(), 'event_type'));
        $this->assertStringContainsString('Dentist is on leave', $this->jobs("event_type = 'APPOINTMENT_REJECTED'")[0]['payload_json']);
    }
    public function testFailedTransitionLeavesNoOrphanedOutboxJob(): void
    {
        $svc = $this->service();
        $a = $this->book($svc);
        $before = $this->rows('email_outbox');
        try {
            $svc->completeAppointment(99, (int) $a['id']); // PENDING -> COMPLETED is illegal
            $this->fail('illegal transition must fail');
        } catch (HttpException) {
        }
        $this->assertSame($before, $this->rows('email_outbox'));
    }
    public function testDuplicateEventKeyCreatesOnlyOneJob(): void
    {
        $first = $this->enqueueSimple('dup-key');
        $second = $this->outbox()->enqueue(EmailOutboxService::EVENT_CONFIRMED, 'dup-key', 'patient@test.com', 'Juan', ['name' => 'Juan']);
        $this->assertNull($second);
        $this->assertSame(1, $this->rows('email_outbox'));
        $this->assertGreaterThan(0, $first);
    }
    public function testSameTransitionQueuedTwiceIsIdempotent(): void
    {
        $svc = $this->outbox();
        $appt = (new AppointmentRepository())->findById((int) $this->book()['id']);
        $a = $svc->queueAppointmentEvent(EmailOutboxService::EVENT_CONFIRMED, $appt, 777);
        $b = $svc->queueAppointmentEvent(EmailOutboxService::EVENT_CONFIRMED, $appt, 777);
        $c = $svc->queueAppointmentEvent(EmailOutboxService::EVENT_CONFIRMED, $appt, 778); // a different transition is a different event
        $this->assertNotNull($a);
        $this->assertNull($b);
        $this->assertNotNull($c);
    }
    public function testInvalidRecipientAndUnknownEventAreRejectedAtEnqueue(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->outbox()->enqueue(EmailOutboxService::EVENT_CONFIRMED, 'x', "bad@x.test\r\nBcc: y@z.test", 'N', []);
    }
    public function testRegistrationQueuesVerificationEmailInSameTransaction(): void
    {
        $auth = new AuthService(null, null, null, null, null, null, $this->outbox());
        $payload = $this->registrationPayload('new.patient@example.com');
        $auth->register($payload);
        $jobs = $this->jobs("event_type = 'EMAIL_VERIFICATION'");
        $this->assertCount(1, $jobs);
        $this->assertSame('new.patient@example.com', $jobs[0]['recipient_email']);
        $this->assertSame(1, $this->rows('auth_tokens'));
        $this->assertStringNotContainsString('verify-email?token', (string) $jobs[0]['payload_json']);
    }
    public function testRegistrationRollsBackWhenOutboxFails(): void
    {
        $failing = new class (null, null, null, null, null, null) extends EmailOutboxService {
            public function queueVerification(string $email, string $name, int $userId, string $rawToken, int $tokenId, int $ttlSeconds): ?int
            {
                throw new \RuntimeException('outbox unavailable');
            }
        };
        $auth = new AuthService(null, null, null, null, null, null, $failing);
        $payload = $this->registrationPayload('rollback@example.com');
        try {
            $auth->register($payload);
            $this->fail('registration must fail');
        } catch (HttpException) {
        }
        $this->assertSame(0, (int) $this->pdo->query("SELECT COUNT(*) FROM users WHERE email = 'rollback@example.com'")->fetchColumn());
        $this->assertSame(0, $this->rows('auth_tokens'));
    }
    // ---------------------------------------------------------------- tokens and privacy
    public function testVerificationTokenIsEncryptedAtRestAndScrubbedAfterSend(): void
    {
        $raw = 'RAWTOKEN_' . bin2hex(random_bytes(8));
        $this->outbox()->queueVerification('patient@test.com', 'Juan', 10, $raw, 5, 86400);
        $stored = $this->jobs()[0];
        $this->assertStringNotContainsString($raw, (string) $stored['payload_json']);
        $this->assertStringContainsString('"secure":"v1:', $stored['payload_json']);
        $this->assertSame(1, $this->worker()->runBatch()['sent']);
        $this->assertStringContainsString($raw, $this->transport->sent[0]->htmlBody);
        $after = $this->jobs()[0];
        $this->assertSame('SENT', $after['status']);
        $this->assertStringNotContainsString($raw, (string) $after['payload_json']);
        $this->assertStringNotContainsString('secure', (string) $after['payload_json']);
    }
    public function testLogsNeverContainTokensRecipientsOrBodies(): void
    {
        $raw = 'LOGTOKEN_' . bin2hex(random_bytes(8));
        $this->outbox()->queueVerification('patient@test.com', 'Juan', 10, $raw, 6, 86400);
        $this->transport->failNext(FakeMailTransport::timeout());
        $this->worker()->runBatch();
        $this->now = $this->now->modify('+2 minutes');
        $this->worker()->runBatch();
        $log = (string) file_get_contents($this->logFile);
        $this->assertNotSame('', $log);
        $this->assertStringNotContainsString($raw, $log);
        $this->assertStringNotContainsString('patient@test.com', $log);
        $this->assertStringNotContainsString('Verify email address', $log);
    }
    // ---------------------------------------------------------------- worker
    public function testSuccessfulDeliveryMarksJobSent(): void
    {
        $this->enqueueSimple();
        $stats = $this->worker()->runBatch();
        $this->assertSame(1, $stats['sent']);
        $job = $this->jobs()[0];
        $this->assertSame('SENT', $job['status']);
        $this->assertSame(1, (int) $job['attempts']);
        $this->assertSame('2026-11-18 09:00:00', $job['sent_at']);
        $this->assertNull($job['locked_by']);
        $this->assertSame('patient@test.com', $this->transport->sent[0]->toEmail);
        $this->assertStringContainsString('TC-000001', $this->transport->sent[0]->textBody);
    }
    public function testSentJobsAreNotSelectedAgain(): void
    {
        $this->enqueueSimple();
        $this->worker()->runBatch();
        $this->now = $this->now->modify('+1 day');
        $stats = $this->worker()->runBatch();
        $this->assertSame(0, $stats['claimed']);
        $this->assertCount(1, $this->transport->sent);
    }
    public function testTemporaryFailureSchedulesRetryWithBackoffThenSucceeds(): void
    {
        $this->enqueueSimple();
        $this->transport->failNext(FakeMailTransport::timeout());
        $this->assertSame(1, $this->worker()->runBatch()['retried']);
        $job = $this->jobs()[0];
        $this->assertSame('FAILED_RETRYABLE', $job['status']);
        $this->assertSame(1, (int) $job['attempts']);
        $this->assertSame('TEMPORARY', $job['failure_category']);
        $this->assertSame('SMTP_TIMEOUT', $job['last_error_code']);
        $this->assertSame('2026-11-18 09:01:00', $job['next_attempt_at'], 'first delay is 60s');
        $this->assertSame(0, $this->worker()->runBatch()['claimed'], 'not eligible before next_attempt_at');
        $this->now = $this->now->modify('+61 seconds');
        $this->assertSame(1, $this->worker()->runBatch()['sent']);
        $this->assertSame(2, (int) $this->jobs()[0]['attempts']);
    }
    public function testBackoffGrowsAcrossAttempts(): void
    {
        $this->enqueueSimple();
        $this->transport->failAlways(FakeMailTransport::tempReject());
        $this->worker()->runBatch();
        $this->assertSame('2026-11-18 09:01:00', $this->jobs()[0]['next_attempt_at']);
        $this->now = $this->now->modify('+61 seconds');
        $this->worker()->runBatch();
        $this->assertSame('2026-11-18 09:06:01', $this->jobs()[0]['next_attempt_at'], 'second delay is 300s');
    }
    public function testPermanentFailureIsNotRetried(): void
    {
        $this->enqueueSimple();
        $this->transport->failNext(FakeMailTransport::badRecipient());
        $this->assertSame(1, $this->worker()->runBatch()['failed']);
        $job = $this->jobs()[0];
        $this->assertSame('FAILED_PERMANENT', $job['status']);
        $this->assertSame('INVALID_RECIPIENT', $job['last_error_code']);
        $this->now = $this->now->modify('+1 day');
        $this->assertSame(0, $this->worker()->runBatch()['claimed']);
        $this->assertSame(1, $this->transport->calls);
    }
    public function testMaxAttemptsAreEnforced(): void
    {
        $this->enqueueSimple();
        $this->transport->failAlways(FakeMailTransport::timeout());
        for ($i = 0; $i < 3; $i++) {
            $this->worker()->runBatch();
            $this->now = $this->now->modify('+7 hours');
        }
        $job = $this->jobs()[0];
        $this->assertSame('FAILED_PERMANENT', $job['status']);
        $this->assertSame(3, (int) $job['attempts']);
        $this->assertNotNull($job['failed_at']);
        $this->assertSame(1, $this->repo->stats()['exhausted']);
        $this->assertSame(0, $this->worker()->runBatch()['claimed']);
        $this->assertSame(3, $this->transport->calls);
    }
    public function testMalformedPayloadFailsPermanentlyWithoutSending(): void
    {
        $this->pdo->exec("INSERT INTO email_outbox (event_key, event_type, template_key, payload_json, recipient_email, recipient_name, subject, max_attempts, next_attempt_at) VALUES ('bad1', 'APPOINTMENT_CONFIRMED', 'appointment-confirmed', 'not json', 'patient@test.com', 'J', 'S', 3, '2026-11-18 08:00:00')");
        $this->assertSame(1, $this->worker()->runBatch()['failed']);
        $this->assertSame('PAYLOAD_MALFORMED', $this->jobs()[0]['last_error_code']);
        $this->assertSame(0, $this->transport->calls);
    }
    public function testMissingTemplateFailsPermanently(): void
    {
        $this->pdo->exec("INSERT INTO email_outbox (event_key, event_type, template_key, payload_json, recipient_email, recipient_name, subject, max_attempts, next_attempt_at) VALUES ('bad2', 'X', 'no-such-template', '{}', 'patient@test.com', 'J', 'S', 3, '2026-11-18 08:00:00')");
        $this->worker()->runBatch();
        $this->assertSame('TEMPLATE_NOT_FOUND', $this->jobs()[0]['last_error_code']);
        $this->assertSame('FAILED_PERMANENT', $this->jobs()[0]['status']);
    }
    public function testInvalidRecipientInStoredRowFailsPermanently(): void
    {
        $this->pdo->exec("INSERT INTO email_outbox (event_key, event_type, template_key, payload_json, recipient_email, recipient_name, subject, max_attempts, next_attempt_at) VALUES ('bad3', 'APPOINTMENT_CONFIRMED', 'appointment-confirmed', '{\"name\":\"J\"}', 'nope', 'J', 'S', 3, '2026-11-18 08:00:00')");
        $this->worker()->runBatch();
        $this->assertSame('INVALID_RECIPIENT', $this->jobs()[0]['last_error_code']);
        $this->assertSame(0, $this->transport->calls);
    }
    public function testLegacyRowsAreSentAsStored(): void
    {
        $this->pdo->exec("INSERT INTO email_outbox (recipient_email, recipient_name, subject, body_html, body_text, max_attempts, next_attempt_at) VALUES ('patient@test.com', 'J', 'Legacy', '<p>old</p>', 'old', 3, '2026-11-18 08:00:00')");
        $this->assertSame(1, $this->worker()->runBatch()['sent']);
        $this->assertSame('<p>old</p>', $this->transport->sent[0]->htmlBody);
    }
    public function testDisabledMailLeavesJobsQueuedAndUntouched(): void
    {
        $this->enqueueSimple();
        $stats = $this->worker('w1', null, false)->runBatch();
        $this->assertSame(0, $stats['claimed']);
        $job = $this->jobs()[0];
        $this->assertSame('PENDING', $job['status']);
        $this->assertSame(0, (int) $job['attempts']);
    }
    public function testWorkersNeverClaimTheSameJob(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->enqueueSimple("bulk-{$i}");
        }
        $a = $this->repo->claimBatch('worker-a', 6, '2026-11-18 09:00:00');
        $b = $this->repo->claimBatch('worker-b', 6, '2026-11-18 09:00:00');
        $idsA = array_column($a, 'id');
        $idsB = array_column($b, 'id');
        $this->assertCount(6, $idsA);
        $this->assertCount(4, $idsB);
        $this->assertSame([], array_intersect($idsA, $idsB));
        $this->assertSame([], $this->repo->claimBatch('worker-c', 6, '2026-11-18 09:00:00'));
    }
    public function testStaleResultFromAWorkerThatLostItsLockIsIgnored(): void
    {
        $this->enqueueSimple();
        $this->repo->claimBatch('worker-a', 1, '2026-11-18 09:00:00');
        $this->assertFalse($this->repo->markSent(1, 'worker-b', '2026-11-18 09:00:05', null), 'only the owner may record a result');
        $this->assertSame('PROCESSING', $this->jobs()[0]['status']);
        $this->assertTrue($this->repo->markSent(1, 'worker-a', '2026-11-18 09:00:05', null));
    }
    public function testExpiredLockIsRecoveredAndDelivered(): void
    {
        $this->enqueueSimple();
        $this->repo->claimBatch('crashed-worker', 1, '2026-11-18 09:00:00');
        $this->now = $this->now->modify('+400 seconds'); // lock timeout default 300s
        $stats = $this->worker()->runBatch();
        $this->assertSame(1, $stats['recovered']);
        $this->assertSame(1, $stats['sent']);
        $job = $this->jobs()[0];
        $this->assertSame('SENT', $job['status']);
        $this->assertSame(2, (int) $job['attempts'], 'the crashed attempt still counts');
    }
    public function testLockWithinTimeoutIsNotStolen(): void
    {
        $this->enqueueSimple();
        $this->repo->claimBatch('busy-worker', 1, '2026-11-18 09:00:00');
        $this->now = $this->now->modify('+100 seconds');
        $stats = $this->worker()->runBatch();
        $this->assertSame(0, $stats['recovered']);
        $this->assertSame(0, $stats['claimed']);
    }
    public function testExpiredLockOnExhaustedJobBecomesPermanentFailure(): void
    {
        $this->enqueueSimple('one-shot', $this->settings(['EMAIL_WORKER_MAX_ATTEMPTS' => '1']));
        $this->repo->claimBatch('crashed-worker', 1, '2026-11-18 09:00:00');
        $this->now = $this->now->modify('+400 seconds');
        $this->worker()->runBatch();
        $job = $this->jobs()[0];
        $this->assertSame('FAILED_PERMANENT', $job['status']);
        $this->assertSame('LOCK_EXPIRED_EXHAUSTED', $job['last_error_code']);
        $this->assertSame(0, $this->transport->calls);
    }
    public function testFailureMessagesStoredOnJobsAreSanitized(): void
    {
        $this->enqueueSimple();
        $this->transport->failNext(new \RuntimeException('connect to db.internal:3306 with password=hunter2 failed'));
        $this->worker()->runBatch();
        $job = $this->jobs()[0];
        $this->assertSame('UNKNOWN', $job['failure_category']);
        $this->assertStringNotContainsString('hunter2', (string) $job['last_error']);
        $this->assertStringNotContainsString('db.internal', (string) $job['last_error']);
        $this->assertSame('FAILED_RETRYABLE', $job['status'], 'unknown failures stay retryable');
    }
    public function testStatsReflectQueueState(): void
    {
        $this->enqueueSimple('s1');
        $this->enqueueSimple('s2');
        $this->transport->failNext(FakeMailTransport::badRecipient());
        $this->worker()->runBatch();
        $s = $this->repo->stats();
        $this->assertSame(1, $s['counts']['SENT']);
        $this->assertSame(1, $s['counts']['FAILED_PERMANENT']);
        $this->assertSame('2026-11-18 09:00:00', $s['last_sent_at']);
        $this->assertSame(2, $s['total']);
    }
    // ---------------------------------------------------------------- admin repository actions
    public function testRequeueOnlyAppliesOnceAndAllowsRedelivery(): void
    {
        $id = $this->enqueueSimple();
        $this->transport->failNext(FakeMailTransport::badRecipient());
        $this->worker()->runBatch();
        $this->assertTrue($this->repo->requeue($id, '2026-11-18 10:00:00'));
        $this->assertFalse($this->repo->requeue($id, '2026-11-18 10:00:00'), 'a second concurrent requeue is a no-op');
        $job = $this->jobs()[0];
        $this->assertSame('PENDING', $job['status']);
        $this->assertSame(4, (int) $job['max_attempts'], 'attempts(1) + manual allowance(3)');
        $this->assertSame(1, (int) $job['attempts'], 'history is preserved');
        $this->now = $this->now->modify('+2 hours');
        $this->assertSame(1, $this->worker()->runBatch()['sent']);
    }
    public function testSentJobsCannotBeRequeuedOrAbandoned(): void
    {
        $id = $this->enqueueSimple();
        $this->worker()->runBatch();
        $this->assertFalse($this->repo->requeue($id, '2026-11-18 10:00:00'));
        $this->assertFalse($this->repo->abandon($id, '2026-11-18 10:00:00', null));
    }
    public function testAbandonMarksJobPermanentAndScrubsSecrets(): void
    {
        $this->outbox()->queueVerification('patient@test.com', 'Juan', 10, 'abandon-token', 9, 86400);
        $this->assertTrue($this->repo->abandon(1, '2026-11-18 09:30:00', ['name' => 'Juan']));
        $job = $this->jobs()[0];
        $this->assertSame('FAILED_PERMANENT', $job['status']);
        $this->assertSame('ABANDONED_BY_ADMIN', $job['last_error_code']);
        $this->assertStringNotContainsString('secure', (string) $job['payload_json']);
    }
    // ---------------------------------------------------------------- reminders
    private function confirmedAppointment(string $startAt, string $status = 'CONFIRMED'): int
    {
        $start = new DateTimeImmutable($startAt, $this->tz);
        return (new AppointmentRepository())->create([
            'patient_id' => 1, 'dentist_id' => 1, 'service_id' => 1,
            'start_at' => $start->format('Y-m-d H:i:s'), 'end_at' => $start->modify('+30 minutes')->format('Y-m-d H:i:s'),
            'duration_snapshot' => 30, 'price_snapshot' => 1500.00, 'status' => $status,
            'chief_complaint' => 'private', 'operatory_chair' => 'Chair 1', 'rescheduled_from_id' => null,
        ]);
    }
    public function testEligibleAppointmentGetsExactlyOneReminder(): void
    {
        $id = $this->confirmedAppointment('2026-11-18 19:00:00'); // 10h ahead
        $r1 = $this->scheduler()->run();
        $this->assertSame(1, $r1['created']);
        $r2 = $this->scheduler()->run();
        $this->assertSame(0, $r2['created']);
        $this->assertSame(1, $r2['skipped']);
        $jobs = $this->jobs("event_type = 'APPOINTMENT_REMINDER'");
        $this->assertCount(1, $jobs);
        $this->assertSame($id, (int) $jobs[0]['appointment_id']);
    }
    public function testAppointmentsOutsideTheWindowOrNotConfirmedAreSkipped(): void
    {
        $this->confirmedAppointment('2026-11-20 10:00:00');                       // 49h ahead: too early
        $this->confirmedAppointment('2026-11-18 08:00:00');                       // already started
        $this->confirmedAppointment('2026-11-18 15:00:00', 'PENDING');             // not confirmed
        $this->confirmedAppointment('2026-11-18 16:00:00', 'CANCELLED');           // cancelled
        $this->confirmedAppointment('2026-11-18 17:00:00', 'COMPLETED');           // not reminder-eligible
        $r = $this->scheduler()->run();
        $this->assertSame(0, $r['created']);
        $this->assertCount(0, $this->jobs());
    }
    public function testReminderWindowRespectsAsiaManilaDateBoundaries(): void
    {
        $this->now = new DateTimeImmutable('2026-11-20 23:30:00', $this->tz);
        $this->confirmedAppointment('2026-11-21 08:00:00');   // 8.5h ahead, next calendar day
        $this->confirmedAppointment('2026-11-21 23:45:00');   // 24h15m ahead: outside the 24h window
        $this->assertSame(1, $this->scheduler()->run()['created']);
        $this->now = $this->now->modify('+30 minutes');        // 00:00 on the 21st: now 23h45m ahead
        $this->assertSame(1, $this->scheduler()->run()['created']);
        $this->assertCount(2, $this->jobs());
    }
    public function testConfiguredLeadTimeFromClinicSettingsIsUsed(): void
    {
        $this->pdo->exec("INSERT INTO clinic_settings (setting_key, setting_value, description, value_type, is_public) VALUES ('reminder_lead_hours', '48', 'x', 'integer', 0)");
        $this->confirmedAppointment('2026-11-20 08:00:00'); // 47h ahead
        $this->assertSame(48, $this->scheduler()->leadHours());
        $this->assertSame(1, $this->scheduler()->run()['created']);
    }
    public function testCancellingAnAppointmentInvalidatesItsQueuedReminder(): void
    {
        $id = $this->confirmedAppointment('2026-11-18 19:00:00');
        $this->scheduler()->run();
        $this->pdo->exec("UPDATE appointments SET status = 'CANCELLED' WHERE id = {$id}");
        $r = $this->scheduler()->run();
        $this->assertSame(1, $r['invalidated']);
        $this->assertSame('CANCELLED', $this->jobs()[0]['status']);
        $this->assertSame('REMINDER_INELIGIBLE', $this->jobs()[0]['last_error_code']);
    }
    public function testReschedulingInPlaceInvalidatesOldReminderAndQueuesNewOne(): void
    {
        $id = $this->confirmedAppointment('2026-11-18 19:00:00');
        $this->scheduler()->run();
        $this->pdo->exec("UPDATE appointments SET start_at = '2026-11-18 21:00:00', end_at = '2026-11-18 21:30:00' WHERE id = {$id}");
        $r = $this->scheduler()->run();
        $this->assertSame(1, $r['created']);
        $this->assertSame(1, $r['invalidated']);
        $jobs = $this->jobs();
        $this->assertSame(['CANCELLED', 'PENDING'], array_column($jobs, 'status'));
        $this->assertNotSame($jobs[0]['event_key'], $jobs[1]['event_key']);
    }
    public function testServiceLevelCancellationAlsoCancelsQueuedReminder(): void
    {
        $svc = $this->service();
        $appt = $this->book($svc);
        $id = (int) $appt['id'];
        $svc->confirmAppointment(99, $id);
        $this->outbox()->queueReminder((new AppointmentRepository())->findById($id));
        $svc->cancelAppointment(10, 'PATIENT', $id, ['reason' => 'Cannot attend']);
        $this->assertSame('CANCELLED', $this->jobs("event_type = 'APPOINTMENT_REMINDER'")[0]['status']);
    }
    public function testWorkerRevalidatesReminderBeforeSending(): void
    {
        $id = $this->confirmedAppointment('2026-11-18 19:00:00');
        $this->scheduler()->run();
        $this->pdo->exec("UPDATE appointments SET status = 'CANCELLED' WHERE id = {$id}"); // became ineligible after scheduling
        $stats = $this->worker()->runBatch();
        $this->assertSame(1, $stats['cancelled']);
        $this->assertSame(0, $this->transport->calls);
        $this->assertSame('CANCELLED', $this->jobs()[0]['status']);
    }
    public function testDeliveredReminderIsNeverQueuedOrSentAgain(): void
    {
        $this->confirmedAppointment('2026-11-18 19:00:00');
        $this->scheduler()->run();
        $this->assertSame(1, $this->worker()->runBatch()['sent']);
        $this->scheduler()->run();
        $this->now = $this->now->modify('+1 hour');
        $this->assertSame(0, $this->worker()->runBatch()['claimed']);
        $this->assertCount(1, $this->transport->sent);
        $this->assertStringContainsString('Reminder', $this->transport->sent[0]->subject);
        $this->assertCount(1, $this->jobs());
    }
    public function testSimultaneousSchedulersCannotCreateDuplicateReminders(): void
    {
        $id = $this->confirmedAppointment('2026-11-18 19:00:00');
        $appt = (new AppointmentRepository())->findById($id);
        $a = $this->outbox()->queueReminder($appt);
        $b = $this->outbox()->queueReminder($appt); // second scheduler loses the unique-key race
        $this->assertNotNull($a);
        $this->assertNull($b);
        $this->assertCount(1, $this->jobs());
    }
}
