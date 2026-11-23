<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Config;
use App\Core\Database;
use App\Core\HttpException;
use App\Core\Logger;
use App\Repositories\AuthTokenRepository;
use App\Repositories\EmailOutboxRepository;
use App\Repositories\RateLimitRepository;
use App\Repositories\UserRepository;
use App\Services\AuthService;
use App\Services\Email\EmailMessage;
use App\Services\Email\EmailOutboxService;
use App\Services\Email\EmailOutboxWorker;
use App\Services\Email\EmailRetryPolicy;
use App\Services\Email\EmailService;
use App\Services\Email\EmailTemplateRenderer;
use App\Services\Email\MailConfig;
use App\Services\Email\MailTransportException;
use App\Services\Email\MailTransportInterface;
use App\Services\Email\OutboxSettings;
use App\Services\Email\PayloadCipher;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Integration & Security Test Suite for Patient Registration Welcome Email Automation.
 * Uses a fake transport (never sends real external emails) and validates transactional outbox,
 * idempotency, verification lifecycle, welcome trigger, retry policy, and security isolation.
 */
class PatientRegistrationEmailFlowTest extends TestCase
{
    private PDO $pdo;
    private EmailOutboxRepository $outboxRepo;
    private PayloadCipher $cipher;
    private Logger $logger;
    private DateTimeImmutable $now;
    /** @var list<EmailMessage> */
    private array $sentMessages = [];
    private ?MailTransportException $forcedException = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->pdo = TestDb::create();
        RateLimitRepository::resetInMemory();
        $this->sentMessages = [];
        $this->forcedException = null;
        $this->now = new DateTimeImmutable('2026-11-23 10:00:00', new DateTimeZone('Asia/Manila'));

        $config = Config::getInstance();
        $config->set('auth_password_min_length', 8);
        $config->set('auth_register_rate_limit', 50);
        $config->set('email_verification_token_ttl', 86400);

