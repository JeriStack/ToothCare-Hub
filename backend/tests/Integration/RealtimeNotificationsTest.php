<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Database;
use App\Core\Request;
use App\Repositories\AppointmentRepository;
use App\Repositories\DentistRepository;
use App\Repositories\DentistScheduleRepository;
use App\Repositories\NotificationRepository;
use App\Repositories\PatientRepository;
use App\Repositories\RealtimeOutboxRepository;
use App\Repositories\RealtimeTicketRepository;
use App\Repositories\ServiceRepository;
use App\Repositories\UserRepository;
use App\Services\AppointmentService;
use App\Services\Realtime\InternalRequestSigner;
use App\Services\Realtime\RealtimeConfig;
use App\Services\Realtime\RealtimeOutboxService;
use App\Services\Realtime\RealtimePublisherClient;
use App\Services\Realtime\RealtimeTicketService;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Phase 14 Integration & Security Test Suite:
 * - Short-lived single-use connection tickets & HMAC-SHA256 internal verification
 * - Transactional notification + realtime_outbox atomicity & rollback safety
 * - Minimal non-clinical event payload enforcement
 * - Outage resilience, retry backoff, and idempotent delivery
 * - Session revocation & notification ownership isolation
 */
class RealtimeNotificationsTest extends TestCase
{
    private const TEST_SECRET = 'phpunit-realtime-internal-secret-32bytes!';

    private PDO $pdo;
    private Application $app;
    private UserRepository $userRepo;
    private PatientRepository $patientRepo;
    private DentistRepository $dentistRepo;
    private ServiceRepository $serviceRepo;
    private AppointmentRepository $appointmentRepo;
    private NotificationRepository $notificationRepo;
    private RealtimeTicketRepository $ticketRepo;
    private RealtimeOutboxRepository $outboxRepo;

    private array $patientUser;
    private array $otherPatientUser;
    private array $dentistUser;
    private array $receptionistUser;
    private int $patientId;
    private int $dentistId;
    private int $serviceId;

    protected function setUp(): void
    {
        $_SESSION = [];
        InternalRequestSigner::clearNonceCache();
        putenv('REALTIME_ENABLED=true');
        putenv('REALTIME_INTERNAL_URL=http://127.0.0.1:49999');
        putenv('REALTIME_INTERNAL_SECRET=' . self::TEST_SECRET);
        putenv('REALTIME_TICKET_TTL_SECONDS=60');
        $_ENV['REALTIME_ENABLED'] = 'true';
        $_ENV['REALTIME_INTERNAL_URL'] = 'http://127.0.0.1:49999';
        $_ENV['REALTIME_INTERNAL_SECRET'] = self::TEST_SECRET;
        $_ENV['REALTIME_TICKET_TTL_SECONDS'] = '60';

        $this->pdo = TestDb::create();
        $this->app = new Application(null, false);

        $this->userRepo = new UserRepository();
        $this->patientRepo = new PatientRepository();
        $this->dentistRepo = new DentistRepository();
        $this->serviceRepo = new ServiceRepository();
        $this->appointmentRepo = new AppointmentRepository();
        $this->notificationRepo = new NotificationRepository();
        $this->ticketRepo = new RealtimeTicketRepository();
        $this->outboxRepo = new RealtimeOutboxRepository();

        // Patient 1
        $p1Uid = $this->userRepo->create('rt.patient1@example.com', password_hash('Pass123!', PASSWORD_BCRYPT), 'PATIENT', 1, 1);
        $this->patientUser = $this->userRepo->findById($p1Uid);
        $this->patientId = $this->patientRepo->create([
            'user_id' => $p1Uid,
            'first_name' => 'Ana',
            'last_name' => 'Cruz',
            'date_of_birth' => '1992-03-15',
            'phone' => '+639171000001',
            'gender' => 'FEMALE',
            'medical_alerts' => 'Severe latex allergy',
        ]);

        // Patient 2 (for ownership isolation tests)
        $p2Uid = $this->userRepo->create('rt.patient2@example.com', password_hash('Pass123!', PASSWORD_BCRYPT), 'PATIENT', 1, 1);
        $this->otherPatientUser = $this->userRepo->findById($p2Uid);

        // Dentist
        $dUid = $this->userRepo->create('rt.dentist@toothcare.local', password_hash('Pass123!', PASSWORD_BCRYPT), 'DENTIST', 1, 1);
        $this->dentistUser = $this->userRepo->findById($dUid);
        $this->dentistId = $this->dentistRepo->create([
            'user_id' => $dUid,
            'license_number' => 'PRC-RT-1001',
            'first_name' => 'Elena',
            'last_name' => 'Ramos',
            'specialization' => 'General Dentistry',
            'phone' => '+639171000002',
            'default_operatory_chair' => 'Chair 1',
            'is_active' => 1,
        ]);

        // Receptionist
        $rUid = $this->userRepo->create('rt.reception@toothcare.local', password_hash('Pass123!', PASSWORD_BCRYPT), 'RECEPTIONIST', 1, 1);
        $this->receptionistUser = $this->userRepo->findById($rUid);

        // Weekly schedule for Dentist (Mon-Sat 08:00-17:00)
        $schedRepo = new DentistScheduleRepository();
        for ($dow = 1; $dow <= 6; $dow++) {
            $schedRepo->create([
                'dentist_id' => $this->dentistId,
                'day_of_week' => $dow,
                'start_time' => '08:00:00',
                'end_time' => '17:00:00',
                'operatory_chair' => 'Chair 1',
                'is_active' => 1,
            ]);
        }

        // Active dental service
        $this->serviceId = $this->serviceRepo->create([
            'name' => 'Dental Prophylaxis',
            'category' => 'Preventive',
            'price' => 1500.00,
            'duration_minutes' => 45,
            'is_active' => 1,
        ]);
    }

