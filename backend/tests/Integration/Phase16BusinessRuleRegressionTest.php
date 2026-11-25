<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Database;
use App\Core\Logger;
use App\Core\Request;
use App\Repositories\EmailOutboxRepository;
use App\Repositories\UserRepository;
use App\Services\Email\EmailOutboxWorker;
use App\Services\Email\EmailService;
use App\Services\Email\EmailTemplateRenderer;
use App\Services\Email\MailConfig;
use App\Services\Email\OutboxSettings;
use App\Services\Email\PayloadCipher;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use PHPUnit\Framework\TestCase;
use Tests\Support\FakeMailTransport;
use Tests\Support\TestDb;

/**
 * Phase 16 Mandatory Business-Rule & Security Regression Suite.
 * Explicitly verifies all required business rules (#1-#15) and adversarial security cases.
 */
class Phase16BusinessRuleRegressionTest extends TestCase
{
    private Application $app;
    private PDO $pdo;
    private UserRepository $userRepo;
    private DateTimeZone $tz;

    private array $adminUser;
    private array $dentistUser;
    private array $patient1User;
    private array $patient2User;

    private int $dentistId;
    private int $inactiveDentistId;
    private int $patient1Id;
    private int $patient2Id;
    private int $serviceId;
    private int $inactiveServiceId;

    protected function setUp(): void
    {
        $_SESSION = [];
        TestDb::create();
        $this->app = new Application(null, false);
        $this->pdo = Database::getInstance()->getConnection();
        $this->userRepo = new UserRepository();
        $this->tz = new DateTimeZone('Asia/Manila');

        $hash = password_hash('Password123!', PASSWORD_BCRYPT);

        $adminId = $this->userRepo->create('p16.admin@example.com', $hash, 'ADMIN', 1, 1);
        $this->adminUser = $this->userRepo->findById($adminId);

        $dentistUserId = $this->userRepo->create('p16.dentist@example.com', $hash, 'DENTIST', 1, 1);
        $this->dentistUser = $this->userRepo->findById($dentistUserId);
        $this->pdo->prepare("INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone, is_active) VALUES (?, 'Clara', 'Mendoza', 'General Dentistry', 'LIC-P16-1', '09173000001', 1)")
            ->execute([$dentistUserId]);
        $this->dentistId = (int) $this->pdo->lastInsertId();

        // Schedule active dentist Mon-Fri 08:00-17:00
        for ($dow = 1; $dow <= 5; $dow++) {
            $this->pdo->prepare("INSERT INTO dentist_schedules (dentist_id, day_of_week, start_time, end_time, operatory_chair, is_active) VALUES (?, ?, '08:00:00', '17:00:00', 'Chair 1', 1)")
                ->execute([$this->dentistId, $dow]);
        }

        // Inactive dentist
        $inDentUserId = $this->userRepo->create('p16.inactive.dentist@example.com', $hash, 'DENTIST', 1, 1);
        $this->pdo->prepare("INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone, is_active) VALUES (?, 'Retired', 'Doctor', 'General', 'LIC-P16-2', '09173000002', 0)")
            ->execute([$inDentUserId]);
        $this->inactiveDentistId = (int) $this->pdo->lastInsertId();

        // Patients
        $p1UserId = $this->userRepo->create('p16.patient1@example.com', $hash, 'PATIENT', 1, 1);
        $this->patient1User = $this->userRepo->findById($p1UserId);
        $this->pdo->prepare("INSERT INTO patients (user_id, first_name, last_name, date_of_birth, phone, gender) VALUES (?, 'Ana', 'Reyes', '1993-04-12', '09174000001', 'FEMALE')")
            ->execute([$p1UserId]);
        $this->patient1Id = (int) $this->pdo->lastInsertId();

        $p2UserId = $this->userRepo->create('p16.patient2@example.com', $hash, 'PATIENT', 1, 1);
        $this->patient2User = $this->userRepo->findById($p2UserId);
        $this->pdo->prepare("INSERT INTO patients (user_id, first_name, last_name, date_of_birth, phone, gender) VALUES (?, 'Luis', 'Tan', '1991-09-18', '09174000002', 'MALE')")
            ->execute([$p2UserId]);
        $this->patient2Id = (int) $this->pdo->lastInsertId();

        // Active & inactive services
        $this->pdo->exec("INSERT INTO services (name, category, price, duration_minutes, is_active) VALUES ('P16 Cleaning', 'Preventive', 1500.00, 30, 1)");
        $this->serviceId = (int) $this->pdo->lastInsertId();

        $this->pdo->exec("INSERT INTO services (name, category, price, duration_minutes, is_active) VALUES ('P16 Archived Service', 'Other', 500.00, 30, 0)");
        $this->inactiveServiceId = (int) $this->pdo->lastInsertId();
    }

