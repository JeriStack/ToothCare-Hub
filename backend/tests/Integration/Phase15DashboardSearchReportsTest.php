<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Database;
use App\Core\Request;
use App\Repositories\UserRepository;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Phase 15 Integration Test Suite:
 * - Administrator & role-scoped dashboard metrics against known synthetic datasets
 * - Appointment search & combined filter validation (dates, dentist, patient, service, status)
 * - Global pagination bounds, clamping, and deterministic tie-breaker ordering (120+ rows)
 * - Operational reports (appointments, services utilization, dentists workload, patients trend)
 * - Safe operational views (outbox health & redacted error feeds)
 * - Strict server-side RBAC/DRBAC & ownership isolation
 */
class Phase15DashboardSearchReportsTest extends TestCase
{
    private Application $app;
    private PDO $pdo;
    private UserRepository $userRepo;
    private DateTimeZone $tz;

    private array $adminUser;
    private array $receptionistUser;
    private array $dentist1User;
    private array $dentist2User;
    private array $patient1User;
    private array $patient2User;

    private int $dentist1Id;
    private int $dentist2Id;
    private int $patient1Id;
    private int $patient2Id;
    private int $service1Id;
    private int $service2Id;

    protected function setUp(): void
    {
        $_SESSION = [];
        TestDb::create();
        $this->app = new Application(null, false);
        $this->pdo = Database::getInstance()->getConnection();
        $this->userRepo = new UserRepository();
        $this->tz = new DateTimeZone('Asia/Manila');

        $hash = password_hash('Password123!', PASSWORD_BCRYPT);

        $adminId = $this->userRepo->create('p15.admin@toothcare.local', $hash, 'ADMIN', 1, 1);
        $this->adminUser = $this->userRepo->findById($adminId);

        $recId = $this->userRepo->create('p15.receptionist@toothcare.local', $hash, 'RECEPTIONIST', 1, 1);
        $this->receptionistUser = $this->userRepo->findById($recId);

        $d1UserId = $this->userRepo->create('p15.dentist1@toothcare.local', $hash, 'DENTIST', 1, 1);
        $this->dentist1User = $this->userRepo->findById($d1UserId);
        $this->pdo->prepare("INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone, is_active) VALUES (?, 'Elena', 'Reyes', 'General', 'LIC-P15-1', '09171000001', 1)")
            ->execute([$d1UserId]);
        $this->dentist1Id = (int) $this->pdo->lastInsertId();

        $d2UserId = $this->userRepo->create('p15.dentist2@toothcare.local', $hash, 'DENTIST', 1, 1);
        $this->dentist2User = $this->userRepo->findById($d2UserId);
        $this->pdo->prepare("INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone, is_active) VALUES (?, 'Marco', 'Lim', 'Orthodontics', 'LIC-P15-2', '09171000002', 1)")
            ->execute([$d2UserId]);
        $this->dentist2Id = (int) $this->pdo->lastInsertId();

        // Inactive dentist (profile inactive) + suspended dentist (user inactive) — must NOT count as active
        $d3UserId = $this->userRepo->create('p15.dentist3@toothcare.local', $hash, 'DENTIST', 1, 1);
        $this->pdo->prepare("INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone, is_active) VALUES (?, 'Inactive', 'Profile', 'Surgery', 'LIC-P15-3', '09171000003', 0)")
            ->execute([$d3UserId]);

        $d4UserId = $this->userRepo->create('p15.dentist4@toothcare.local', $hash, 'DENTIST', 0, 1);
        $this->pdo->prepare("INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone, is_active) VALUES (?, 'Suspended', 'Account', 'Surgery', 'LIC-P15-4', '09171000004', 1)")
            ->execute([$d4UserId]);

        // Patients (2 active + 1 inactive)
        $p1UserId = $this->userRepo->create('p15.patient1@toothcare.local', $hash, 'PATIENT', 1, 1);
        $this->patient1User = $this->userRepo->findById($p1UserId);
        $this->pdo->prepare("INSERT INTO patients (user_id, first_name, last_name, date_of_birth, phone, gender) VALUES (?, 'Juan', 'Cruz', '1992-05-10', '09172000001', 'MALE')")
            ->execute([$p1UserId]);
        $this->patient1Id = (int) $this->pdo->lastInsertId();

        $p2UserId = $this->userRepo->create('p15.patient2@toothcare.local', $hash, 'PATIENT', 1, 1);
        $this->patient2User = $this->userRepo->findById($p2UserId);
        $this->pdo->prepare("INSERT INTO patients (user_id, first_name, last_name, date_of_birth, phone, gender) VALUES (?, 'Maria', 'Santos', '1994-08-20', '09172000002', 'FEMALE')")
            ->execute([$p2UserId]);
        $this->patient2Id = (int) $this->pdo->lastInsertId();

        $p3UserId = $this->userRepo->create('p15.patient3@toothcare.local', $hash, 'PATIENT', 0, 1);
        $this->pdo->prepare("INSERT INTO patients (user_id, first_name, last_name, date_of_birth, phone, gender) VALUES (?, 'Archived', 'Patient', '1988-01-01', '09172000003', 'OTHER')")
            ->execute([$p3UserId]);

        // Services (2 active + 1 inactive)
        $this->pdo->exec("INSERT INTO services (name, category, price, duration_minutes, is_active) VALUES ('Oral Prophylaxis', 'Preventive', 1500.00, 30, 1)");
        $this->service1Id = (int) $this->pdo->lastInsertId();

        $this->pdo->exec("INSERT INTO services (name, category, price, duration_minutes, is_active) VALUES ('Tooth Extraction', 'Surgery', 2500.00, 45, 1)");
        $this->service2Id = (int) $this->pdo->lastInsertId();

        $this->pdo->exec("INSERT INTO services (name, category, price, duration_minutes, is_active) VALUES ('Legacy Discontinued Service', 'Other', 500.00, 30, 0)");
    }