    private function makeSignedInternalRequest(string $path, array $body, ?int $timestamp = null, ?string $nonce = null): Request
    {
        $rawBody = json_encode($body, JSON_UNESCAPED_SLASHES);
        $signer = new InternalRequestSigner(self::TEST_SECRET, 300);
        $signed = $signer->signHeaders('POST', $path, $rawBody, $timestamp, $nonce);
        $headers = array_change_key_case(array_merge(['Content-Type' => 'application/json'], $signed), CASE_LOWER);
        return Request::create('POST', $path, $headers, $rawBody);
    }

    public function testTicketIssuanceSingleUseVerificationAndSecurityGuards(): void
    {
        // 1. Unauthenticated ticket request fails (401)
        $unauthReq = Request::create('POST', '/api/v1/realtime/ticket', ['content-type' => 'application/json'], '{}');
        $unauthRes = $this->app->handle($unauthReq);
        $this->assertSame(401, $unauthRes->getStatusCode());

        // 2. Authenticated user receives short-lived opaque ticket; only SHA-256 hash stored in DB
        $req = Request::create('POST', '/api/v1/realtime/ticket', ['content-type' => 'application/json'], '{}');
        $req->setUser($this->dentistUser);
        $res = $this->app->handle($req);
        $this->assertSame(200, $res->getStatusCode());

        $data = json_decode($res->getBody(), true)['data'];
        $rawTicket = $data['ticket'];
        $this->assertSame(64, strlen($rawTicket));
        $this->assertSame(60, $data['expires_in']);

        $stored = $this->ticketRepo->findByHash(hash('sha256', $rawTicket));
        $this->assertNotNull($stored);
        $this->assertNotSame($rawTicket, $stored['ticket_hash']);

        // 3. Unsigned internal verification request is rejected (401)
        $unsignedVerify = Request::create(
            'POST',
            '/api/v1/internal/realtime/tickets/verify',
            ['content-type' => 'application/json'],
            json_encode(['ticket' => $rawTicket])
        );
        $this->assertSame(401, $this->app->handle($unsignedVerify)->getStatusCode());

        // 4. Signed internal verification succeeds once and returns verified dentist identity
        $verifyReq1 = $this->makeSignedInternalRequest('/api/v1/internal/realtime/tickets/verify', ['ticket' => $rawTicket]);
        $verifyRes1 = $this->app->handle($verifyReq1);
        $this->assertSame(200, $verifyRes1->getStatusCode());
        $identity = json_decode($verifyRes1->getBody(), true)['data'];
        $this->assertSame((int) $this->dentistUser['id'], $identity['user_id']);
        $this->assertSame('DENTIST', $identity['role']);
        $this->assertSame($this->dentistId, $identity['dentist_id']);

        // 5. Reusing the exact same single-use ticket fails (401 TICKET_ALREADY_USED)
        $verifyReq2 = $this->makeSignedInternalRequest('/api/v1/internal/realtime/tickets/verify', ['ticket' => $rawTicket]);
        $verifyRes2 = $this->app->handle($verifyReq2);
        $this->assertSame(401, $verifyRes2->getStatusCode());
        $err2 = json_decode($verifyRes2->getBody(), true)['error'];
        $this->assertSame('TICKET_ALREADY_USED', $err2['code']);

        // 6. Replaying a previously seen signed nonce fails (401 REPLAYED_NONCE)
        $replayNonce = bin2hex(random_bytes(16));
        $sessionReq1 = $this->makeSignedInternalRequest(
            '/api/v1/internal/realtime/sessions/verify',
            ['user_id' => (int) $this->dentistUser['id']],
            time(),
            $replayNonce
        );
        $this->assertSame(200, $this->app->handle($sessionReq1)->getStatusCode());

        $sessionReq2 = $this->makeSignedInternalRequest(
            '/api/v1/internal/realtime/sessions/verify',
            ['user_id' => (int) $this->dentistUser['id']],
            time(),
            $replayNonce
        );
        $this->assertSame(401, $this->app->handle($sessionReq2)->getStatusCode());
    }