    private function nextWeekdayDate(int $minDaysAhead = 4): string
    {
        $dt = (new DateTimeImmutable('now', $this->tz))->modify("+{$minDaysAhead} days");
        while ((int) $dt->format('N') > 5) {
            $dt = $dt->modify('+1 day');
        }
        return $dt->format('Y-m-d');
    }

    private function req(string $method, string $uri, ?array $user = null, array $body = [], array $query = []): Request
    {
        $headers = [];
        $rawBody = '';
        if (!empty($body)) {
            $headers['content-type'] = 'application/json';
            $rawBody = json_encode($body, JSON_THROW_ON_ERROR);
        }
        if (in_array(strtoupper($method), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            $_SESSION['csrf_token'] = 'phase16-test-csrf-token';
            $headers['x-csrf-token'] = 'phase16-test-csrf-token';
        }
        $r = Request::create($method, $uri, $headers, $rawBody, $query);
        if ($user !== null) {
            $r->setUser($user);
        }
        return $r;
    }

    public function testRule1And2ValidInvalidRegistrationLoginAndNoPublicRoleEscalation(): void
    {
        // Invalid registration input
        $badReg = $this->app->handle($this->req('POST', '/api/v1/auth/register', null, [
            'email' => 'not-an-email',
            'password' => '123',
        ]));
        $this->assertContains($badReg->getStatusCode(), [400, 422]);

        // Public registration attempting role escalation to ADMIN must always create PATIENT
        $escReg = $this->app->handle($this->req('POST', '/api/v1/auth/register', null, [
            'first_name' => 'Test',
            'last_name' => 'Escalator',
            'email' => 'escalator.p16@example.com',
            'password' => 'StrongPass123!',
            'password_confirmation' => 'StrongPass123!',
            'phone' => '09175551234',
            'date_of_birth' => '1995-05-05',
            'gender' => 'OTHER',
            'role' => 'ADMIN',
            'accept_legal' => true,
            'terms_version' => '1.0',
            'privacy_version' => '1.0',
        ]));
        $this->assertSame(201, $escReg->getStatusCode());
        $created = $this->userRepo->findByEmail('escalator.p16@example.com');
        $this->assertNotNull($created);
        $this->assertSame('PATIENT', strtoupper((string) $created['role']));

        // Invalid login rejected with 401
        $badLogin = $this->app->handle($this->req('POST', '/api/v1/auth/login', null, [
            'email' => 'p16.patient1@example.com',
            'password' => 'WrongPassword999!',
        ]));
        $this->assertSame(401, $badLogin->getStatusCode());
    }

    public function testRule3And4UnauthorizedEndpointsAndPatientIdorProtection(): void
    {
        // Unauthenticated -> 401
        $this->assertSame(401, $this->app->handle($this->req('GET', '/api/v1/appointments'))->getStatusCode());
        $this->assertSame(401, $this->app->handle($this->req('GET', '/api/v1/admin/dashboard/summary'))->getStatusCode());

        // Patient hitting admin endpoint -> 403
        $this->assertSame(403, $this->app->handle($this->req('GET', '/api/v1/admin/dashboard/summary', $this->patient1User))->getStatusCode());

        // Create appointment for Patient 2
        $date = $this->nextWeekdayDate(5);
        $bookRes = $this->app->handle($this->req('POST', '/api/v1/appointments', $this->patient2User, [
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => "{$date} 10:00:00",
        ]));
        $this->assertSame(201, $bookRes->getStatusCode());
        $apptId = (int) json_decode($bookRes->getBody(), true)['data']['id'];

        // Patient 1 attempts to read or cancel Patient 2's appointment -> 403/404 (non-enumeration)
        $this->assertContains($this->app->handle($this->req('GET', "/api/v1/appointments/{$apptId}", $this->patient1User))->getStatusCode(), [403, 404]);
        $this->assertContains($this->app->handle($this->req('POST', "/api/v1/appointments/{$apptId}/cancel", $this->patient1User, ['reason' => 'IDOR test']))->getStatusCode(), [403, 404]);
    }

    public function testRule5To9InactiveEntitiesWorkingHoursTimeOffBackToBackAndOverlapConflict(): void
    {
        $date = $this->nextWeekdayDate(6);

        // Rule 5: Inactive dentist & inactive service cannot be booked
        $inDoc = $this->app->handle($this->req('POST', '/api/v1/appointments', $this->patient1User, [
            'dentist_id' => $this->inactiveDentistId,
            'service_id' => $this->serviceId,
            'start_at' => "{$date} 09:00:00",
        ]));
        $this->assertContains($inDoc->getStatusCode(), [400, 409, 422]);

        $inSvc = $this->app->handle($this->req('POST', '/api/v1/appointments', $this->patient1User, [
            'dentist_id' => $this->dentistId,
            'service_id' => $this->inactiveServiceId,
            'start_at' => "{$date} 09:00:00",
        ]));
        $this->assertContains($inSvc->getStatusCode(), [400, 409, 422]);

        // Rule 6: Outside working hours (20:00) rejected
        $afterHours = $this->app->handle($this->req('POST', '/api/v1/appointments', $this->patient1User, [
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => "{$date} 20:00:00",
        ]));
        $this->assertContains($afterHours->getStatusCode(), [400, 409, 422]);

        // Rule 7: Dentist time-off block respected
        $this->pdo->prepare("INSERT INTO dentist_time_off (dentist_id, start_at, end_at, reason) VALUES (?, ?, ?, 'Training')")
            ->execute([$this->dentistId, "{$date} 14:00:00", "{$date} 16:00:00"]);
        $timeOffRes = $this->app->handle($this->req('POST', '/api/v1/appointments', $this->patient1User, [
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => "{$date} 14:30:00",
        ]));
        $this->assertContains($timeOffRes->getStatusCode(), [400, 409, 422]);

        // Rule 8: Adjacent back-to-back bookings (10:00-10:30 and 10:30-11:00) both succeed
        $first = $this->app->handle($this->req('POST', '/api/v1/appointments', $this->patient1User, [
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => "{$date} 10:00:00",
        ]));
        $this->assertSame(201, $first->getStatusCode());

        $adjacent = $this->app->handle($this->req('POST', '/api/v1/appointments', $this->patient2User, [
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => "{$date} 10:30:00",
        ]));
        $this->assertSame(201, $adjacent->getStatusCode());

        // Rule 9: Overlapping slot (10:15-10:45) rejected with 409 Conflict
        $overlap = $this->app->handle($this->req('POST', '/api/v1/appointments', $this->patient2User, [
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => "{$date} 10:15:00",
        ]));
        $this->assertSame(409, $overlap->getStatusCode());
    }

    public function testRule10And11InvalidStateTransitionAndCancellationPolicyCutoff(): void
    {
        // Rule 10: Invalid transition (CANCELLED -> COMPLETED) rejected
        $date = $this->nextWeekdayDate(7);
        $bookRes = $this->app->handle($this->req('POST', '/api/v1/appointments', $this->patient1User, [
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => "{$date} 11:00:00",
        ]));
        $this->assertSame(201, $bookRes->getStatusCode());
        $apptId = (int) json_decode($bookRes->getBody(), true)['data']['id'];

        $cancelRes = $this->app->handle($this->req('POST', "/api/v1/appointments/{$apptId}/cancel", $this->patient1User, [
            'reason' => 'Change of plans',
        ]));
        $this->assertSame(200, $cancelRes->getStatusCode());

        $badTransition = $this->app->handle($this->req('PATCH', "/api/v1/admin/appointments/{$apptId}/complete", $this->adminUser));
        $this->assertContains($badTransition->getStatusCode(), [409, 422]);

        // Rule 11: Patient cancellation within 24h cutoff rejected
        $soonStart = (new DateTimeImmutable('now', $this->tz))->modify('+2 hours')->format('Y-m-d H:i:s');
        $soonEnd = (new DateTimeImmutable('now', $this->tz))->modify('+2 hours 30 minutes')->format('Y-m-d H:i:s');
        $this->pdo->prepare("
            INSERT INTO appointments (patient_id, dentist_id, service_id, start_at, end_at, duration_snapshot, price_snapshot, status)
            VALUES (?, ?, ?, ?, ?, 30, 1500.00, 'CONFIRMED')
        ")->execute([$this->patient1Id, $this->dentistId, $this->serviceId, $soonStart, $soonEnd]);
        $soonId = (int) $this->pdo->lastInsertId();

        $lateCancel = $this->app->handle($this->req('POST', "/api/v1/appointments/{$soonId}/cancel", $this->patient1User, [
            'reason' => 'Too late to cancel',
        ]));
        $this->assertContains($lateCancel->getStatusCode(), [400, 409, 422]);
    }

    public function testRule12To15EmailFailureResilienceRealtimeRecipientsOfflineNotificationRecoveryAndSqliDefense(): void
    {
        $date = $this->nextWeekdayDate(8);

        // Book appointment (persists appointment + notifications + realtime_outbox atomically even when realtime/mail are offline)
        $bookRes = $this->app->handle($this->req('POST', '/api/v1/appointments', $this->patient1User, [
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => "{$date} 09:00:00",
            'chief_complaint' => "Routine checkup <script>alert('xss')</script>",
        ]));
        $this->assertSame(201, $bookRes->getStatusCode());
        $apptId = (int) json_decode($bookRes->getBody(), true)['data']['id'];

        // Rule 12: Simulate email transport failure on the queued outbox job -> appointment remains committed and outbox records retry state
        $outboxRepo = new EmailOutboxRepository();
        $outboxStmt = $this->pdo->prepare('SELECT * FROM email_outbox WHERE appointment_id = ? ORDER BY id DESC LIMIT 1');
        $outboxStmt->execute([$apptId]);
        $queuedJob = $outboxStmt->fetch(PDO::FETCH_ASSOC);

        if (!$queuedJob) {
            // If MAIL_ENABLED=false skipped queueing, insert an outbox job directly to verify worker retry handling
            $this->pdo->prepare("
                INSERT INTO email_outbox (
                    event_key, event_type, template_key, user_id, appointment_id,
                    recipient_email, recipient_name, subject, body_html, body_text,
                    status, attempts, max_attempts, next_attempt_at
                ) VALUES (?, 'appointment.created', 'appointment_requested', ?, ?, 'p16.patient1@example.com', 'Ana Reyes', 'Appointment Requested', '<p>Requested</p>', 'Requested', 'PENDING', 0, 3, '2020-01-01 00:00:00')
            ")->execute(["p16-appt-{$apptId}-created", (int) $this->patient1User['id'], $apptId]);
            $jobId = (int) $this->pdo->lastInsertId();
        } else {
            $jobId = (int) $queuedJob['id'];
            $this->pdo->prepare("UPDATE email_outbox SET next_attempt_at = '2020-01-01 00:00:00' WHERE id = ?")->execute([$jobId]);
        }

        $failingTransport = new FakeMailTransport();
        $failingTransport->failNext(FakeMailTransport::timeout());
        $settings = OutboxSettings::fromArray(['EMAIL_RETRY_JITTER' => '0', 'EMAIL_WORKER_MAX_ATTEMPTS' => '3']);
        $mailConfig = MailConfig::fromArray([
            'MAIL_ENABLED' => 'true',
            'MAIL_HOST' => 'smtp.test',
            'MAIL_PORT' => '25',
            'MAIL_FROM_ADDRESS' => 'noreply@example.test',
            'MAIL_ENCRYPTION' => 'none',
        ]);
        $logFile = sys_get_temp_dir() . '/tch-p16-email-' . bin2hex(random_bytes(4)) . '.log';
        $worker = new EmailOutboxWorker(
            $outboxRepo,
            new EmailService($failingTransport, $mailConfig, $settings->retryPolicy),
            new EmailTemplateRenderer(EmailTemplateRenderer::defaultTemplateDir(), 'https://app.example.test'),
            new PayloadCipher('phase16-test-key'),
            $settings,
            new Logger($logFile, 'debug'),
            'p16-worker'
        );
        $worker->runBatch();
        @unlink($logFile);

        // Appointment is STILL committed
        $stillExists = (int) $this->pdo->query("SELECT COUNT(*) FROM appointments WHERE id = {$apptId}")->fetchColumn();
        $this->assertSame(1, $stillExists);

        // Outbox job recorded retryable failure state
        $job = $outboxRepo->findById($jobId);
        $this->assertNotNull($job);
        $this->assertContains($job['status'], ['FAILED_RETRYABLE', 'RETRY_SCHEDULED', 'FAILED', 'PENDING']);
        $this->assertGreaterThanOrEqual(1, (int) $job['attempts']);

        // Rule 13 & 14: Server-selected notification recipients & offline REST recovery
        $notifRes = $this->app->handle($this->req('GET', '/api/v1/notifications', $this->patient1User));
        $this->assertSame(200, $notifRes->getStatusCode());
        $notifBody = json_decode($notifRes->getBody(), true)['data'];
        $this->assertGreaterThanOrEqual(1, count($notifBody['items'] ?? []));

        // Patient 2 must NOT see Patient 1's notification
        $p2NotifRes = $this->app->handle($this->req('GET', '/api/v1/notifications', $this->patient2User));
        $p2Items = json_decode($p2NotifRes->getBody(), true)['data']['items'] ?? [];
        foreach ($p2Items as $item) {
            $this->assertNotSame($apptId, (int) ($item['reference_id'] ?? 0));
        }

        // Rule 15: SQL injection payload in search query is safely parameterized (returns 200 with 0 matched rows, no DB damage)
        $sqliRes = $this->app->handle($this->req('GET', '/api/v1/appointments/search', $this->adminUser, [], [
            'search' => "' OR '1'='1'; DROP TABLE appointments; --",
        ]));
        $this->assertSame(200, $sqliRes->getStatusCode());
        $this->assertSame(1, (int) $this->pdo->query("SELECT COUNT(*) FROM appointments WHERE id = {$apptId}")->fetchColumn());
    }
}