    private function authRequest(string $method, string $uri, array $user, array $query = []): Request
    {
        $req = Request::create($method, $uri, [], '', $query);
        $req->setUser($user);
        return $req;
    }

    private function insertAppointment(
        int $patientId,
        int $dentistId,
        int $serviceId,
        string $startAt,
        string $endAt,
        string $status
    ): int {
        $stmt = $this->pdo->prepare('
            INSERT INTO appointments (
                patient_id, dentist_id, service_id, start_at, end_at,
                duration_snapshot, price_snapshot, status, operatory_chair, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 30, 1500.00, ?, \'Chair 1\', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ');
        $stmt->execute([$patientId, $dentistId, $serviceId, $startAt, $endAt, $status]);
        return (int) $this->pdo->lastInsertId();
    }

    public function testAdminDashboardReturnsExactSevenMetricsAgainstKnownDataset(): void
    {
        $now = new DateTimeImmutable('now', $this->tz);
        $tomorrowStart = $now->modify('+1 day')->format('Y-m-d 10:00:00');
        $tomorrowEnd = $now->modify('+1 day')->format('Y-m-d 10:30:00');
        $nextWeekStart = $now->modify('+5 days')->format('Y-m-d 14:00:00');
        $nextWeekEnd = $now->modify('+5 days')->format('Y-m-d 14:30:00');
        $yesterdayStart = $now->modify('-1 day')->format('Y-m-d 09:00:00');
        $yesterdayEnd = $now->modify('-1 day')->format('Y-m-d 09:30:00');

        // 2 Pending (1 future, 1 past), 2 Confirmed (1 future, 1 past), 2 Completed, 1 Cancelled, 1 Rejected
        $this->insertAppointment($this->patient1Id, $this->dentist1Id, $this->service1Id, $tomorrowStart, $tomorrowEnd, 'PENDING');
        $this->insertAppointment($this->patient2Id, $this->dentist2Id, $this->service2Id, $yesterdayStart, $yesterdayEnd, 'PENDING');
        $this->insertAppointment($this->patient1Id, $this->dentist1Id, $this->service1Id, $nextWeekStart, $nextWeekEnd, 'CONFIRMED');
        $this->insertAppointment($this->patient2Id, $this->dentist2Id, $this->service1Id, $yesterdayStart, $yesterdayEnd, 'CONFIRMED');
        $this->insertAppointment($this->patient1Id, $this->dentist1Id, $this->service1Id, $yesterdayStart, $yesterdayEnd, 'COMPLETED');
        $this->insertAppointment($this->patient2Id, $this->dentist2Id, $this->service2Id, $yesterdayStart, $yesterdayEnd, 'COMPLETED');
        $this->insertAppointment($this->patient1Id, $this->dentist2Id, $this->service2Id, $tomorrowStart, $tomorrowEnd, 'CANCELLED');
        $this->insertAppointment($this->patient2Id, $this->dentist1Id, $this->service1Id, $tomorrowStart, $tomorrowEnd, 'REJECTED');

        $res = $this->app->handle($this->authRequest('GET', '/api/v1/admin/dashboard/summary', $this->adminUser));
        $this->assertSame(200, $res->getStatusCode());

        $payload = json_decode($res->getBody(), true)['data'];
        $counts = $payload['counts'];

        // Verify all 7 required metrics match exact DB ground truth
        $this->assertSame(3, $counts['patients']['total']);
        $this->assertSame(2, $counts['patients']['active']);
        $this->assertSame(2, $counts['dentists']['active']); // Excludes inactive profile AND suspended user
        $this->assertSame(2, $counts['services']['active']); // Excludes inactive service
        $this->assertSame(2, $counts['appointments']['pending']);
        $this->assertSame(2, $counts['appointments']['upcoming']); // Only future PENDING (1) + future CONFIRMED (1)
        $this->assertSame(2, $counts['appointments']['completed']);
        $this->assertSame(1, $counts['appointments']['cancelled']);
        $this->assertSame(8, $counts['appointments']['total']);

        $this->assertCount(14, $payload['appointment_trends']);
        $this->assertArrayHasKey('outbox_summary', $payload);
        $this->assertArrayHasKey('recent_errors', $payload);
    }

    public function testAppointmentSearchCombinedFiltersAndValidation(): void
    {
        $this->insertAppointment($this->patient1Id, $this->dentist1Id, $this->service1Id, '2026-12-01 09:00:00', '2026-12-01 09:30:00', 'CONFIRMED');
        $this->insertAppointment($this->patient2Id, $this->dentist2Id, $this->service2Id, '2026-12-05 11:00:00', '2026-12-05 11:30:00', 'PENDING');
        $this->insertAppointment($this->patient1Id, $this->dentist1Id, $this->service2Id, '2026-12-10 15:00:00', '2026-12-10 15:30:00', 'COMPLETED');

        // Combined filter: date range + dentist + service + status
        $res = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, [
            'start_date' => '2026-12-01',
            'end_date' => '2026-12-06',
            'dentist_id' => (string) $this->dentist2Id,
            'service_id' => (string) $this->service2Id,
            'status' => 'PENDING',
        ]));
        $this->assertSame(200, $res->getStatusCode());
        $body = json_decode($res->getBody(), true);
        $this->assertCount(1, $body['data']);
        $this->assertSame($this->patient2Id, (int) $body['data'][0]['patient_id']);