    public function testExpiredRevokedAndInactiveUserTicketsAreRejected(): void
    {
        $ticketService = new RealtimeTicketService();

        // Expired ticket
        $issued = $ticketService->issueTicket($this->patientUser, 'sess-exp', time() - 120);
        try {
            $ticketService->verifyAndConsumeTicket($issued['ticket'], time());
            $this->fail('Expected expired ticket to be rejected');
        } catch (\App\Core\HttpException $e) {
            $this->assertSame('TICKET_EXPIRED', $e->getErrorCode());
        }

        // Revoked ticket (on logout)
        $issued2 = $ticketService->issueTicket($this->patientUser, 'sess-logout');
        $ticketService->revokeSessionTickets((int) $this->patientUser['id'], 'sess-logout');
        try {
            $ticketService->verifyAndConsumeTicket($issued2['ticket']);
            $this->fail('Expected revoked ticket to be rejected');
        } catch (\App\Core\HttpException $e) {
            $this->assertSame('TICKET_REVOKED', $e->getErrorCode());
        }

        // Deactivated account ticket
        $issued3 = $ticketService->issueTicket($this->patientUser, 'sess-deact');
        $this->userRepo->updateStatus((int) $this->patientUser['id'], 0);
        try {
            $ticketService->verifyAndConsumeTicket($issued3['ticket']);
            $this->fail('Expected inactive user ticket to be rejected');
        } catch (\App\Core\HttpException $e) {
            $this->assertSame('ACCOUNT_DISABLED', $e->getErrorCode());
        }

        $reval = $ticketService->verifyActiveIdentity((int) $this->patientUser['id']);
        $this->assertFalse($reval['active']);
    }