        $this->outboxRepo = new EmailOutboxRepository();
        $this->cipher = new PayloadCipher(str_repeat('K', 32));
        $this->logger = Logger::getInstance();
    }

    private function clock(): callable
    {
        return fn(): DateTimeImmutable => $this->now;
    }

    private function outboxSettings(): OutboxSettings
    {
        return OutboxSettings::fromArray([
            'EMAIL_WORKER_ENABLED' => 'true',
            'EMAIL_WORKER_BATCH_SIZE' => '20',
            'EMAIL_WORKER_MAX_ATTEMPTS' => '3',
            'EMAIL_WORKER_LOCK_TIMEOUT' => '300',
            'EMAIL_WORKER_SLEEP_SECONDS' => '2',
            'EMAIL_REMINDER_LEAD_HOURS' => '24',
            'EMAIL_RETRY_DELAYS' => '60,300',
            'EMAIL_RETRY_JITTER' => '0',
        ]);
    }

    private function outboxService(): EmailOutboxService
    {
        return new EmailOutboxService(
            $this->outboxRepo,
            $this->outboxSettings(),
            $this->cipher,
            $this->logger,
            $this->clock(),
            Database::getInstance()
        );
    }

    private function worker(): EmailOutboxWorker
    {
        $sentRef = &$this->sentMessages;
        $forcedRef = &$this->forcedException;

        $transport = new class ($sentRef, $forcedRef) implements MailTransportInterface {
            /** @param list<EmailMessage> $sent */
            public function __construct(private array &$sent, private ?MailTransportException &$forced)
            {
            }

            public function deliver(EmailMessage $message): void
            {
                if ($this->forced !== null) {
                    throw $this->forced;
                }
                $this->sent[] = $message;
            }
        };

        $mailConfig = MailConfig::fromArray([
            'MAIL_ENABLED' => 'true',
            'MAIL_HOST' => 'mailpit',
            'MAIL_PORT' => '1025',
            'MAIL_ENCRYPTION' => 'none',
            'MAIL_USERNAME' => '',
            'MAIL_PASSWORD' => '',
            'MAIL_FROM_ADDRESS' => 'noreply@toothcarehub.local',
            'MAIL_FROM_NAME' => 'ToothCare Hub',
            'MAIL_TIMEOUT' => '5',
            'MAIL_VERIFY_PEER' => 'true',
        ]);

        $emailService = new EmailService($transport, $mailConfig, new EmailRetryPolicy([60, 300], 0.0));
        $renderer = new EmailTemplateRenderer(EmailTemplateRenderer::defaultTemplateDir(), 'http://localhost:8080');

        return new EmailOutboxWorker(
            $this->outboxRepo,
            $emailService,
            $renderer,
            $this->cipher,
            $this->outboxSettings(),
            $this->logger,
            'test-worker-reg',
            $this->clock()
        );
    }

    /** @return array<string, mixed> */
    private function registrationPayload(string $email): array
    {
        return [
            'email' => $email,
            'password' => 'StrongPass123!',
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'phone' => '+639171234567',
            'date_of_birth' => '1995-04-12',
            'gender' => 'FEMALE',
            'accept_legal' => true,
            'terms_version' => '1.0',
            'privacy_version' => '1.0',
        ];
    }

    /** @return list<array<string, mixed>> */
    private function outboxRows(?string $eventType = null): array
    {
        if ($eventType !== null) {
            $stmt = $this->pdo->prepare('SELECT * FROM email_outbox WHERE event_type = ? ORDER BY id ASC');
            $stmt->execute([$eventType]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        return $this->pdo->query('SELECT * FROM email_outbox ORDER BY id ASC')->fetchAll(PDO::FETCH_ASSOC);
    }

    public function testRegistrationQueuesAcknowledgmentAndVerificationThenVerificationQueuesWelcomeOnce(): void
    {
        $outbox = $this->outboxService();
        $auth = new AuthService(null, null, null, null, null, null, $outbox);

        $reg = $auth->register($this->registrationPayload('maria.onboarding@example.com'));
        $userId = (int) $reg['id'];

        // 1. Registration queues Registration Acknowledgment + Email Verification, NOT Welcome yet
        $this->assertCount(1, $this->outboxRows(EmailOutboxService::EVENT_REGISTRATION_RECEIVED));
        $this->assertCount(1, $this->outboxRows(EmailOutboxService::EVENT_VERIFICATION));
        $this->assertCount(0, $this->outboxRows(EmailOutboxService::EVENT_PATIENT_WELCOME));

        // Process initial batch via worker -> 2 messages sent to exact patient recipient
        $stats = $this->worker()->runBatch();
        $this->assertSame(2, $stats['sent']);
        $this->assertCount(2, $this->sentMessages);

        $subjects = array_map(fn(EmailMessage $m) => $m->subject, $this->sentMessages);
        $this->assertContains('Thank You for Registering with ToothCare Hub!', $subjects);
        $this->assertContains('Verify Your ToothCare Hub Email Address', $subjects);

        // Extract raw verification token from the rendered verification email URL
        $verificationEmail = null;
        foreach ($this->sentMessages as $msg) {
            $this->assertSame('maria.onboarding@example.com', $msg->toEmail);
            $this->assertStringNotContainsString('StrongPass123!', $msg->htmlBody . $msg->textBody);
            if ($msg->subject === 'Verify Your ToothCare Hub Email Address') {
                $verificationEmail = $msg;
            }
        }
        $this->assertNotNull($verificationEmail);
        preg_match('/verify-email\?token=([a-f0-9]{64})/', $verificationEmail->textBody, $matches);
        $this->assertNotEmpty($matches[1] ?? '');
        $rawToken = $matches[1];

        // 2. Verify email -> enqueues Patient Welcome email atomically
        $verifyRes = $auth->verifyEmail($rawToken);
        $this->assertTrue($verifyRes['verified']);

        $welcomeJobs = $this->outboxRows(EmailOutboxService::EVENT_PATIENT_WELCOME);
        $this->assertCount(1, $welcomeJobs);
        $this->assertSame("patient-welcome:{$userId}", $welcomeJobs[0]['event_key']);

        // Worker sends Welcome email
        $welcomeStats = $this->worker()->runBatch();
        $this->assertSame(1, $welcomeStats['sent']);
        $this->assertCount(3, $this->sentMessages);

        $welcomeMsg = $this->sentMessages[2];
        $this->assertSame('maria.onboarding@example.com', $welcomeMsg->toEmail);
        $this->assertSame("Welcome to ToothCare Hub — We're Glad You're Here!", $welcomeMsg->subject);
        $this->assertStringContainsString('Hello, Maria Santos!', $welcomeMsg->htmlBody);
        $this->assertStringContainsString('Explore available dental services.', $welcomeMsg->textBody);

        // 3. Logging in, fetching profile, or re-invoking idempotent queue methods must NEVER create duplicates
        $auth->login(['email' => 'maria.onboarding@example.com', 'password' => 'StrongPass123!']);
        $auth->getCurrentUser($userId);
        $this->assertNull($outbox->queueRegistrationReceived('maria.onboarding@example.com', 'Maria Santos', $userId));
        $this->assertNull($outbox->queuePatientWelcome('maria.onboarding@example.com', 'Maria Santos', $userId));

        $this->assertCount(1, $this->outboxRows(EmailOutboxService::EVENT_REGISTRATION_RECEIVED));
        $this->assertCount(1, $this->outboxRows(EmailOutboxService::EVENT_PATIENT_WELCOME));
    }

    public function testResendVerificationInvalidatesOldTokenAndNeverQueuesDuplicateAcknowledgmentOrWelcome(): void
    {
        $outbox = $this->outboxService();
        $auth = new AuthService(null, null, null, null, null, null, $outbox);

        $auth->register($this->registrationPayload('resend.patient@example.com'));
        $this->worker()->runBatch();
        preg_match('/verify-email\?token=([a-f0-9]{64})/', $this->sentMessages[1]->textBody, $firstMatch);
        $oldToken = $firstMatch[1];

        // Request resend
        $auth->resendVerification('resend.patient@example.com');

        // Still 1 registration acknowledgment, 0 welcome, 2 verification jobs
        $this->assertCount(1, $this->outboxRows(EmailOutboxService::EVENT_REGISTRATION_RECEIVED));
        $this->assertCount(2, $this->outboxRows(EmailOutboxService::EVENT_VERIFICATION));
        $this->assertCount(0, $this->outboxRows(EmailOutboxService::EVENT_PATIENT_WELCOME));

        // Old verification token must now be invalidated (cannot be used)
        $this->expectException(HttpException::class);
        $this->expectExceptionCode(422);
        $auth->verifyEmail($oldToken);
    }

    public function testSmtpFailureDoesNotUndoRegistrationAndFollowsRetryPolicy(): void
    {
        $outbox = $this->outboxService();
        $auth = new AuthService(null, null, null, null, null, null, $outbox);

        // Simulate SMTP outage BEFORE worker runs; registration must STILL succeed!
        $this->forcedException = new MailTransportException('SMTP unavailable', MailTransportException::REASON_CONNECTION, 421);

        $reg = $auth->register($this->registrationPayload('smtp.down@example.com'));
        $this->assertGreaterThan(0, (int) $reg['id']);

        // Worker attempts delivery -> marks FAILED_RETRYABLE (not lost!)
        $attempt1 = $this->worker()->runBatch();
        $this->assertSame(2, $attempt1['retried']);
        $rows = $this->outboxRows();
        $this->assertSame(EmailOutboxRepository::FAILED_RETRYABLE, $rows[0]['status']);

        // Advance clock past backoff, restore SMTP -> worker succeeds!
        $this->now = $this->now->modify('+120 seconds');
        $this->forcedException = null;
        $attempt2 = $this->worker()->runBatch();
        $this->assertSame(2, $attempt2['sent']);
    }

    public function testPermanentSmtpFailureMarksJobPermanentWithoutInfiniteRetry(): void
    {
        $outbox = $this->outboxService();
        $auth = new AuthService(null, null, null, null, null, null, $outbox);

        $this->forcedException = new MailTransportException('Mailbox unavailable', MailTransportException::REASON_RECIPIENT, 550);
        $auth->register($this->registrationPayload('perm.bounce@example.com'));

        $attempt1 = $this->worker()->runBatch();
        $this->assertSame(2, $attempt1['failed']);
        $rows = $this->outboxRows();
        $this->assertSame(EmailOutboxRepository::FAILED_PERMANENT, $rows[0]['status']);
        $this->assertSame(1, (int) $rows[0]['attempts']);

        // Advancing clock must NOT pick up permanent failures again
        $this->now = $this->now->modify('+1 hour');
        $attempt2 = $this->worker()->runBatch();
        $this->assertSame(0, $attempt2['claimed']);
    }

    public function testFailedOrDuplicateRegistrationLeavesZeroOrphanedOutboxJobs(): void
    {
        $outbox = $this->outboxService();
        $auth = new AuthService(null, null, null, null, null, null, $outbox);

        // Invalid payload -> 422, 0 outbox jobs
        try {
            $auth->register(['email' => 'bad', 'password' => '123']);
            $this->fail('Expected validation failure');
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
        }
        $this->assertCount(0, $this->outboxRows());

        // Valid registration -> 2 jobs; duplicate registration -> 409 and STILL only 2 jobs
        $auth->register($this->registrationPayload('dup.check@example.com'));
        try {
            $auth->register($this->registrationPayload('dup.check@example.com'));
            $this->fail('Expected 409 conflict');
        } catch (HttpException $e) {
            $this->assertSame(409, $e->getStatusCode());
        }
        $this->assertCount(2, $this->outboxRows());
    }

    public function testNonPatientVerificationDoesNotQueuePatientWelcomeEmail(): void
    {
        $outbox = $this->outboxService();
        $auth = new AuthService(null, null, null, null, null, null, $outbox);
        $userRepo = new UserRepository();
        $tokenRepo = new AuthTokenRepository();

        $adminId = $userRepo->create('staff.admin@example.com', password_hash('AdminPass123!', PASSWORD_DEFAULT), 'ADMIN', 1, 0, 'Clinic', 'Admin');
        $rawToken = bin2hex(random_bytes(32));
        $tokenRepo->createToken($adminId, hash('sha256', $rawToken), 'EMAIL_VERIFY', 3600);

        $res = $auth->verifyEmail($rawToken);
        $this->assertTrue($res['verified']);
        $this->assertCount(0, $this->outboxRows(EmailOutboxService::EVENT_PATIENT_WELCOME));
    }
}