        // Reject end_date < start_date
        $badRange = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, [
            'start_date' => '2026-12-10',
            'end_date' => '2026-12-01',
        ]));
        $this->assertSame(422, $badRange->getStatusCode());

        // Reject invalid status
        $badStatus = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, [
            'status' => 'HACKED_STATUS',
        ]));
        $this->assertSame(422, $badStatus->getStatusCode());

        // Reject invalid dentist_id
        $badId = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, [
            'dentist_id' => 'not-an-id',
        ]));
        $this->assertSame(422, $badId->getStatusCode());
    }

    public function testRoleScopedAppointmentSearchPreventsScopeEscalation(): void
    {
        $this->insertAppointment($this->patient1Id, $this->dentist1Id, $this->service1Id, '2026-12-02 09:00:00', '2026-12-02 09:30:00', 'CONFIRMED');
        $this->insertAppointment($this->patient2Id, $this->dentist2Id, $this->service2Id, '2026-12-03 10:00:00', '2026-12-03 10:30:00', 'PENDING');

        // Patient 1 tries to pass patient_id=patient2Id — MUST still only see Patient 1's own appointment
        $patRes = $this->app->handle($this->authRequest('GET', '/api/v1/appointments/search', $this->patient1User, [
            'patient_id' => (string) $this->patient2Id,
        ]));
        $this->assertSame(200, $patRes->getStatusCode());
        $patData = json_decode($patRes->getBody(), true)['data'];
        $this->assertCount(1, $patData);
        $this->assertSame($this->patient1Id, (int) $patData[0]['patient_id']);

        // Dentist 1 tries to pass dentist_id=dentist2Id — MUST still only see Dentist 1's own appointment
        $docRes = $this->app->handle($this->authRequest('GET', '/api/v1/appointments/search', $this->dentist1User, [
            'dentist_id' => (string) $this->dentist2Id,
        ]));
        $this->assertSame(200, $docRes->getStatusCode());
        $docData = json_decode($docRes->getBody(), true)['data'];
        $this->assertCount(1, $docData);
        $this->assertSame($this->dentist1Id, (int) $docData[0]['dentist_id']);

        // Receptionist can search clinic-wide
        $recRes = $this->app->handle($this->authRequest('GET', '/api/v1/appointments/search', $this->receptionistUser));
        $this->assertSame(200, $recRes->getStatusCode());
        $this->assertCount(2, json_decode($recRes->getBody(), true)['data']);
    }

    public function testPaginationBoundsClampingAndDeterministicOrderingOnSyntheticDataset(): void
    {
        // Insert 120 appointments sharing the exact same start_at timestamp to stress tie-breaking
        for ($i = 0; $i < 120; $i++) {
            $this->insertAppointment(
                $i % 2 === 0 ? $this->patient1Id : $this->patient2Id,
                $this->dentist1Id,
                $this->service1Id,
                '2026-12-15 09:00:00',
                '2026-12-15 09:30:00',
                'CONFIRMED'
            );
        }

        // Request above maximum limit (500) -> must clamp to 100
        $clampedRes = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, [
            'page' => '1',
            'limit' => '500',
        ]));
        $this->assertSame(200, $clampedRes->getStatusCode());
        $clampedBody = json_decode($clampedRes->getBody(), true);
        $this->assertCount(100, $clampedBody['data']);
        $this->assertSame(100, $clampedBody['meta']['per_page']);
        $this->assertSame(120, $clampedBody['meta']['total']);
        $this->assertSame(2, $clampedBody['meta']['last_page']);

        // Page 1 and Page 2 must have zero duplicate IDs (deterministic ORDER BY start_at DESC, id DESC)
        $p1 = json_decode($this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, ['page' => '1', 'per_page' => '20']))->getBody(), true);
        $p2 = json_decode($this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, ['page' => '2', 'per_page' => '20']))->getBody(), true);
        $ids1 = array_column($p1['data'], 'id');
        $ids2 = array_column($p2['data'], 'id');
        $this->assertCount(20, $ids1);
        $this->assertCount(20, $ids2);
        $this->assertSame([], array_intersect($ids1, $ids2));

        // Dentist endpoint also enforces SQL-level pagination & max 100 clamping
        $docPaged = json_decode($this->app->handle($this->authRequest('GET', '/api/v1/dentist/appointments', $this->dentist1User, ['page' => '1', 'limit' => '250']))->getBody(), true);
        $this->assertCount(100, $docPaged['data']['items']);
        $this->assertSame(100, $docPaged['data']['meta']['per_page']);
        $this->assertSame(120, $docPaged['data']['meta']['total']);
    }

    public function testReportsEndpointsValidateDatesAndReturnRealDatabaseAggregates(): void
    {
        $now = new DateTimeImmutable('now', $this->tz);
        $today = $now->format('Y-m-d');
        $futureStart = $now->modify('+2 days')->format('Y-m-d 10:00:00');
        $futureEnd = $now->modify('+2 days')->format('Y-m-d 10:30:00');
        $endDate = $now->modify('+5 days')->format('Y-m-d');

        $this->insertAppointment($this->patient1Id, $this->dentist1Id, $this->service1Id, $futureStart, $futureEnd, 'CONFIRMED');
        $this->insertAppointment($this->patient2Id, $this->dentist1Id, $this->service1Id, $today . ' 08:00:00', $today . ' 08:30:00', 'COMPLETED');
        $this->insertAppointment($this->patient2Id, $this->dentist2Id, $this->service2Id, $today . ' 09:00:00', $today . ' 09:30:00', 'CANCELLED');

        // Service utilization report
        $svcRes = $this->app->handle($this->authRequest('GET', '/api/v1/admin/reports/services', $this->adminUser, [
            'start_date' => $today,
            'end_date' => $endDate,
        ]));
        $this->assertSame(200, $svcRes->getStatusCode());
        $svcData = json_decode($svcRes->getBody(), true)['data'];
        $this->assertSame(3, $svcData['total_appointments']);
        $this->assertSame('Oral Prophylaxis', $svcData['services'][0]['name']);
        $this->assertSame(2, $svcData['services'][0]['total_booked']);
        $this->assertSame(1, $svcData['services'][0]['upcoming_count']);
        $this->assertArrayNotHasKey('realized_revenue', $svcData['services'][0]);

        // Patient registration report
        $patRes = $this->app->handle($this->authRequest('GET', '/api/v1/admin/reports/patients', $this->adminUser, [
            'start_date' => $today,
            'end_date' => $endDate,
        ]));
        $this->assertSame(200, $patRes->getStatusCode());
        $patData = json_decode($patRes->getBody(), true)['data'];
        $this->assertSame(3, $patData['total_patients']);
        $this->assertSame(2, $patData['active_patients']);
        $this->assertSame(1, $patData['inactive_patients']);

        // Dentist workload report includes upcoming_count
        $docRes = $this->app->handle($this->authRequest('GET', '/api/v1/admin/reports/dentists', $this->adminUser, [
            'start_date' => $today,
            'end_date' => $endDate,
        ]));
        $this->assertSame(200, $docRes->getStatusCode());
        $docData = json_decode($docRes->getBody(), true)['data'];
        $this->assertSame(2, $docData['dentists'][0]['total_assigned']);
        $this->assertSame(1, $docData['dentists'][0]['upcoming_count']);

        // Appointments report with combined date, dentist, service, and status filters returns counts + filterable appointment list
        $apptReportRes = $this->app->handle($this->authRequest('GET', '/api/v1/admin/reports/appointments', $this->adminUser, [
            'start_date' => $today,
            'end_date' => $endDate,
            'dentist_id' => (string) $this->dentist1Id,
            'service_id' => (string) $this->service1Id,
            'status' => 'COMPLETED',
        ]));
        $this->assertSame(200, $apptReportRes->getStatusCode());
        $apptReportData = json_decode($apptReportRes->getBody(), true)['data'];
        $this->assertSame(1, $apptReportData['total_appointments']);
        $this->assertSame(1, $apptReportData['completed_count']);
        $this->assertCount(1, $apptReportData['appointments']);
        $this->assertSame($this->patient2Id, $apptReportData['appointments'][0]['patient_id']);
        $this->assertSame('Oral Prophylaxis', $apptReportData['appointments'][0]['service_name']);

        // Reject invalid filter values on appointments report
        $this->assertSame(422, $this->app->handle($this->authRequest('GET', '/api/v1/admin/reports/appointments', $this->adminUser, [
            'dentist_id' => 'invalid',
        ]))->getStatusCode());
        $this->assertSame(422, $this->app->handle($this->authRequest('GET', '/api/v1/admin/reports/appointments', $this->adminUser, [
            'status' => 'UNKNOWN_STATUS',
        ]))->getStatusCode());

        // Reject invalid date range
        $badRes = $this->app->handle($this->authRequest('GET', '/api/v1/admin/reports/services', $this->adminUser, [
            'start_date' => '2026-12-20',
            'end_date' => '2026-12-01',
        ]));
        $this->assertSame(422, $badRes->getStatusCode());

        // Non-admin roles are forbidden from reports
        $this->assertSame(403, $this->app->handle($this->authRequest('GET', '/api/v1/admin/reports/services', $this->patient1User))->getStatusCode());
        $this->assertSame(403, $this->app->handle($this->authRequest('GET', '/api/v1/admin/reports/patients', $this->dentist1User))->getStatusCode());
    }

    public function testOperationalViewsEnforceAuthorizationAndRedactSensitiveDetails(): void
    {
        // Insert a failed realtime_outbox record containing a raw path and secret token
        $this->pdo->prepare("
            INSERT INTO realtime_outbox (event_id, event_type, recipient_user_id, payload, status, attempt_count, max_attempts, last_error)
            VALUES ('evt-p15-fail', 'appointment.created', ?, '{}', 'FAILED_PERMANENT', 5, 5, 'Connection failed at /var/www/app/secret.php token=supersecret123 Stack trace: #0 main')
        ")->execute([$this->patient1User['id']]);

        // Unauthorized roles must be blocked
        $this->assertSame(403, $this->app->handle($this->authRequest('GET', '/api/v1/admin/operations/outbox', $this->patient1User))->getStatusCode());
        $this->assertSame(403, $this->app->handle($this->authRequest('GET', '/api/v1/admin/operations/errors', $this->receptionistUser))->getStatusCode());

        // Admin can inspect outbox (realtime channel)
        $outboxRes = $this->app->handle($this->authRequest('GET', '/api/v1/admin/operations/outbox', $this->adminUser, [
            'channel' => 'realtime',
            'per_page' => '10',
        ]));
        $this->assertSame(200, $outboxRes->getStatusCode());
        $outboxBody = json_decode($outboxRes->getBody(), true)['data'];
        $this->assertSame(1, $outboxBody['summary']['realtime_outbox']['failed_permanent']);
        $this->assertCount(1, $outboxBody['items']);
        $this->assertStringNotContainsString('supersecret123', (string) $outboxBody['items'][0]['last_error']);
        $this->assertStringNotContainsString('/var/www/app', (string) $outboxBody['items'][0]['last_error']);
        $this->assertStringNotContainsString('Stack trace', (string) $outboxBody['items'][0]['last_error']);

        // Admin can inspect operational errors (redacted)
        $errRes = $this->app->handle($this->authRequest('GET', '/api/v1/admin/operations/errors', $this->adminUser));
        $this->assertSame(200, $errRes->getStatusCode());
        $errBody = json_decode($errRes->getBody(), true);
        $this->assertGreaterThanOrEqual(1, count($errBody['data']));
        $this->assertStringNotContainsString('supersecret123', (string) $errBody['data'][0]['summary']);
    }
}