    public function testAppointmentLifecyclePersistsNotificationsAndQueuesMinimalOutboxAtomicallyEvenDuringOutage(): void
    {
        // Simulate realtime outage via failing transport
        $failingTransport = static fn () => ['status' => 503, 'body' => '', 'error' => 'Realtime service down'];
        $cfg = RealtimeConfig::fromEnvironment();
        $failingClient = new RealtimePublisherClient($cfg, null, null, $failingTransport);
        $outboxService = new RealtimeOutboxService($this->outboxRepo, $failingClient, $cfg);

        $appointmentService = new AppointmentService(
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            Database::getInstance(),
            null,
            $outboxService
        );

        // Pick a future weekday (Monday-Friday)
        $tz = new DateTimeZone('Asia/Manila');
        $day = (new DateTimeImmutable('now', $tz))->modify('+3 days');
        while ((int) $day->format('N') === 7) {
            $day = $day->modify('+1 day');
        }
        $startAt = $day->format('Y-m-d') . ' 10:00:00';

        // 1. Booking succeeds even while realtime service returns 503
        $created = $appointmentService->bookAppointment((int) $this->patientUser['id'], [
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => $startAt,
            'chief_complaint' => 'Private clinical tooth sensitivity notes',
        ]);
        $this->assertNotEmpty($created['id']);

        // Persistent notifications created for Patient, Dentist, and Receptionist
        $patientNotifs = $this->notificationRepo->findByUser((int) $this->patientUser['id']);
        $dentistNotifs = $this->notificationRepo->findByUser((int) $this->dentistUser['id']);
        $recepNotifs = $this->notificationRepo->findByUser((int) $this->receptionistUser['id']);
        $this->assertGreaterThanOrEqual(1, $patientNotifs['total']);
        $this->assertGreaterThanOrEqual(1, $dentistNotifs['total']);
        $this->assertGreaterThanOrEqual(1, $recepNotifs['total']);

        // Outbox events queued and marked FAILED_RETRYABLE (not lost!) with zero clinical PII in payload
        $rows = $this->pdo->query('SELECT * FROM realtime_outbox')->fetchAll(PDO::FETCH_ASSOC);
        $this->assertGreaterThanOrEqual(3, count($rows));
        foreach ($rows as $row) {
            $this->assertSame('appointment.requested', $row['event_type']);
            $this->assertSame('FAILED_RETRYABLE', $row['status']);
            $payload = json_decode($row['payload'], true);
            $this->assertArrayNotHasKey('chief_complaint', $payload);
            $this->assertArrayNotHasKey('diagnosis', $payload);
            $this->assertArrayNotHasKey('medical_alerts', $payload);
            $this->assertSame((int) $created['id'], $payload['appointmentId']);
        }

        // 2. When realtime service recovers, worker retries and marks rows PUBLISHED
        $deliveredEnvelopes = [];
        $okTransport = static function (string $url, string $method, array $headers, string $body) use (&$deliveredEnvelopes) {
            $deliveredEnvelopes[] = json_decode($body, true);
            return ['status' => 200, 'body' => json_encode(['ok' => true, 'duplicate' => false])];
        };
        $okClient = new RealtimePublisherClient($cfg, null, null, $okTransport);
        $recoveryService = new RealtimeOutboxService($this->outboxRepo, $okClient, $cfg);

        // Advance clock past 5s retry delay
        $batch = $recoveryService->processPendingBatch('test-worker', 20, time() + 30);
        $this->assertSame(count($rows), $batch['published']);
        $this->assertSame(count($rows), count($deliveredEnvelopes));

        // 3. Notification ownership check: Patient 2 cannot mark Patient 1's notification as read (403)
        $patient1NotifId = (int) $patientNotifs['items'][0]['id'];
        $hijackReq = Request::create('PATCH', "/api/v1/notifications/{$patient1NotifId}/read");
        $hijackReq->setUser($this->otherPatientUser);
        $hijackRes = $this->app->handle($hijackReq);
        $this->assertSame(403, $hijackRes->getStatusCode());
    }

    public function testRolledBackTransactionPublishesNoNotificationOrOutboxEvent(): void
    {
        $this->pdo->beginTransaction();
        $notifId = $this->notificationRepo->create([
            'user_id' => (int) $this->patientUser['id'],
            'role' => 'PATIENT',
            'type' => 'APPOINTMENT_CONFIRMED',
            'title' => 'Should rollback',
            'message' => 'Must not persist',
        ], $this->pdo);

        $outboxService = new RealtimeOutboxService($this->outboxRepo);
        $outboxService->enqueue(
            RealtimeOutboxService::EVENT_APPOINTMENT_CONFIRMED,
            (int) $this->patientUser['id'],
            $notifId,
            ['appointmentId' => 999, 'status' => 'confirmed'],
            $this->pdo
        );
        $this->pdo->rollBack();

        $this->assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM notifications')->fetchColumn());
        $this->assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM realtime_outbox')->fetchColumn());
    }
}
