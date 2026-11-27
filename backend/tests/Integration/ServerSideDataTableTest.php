<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Database;
use App\Core\Request;
use App\Repositories\UserRepository;
use PDO;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Production-Ready Server-Side Data Tables Integration, Security & Performance Suite
 *
 * Covers:
 * - Server-side pagination, custom per_page, max per_page clamping, invalid page/per_page rejection (422)
 * - Allowlisted deterministic sorting + SQL injection rejection on sort_by / sort_dir (422)
 * - Safe literal wildcard escaping (%, _, !) in global search
 * - Multi-field filtering, date range boundaries, and inverted range validation (422)
 * - Separate unfiltered total_records vs filtered_records counts + empty result handling
 * - Strict RBAC/DRBAC authorization and patient/dentist ownership scoping (counts never leak unauthorized records)
 * - Synthetic 1,000-row dataset latency & SQLite EXPLAIN QUERY PLAN index verification
 */
class ServerSideDataTableTest extends TestCase
{
    private Application $app;
    private PDO $pdo;
    private UserRepository $userRepo;

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

        $hash = password_hash('Password123!', PASSWORD_BCRYPT);

        $adminId = $this->userRepo->create('sdt.admin@toothcare.local', $hash, 'ADMIN', 1, 1);
        $this->adminUser = $this->userRepo->findById($adminId);

        $recId = $this->userRepo->create('sdt.receptionist@toothcare.local', $hash, 'RECEPTIONIST', 1, 1);
        $this->receptionistUser = $this->userRepo->findById($recId);

        $d1UserId = $this->userRepo->create('sdt.dentist1@toothcare.local', $hash, 'DENTIST', 1, 1);
        $this->dentist1User = $this->userRepo->findById($d1UserId);
        $this->pdo->prepare("INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone, is_active) VALUES (?, 'Elena', 'Reyes', 'General', 'LIC-SDT-1', '09171001001', 1)")
            ->execute([$d1UserId]);
        $this->dentist1Id = (int) $this->pdo->lastInsertId();

        $d2UserId = $this->userRepo->create('sdt.dentist2@toothcare.local', $hash, 'DENTIST', 1, 1);
        $this->dentist2User = $this->userRepo->findById($d2UserId);
        $this->pdo->prepare("INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone, is_active) VALUES (?, 'Marco', 'Alvarez', 'Orthodontics', 'LIC-SDT-2', '09171001002', 1)")
            ->execute([$d2UserId]);
        $this->dentist2Id = (int) $this->pdo->lastInsertId();

        $p1UserId = $this->userRepo->create('sdt.patient1@toothcare.local', $hash, 'PATIENT', 1, 1);
        $this->patient1User = $this->userRepo->findById($p1UserId);
        $this->pdo->prepare("INSERT INTO patients (user_id, first_name, last_name, date_of_birth, phone, gender) VALUES (?, 'Ana', 'Villanueva', '1993-02-14', '09172001001', 'FEMALE')")
            ->execute([$p1UserId]);
        $this->patient1Id = (int) $this->pdo->lastInsertId();

        $p2UserId = $this->userRepo->create('sdt.patient2@toothcare.local', $hash, 'PATIENT', 1, 1);
        $this->patient2User = $this->userRepo->findById($p2UserId);
        $this->pdo->prepare("INSERT INTO patients (user_id, first_name, last_name, date_of_birth, phone, gender) VALUES (?, '50%_Discount', 'Bautista', '1990-07-07', '09172001002', 'MALE')")
            ->execute([$p2UserId]);
        $this->patient2Id = (int) $this->pdo->lastInsertId();

        $this->pdo->exec("INSERT INTO services (name, category, price, duration_minutes, is_active) VALUES ('Dental Prophylaxis', 'Preventive', 1200.00, 30, 1)");
        $this->service1Id = (int) $this->pdo->lastInsertId();

        $this->pdo->exec("INSERT INTO services (name, category, price, duration_minutes, is_active) VALUES ('Zirconia Crown', 'Restorative', 8500.00, 60, 1)");
        $this->service2Id = (int) $this->pdo->lastInsertId();
    }

    private function authRequest(string $method, string $uri, ?array $user, array $query = []): Request
    {
        $req = Request::create($method, $uri, [], '', $query);
        if ($user !== null) {
            $req->setUser($user);
        }
        return $req;
    }

    private function insertAppointment(
        int $patientId,
        int $dentistId,
        int $serviceId,
        string $startAt,
        string $endAt,
        string $status = 'CONFIRMED'
    ): int {
        $stmt = $this->pdo->prepare("
            INSERT INTO appointments (
                patient_id, dentist_id, service_id, start_at, end_at,
                duration_snapshot, price_snapshot, status, operatory_chair, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 30, 1200.00, ?, 'Chair 1', NOW(), NOW())
        ");
        $stmt->execute([$patientId, $dentistId, $serviceId, $startAt, $endAt, $status]);
        return (int) $this->pdo->lastInsertId();
    }

    private function decodeBody(\App\Core\Response $response): array
    {
        $decoded = json_decode($response->getBody(), true);
        $this->assertIsArray($decoded, 'Expected JSON array response body');
        return $decoded;
    }

    public function testPaginationBoundsClampingAndInvalidParameterRejection(): void
    {
        for ($i = 1; $i <= 12; $i++) {
            $day = str_pad((string) $i, 2, '0', STR_PAD_LEFT);
            $this->insertAppointment(
                $i % 2 === 0 ? $this->patient1Id : $this->patient2Id,
                $this->dentist1Id,
                $this->service1Id,
                "2026-12-{$day} 09:00:00",
                "2026-12-{$day} 09:30:00",
                $i <= 4 ? 'PENDING' : 'CONFIRMED'
            );
        }

        // Custom per_page & page navigation
        $res = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, [
            'page' => '2',
            'per_page' => '5',
        ]));
        $this->assertSame(200, $res->getStatusCode());
        $body = $this->decodeBody($res);
        $this->assertCount(5, $body['data']);
        $this->assertSame(12, $body['meta']['total_records']);
        $this->assertSame(12, $body['meta']['filtered_records']);
        $this->assertSame(2, $body['meta']['current_page']);
        $this->assertSame(5, $body['meta']['per_page']);
        $this->assertSame(3, $body['meta']['total_pages']);

        // Excessive per_page is safely clamped to 100
        $resClamped = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, [
            'per_page' => '9999',
        ]));
        $this->assertSame(200, $resClamped->getStatusCode());
        $this->assertSame(100, $this->decodeBody($resClamped)['meta']['per_page']);

        // Invalid page values rejected with 422
        foreach (['0', '-3', 'abc', '1.5'] as $badPage) {
            $badRes = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, [
                'page' => $badPage,
            ]));
            $this->assertSame(422, $badRes->getStatusCode(), "Expected 422 for page={$badPage}");
        }

        // Invalid per_page values rejected with 422
        foreach (['0', '-10', 'ten'] as $badPerPage) {
            $badRes = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, [
                'per_page' => $badPerPage,
            ]));
            $this->assertSame(422, $badRes->getStatusCode(), "Expected 422 for per_page={$badPerPage}");
        }
    }

    public function testAllowlistedDeterministicSortingAndSqlInjectionRejection(): void
    {
        // Two rows with identical start_at to verify deterministic tie-breaker (a.id)
        $id1 = $this->insertAppointment($this->patient1Id, $this->dentist1Id, $this->service2Id, '2026-12-10 10:00:00', '2026-12-10 11:00:00', 'CONFIRMED');
        $id2 = $this->insertAppointment($this->patient2Id, $this->dentist2Id, $this->service1Id, '2026-12-10 10:00:00', '2026-12-10 10:30:00', 'PENDING');

        // Sort by patient_name ASC => Bautista (id2) before Villanueva (id1)
        $resPatientAsc = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, [
            'sort_by' => 'patient_name',
            'sort_dir' => 'asc',
        ]));
        $this->assertSame(200, $resPatientAsc->getStatusCode());
        $body = $this->decodeBody($resPatientAsc);
        $this->assertSame($id2, (int) $body['data'][0]['id']);
        $this->assertSame($id1, (int) $body['data'][1]['id']);
        $this->assertSame(['sort_by' => 'patient_name', 'sort_dir' => 'asc'], $body['meta']['sorting']);

        // Sort by dentist_name ASC => Alvarez (id2) before Reyes (id1)
        $resDentistAsc = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, [
            'sort_by' => 'dentist_name',
            'sort_dir' => 'asc',
        ]));
        $this->assertSame(200, $resDentistAsc->getStatusCode());
        $this->assertSame($id2, (int) $this->decodeBody($resDentistAsc)['data'][0]['id']);

        // Sort by start_at DESC with identical timestamps => deterministic id DESC (id2 before id1)
        $resTieDesc = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, [
            'sort_by' => 'start_at',
            'sort_dir' => 'desc',
        ]));
        $this->assertSame(200, $resTieDesc->getStatusCode());
        $tieBody = $this->decodeBody($resTieDesc);
        $this->assertSame($id2, (int) $tieBody['data'][0]['id']);
        $this->assertSame($id1, (int) $tieBody['data'][1]['id']);

        // Reject SQL injection & non-allowlisted sort columns with 422
        foreach (['password_hash', 'start_at; DROP TABLE appointments--', '1=1'] as $maliciousSort) {
            $resBadSort = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, [
                'sort_by' => $maliciousSort,
            ]));
            $this->assertSame(422, $resBadSort->getStatusCode(), "Expected 422 for sort_by={$maliciousSort}");
        }

        // Reject invalid sort direction
        $resBadDir = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, [
            'sort_by' => 'start_at',
            'sort_dir' => 'sideways',
        ]));
        $this->assertSame(422, $resBadDir->getStatusCode());
    }

    public function testWildcardEscapingMultiFieldFiltersTotalVsFilteredCountsAndEmptyState(): void
    {
        $this->insertAppointment($this->patient1Id, $this->dentist1Id, $this->service1Id, '2026-12-01 09:00:00', '2026-12-01 09:30:00', 'CONFIRMED');
        $this->insertAppointment($this->patient1Id, $this->dentist2Id, $this->service2Id, '2026-12-05 14:00:00', '2026-12-05 15:00:00', 'PENDING');
        $idWild = $this->insertAppointment($this->patient2Id, $this->dentist1Id, $this->service1Id, '2026-12-10 11:00:00', '2026-12-10 11:30:00', 'CONFIRMED');

        // Literal %_ search must match ONLY patient2 ("50%_Discount") — NOT all rows via unescaped SQL wildcard
        $resWild = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, [
            'search' => '50%_',
        ]));
        $this->assertSame(200, $resWild->getStatusCode());
        $wildBody = $this->decodeBody($resWild);
        $this->assertCount(1, $wildBody['data']);
        $this->assertSame($idWild, (int) $wildBody['data'][0]['id']);
        $this->assertSame(3, $wildBody['meta']['total_records']);
        $this->assertSame(1, $wildBody['meta']['filtered_records']);

        // Combined filters: status + dentist + date range
        $resCombined = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, [
            'status' => 'PENDING',
            'dentist_id' => (string) $this->dentist2Id,
            'start_date' => '2026-12-04',
            'end_date' => '2026-12-06',
        ]));
        $this->assertSame(200, $resCombined->getStatusCode());
        $combinedBody = $this->decodeBody($resCombined);
        $this->assertSame(3, $combinedBody['meta']['total_records']);
        $this->assertSame(1, $combinedBody['meta']['filtered_records']);

        // Empty result set returns [] with accurate total_records vs filtered_records = 0
        $resEmpty = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, [
            'search' => 'NonExistentPatientXYZ',
        ]));
        $this->assertSame(200, $resEmpty->getStatusCode());
        $emptyBody = $this->decodeBody($resEmpty);
        $this->assertSame([], $emptyBody['data']);
        $this->assertSame(3, $emptyBody['meta']['total_records']);
        $this->assertSame(0, $emptyBody['meta']['filtered_records']);
        $this->assertSame(1, $emptyBody['meta']['total_pages']);

        // Inverted date range rejected with 422
        $resInverted = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, [
            'start_date' => '2026-12-20',
            'end_date' => '2026-12-01',
        ]));
        $this->assertSame(422, $resInverted->getStatusCode());
    }

    public function testAuthorizationAndOwnershipScopingPreventUnauthorizedCountLeakage(): void
    {
        // Patient 1 has 2 appointments (1 PENDING, 1 CONFIRMED); Patient 2 has 3 appointments
        $this->insertAppointment($this->patient1Id, $this->dentist1Id, $this->service1Id, '2026-12-01 09:00:00', '2026-12-01 09:30:00', 'PENDING');
        $this->insertAppointment($this->patient1Id, $this->dentist2Id, $this->service1Id, '2026-12-02 09:00:00', '2026-12-02 09:30:00', 'CONFIRMED');
        $this->insertAppointment($this->patient2Id, $this->dentist1Id, $this->service1Id, '2026-12-03 09:00:00', '2026-12-03 09:30:00', 'CONFIRMED');
        $this->insertAppointment($this->patient2Id, $this->dentist1Id, $this->service2Id, '2026-12-04 09:00:00', '2026-12-04 10:00:00', 'PENDING');
        $this->insertAppointment($this->patient2Id, $this->dentist2Id, $this->service2Id, '2026-12-05 09:00:00', '2026-12-05 10:00:00', 'COMPLETED');

        // 1. Unauthenticated blocked with 401
        $unauth = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', null));
        $this->assertSame(401, $unauth->getStatusCode());

        // 2. Patient blocked from admin table with 403
        $patientDenied = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->patient1User));
        $this->assertSame(403, $patientDenied->getStatusCode());

        // 3. Receptionist allowed on admin table
        $recAllowed = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->receptionistUser));
        $this->assertSame(200, $recAllowed->getStatusCode());
        $this->assertSame(5, $this->decodeBody($recAllowed)['meta']['total_records']);

        // 4. Patient scoped /appointments/search: total_records MUST be 2 (own rows only), NEVER 5
        $patientSearch = $this->app->handle($this->authRequest('GET', '/api/v1/appointments/search', $this->patient1User, [
            'status' => 'PENDING',
        ]));
        $this->assertSame(200, $patientSearch->getStatusCode());
        $pMeta = $this->decodeBody($patientSearch)['meta'];
        $this->assertSame(2, $pMeta['total_records'], 'Patient total_records must never leak other patients counts');
        $this->assertSame(1, $pMeta['filtered_records']);

        // 5. Dentist scoped /dentist/appointments & /appointments/search: total_records MUST be 3 (assigned rows only), NEVER 5
        $dentistIndex = $this->app->handle($this->authRequest('GET', '/api/v1/dentist/appointments', $this->dentist1User, [
            'status' => 'CONFIRMED',
        ]));
        $this->assertSame(200, $dentistIndex->getStatusCode());
        $dMeta = $this->decodeBody($dentistIndex)['data']['meta'];
        $this->assertSame(3, $dMeta['total_records'], 'Dentist total_records must only count assigned appointments');
        $this->assertSame(1, $dMeta['filtered_records']);

        $dentistSearch = $this->app->handle($this->authRequest('GET', '/api/v1/appointments/search', $this->dentist1User, [
            'status' => 'CONFIRMED',
        ]));
        $this->assertSame(200, $dentistSearch->getStatusCode());
        $dSearchMeta = $this->decodeBody($dentistSearch)['meta'];
        $this->assertSame(3, $dSearchMeta['total_records'], 'Dentist search total_records must only count assigned appointments');
        $this->assertSame(1, $dSearchMeta['filtered_records']);
    }

    public function testSyntheticThousandRowDatasetPaginationPerformanceAndIndexPlan(): void
    {
        // Bulk-insert 1,000 synthetic appointments inside a single transaction
        $this->pdo->beginTransaction();
        $stmt = $this->pdo->prepare("
            INSERT INTO appointments (
                patient_id, dentist_id, service_id, start_at, end_at,
                duration_snapshot, price_snapshot, status, operatory_chair, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 30, 1200.00, ?, 'Chair 1', ?, ?)
        ");
        $statuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
        $baseTs = strtotime('2026-01-01 08:00:00');
        for ($i = 0; $i < 1000; $i++) {
            $start = date('Y-m-d H:i:s', $baseTs + ($i * 3600));
            $end = date('Y-m-d H:i:s', $baseTs + ($i * 3600) + 1800);
            $created = date('Y-m-d H:i:s', $baseTs + ($i * 60));
            $stmt->execute([
                $i % 2 === 0 ? $this->patient1Id : $this->patient2Id,
                $i % 2 === 0 ? $this->dentist1Id : $this->dentist2Id,
                $i % 2 === 0 ? $this->service1Id : $this->service2Id,
                $start,
                $end,
                $statuses[$i % 4],
                $created,
                $created,
            ]);
        }
        $this->pdo->commit();

        // Verify EXPLAIN QUERY PLAN utilizes our composite index for status + start_at filtered queries
        $planRows = $this->pdo->query("
            EXPLAIN QUERY PLAN
            SELECT a.id FROM appointments a
            WHERE a.status = 'CONFIRMED' AND a.start_at >= '2026-01-10 00:00:00'
            ORDER BY a.start_at DESC
            LIMIT 25 OFFSET 25
        ")->fetchAll(PDO::FETCH_ASSOC);
        $planText = implode(' | ', array_map(static fn (array $r): string => (string) ($r['detail'] ?? ''), $planRows));
        $this->assertStringContainsString('idx_appointments_status_start', $planText);

        // Measure deep page request against 1,000 rows: must return strictly 25 rows in bounded time
        $t0 = microtime(true);
        $res = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->adminUser, [
            'status' => 'CONFIRMED',
            'page' => '5',
            'per_page' => '25',
            'sort_by' => 'start_at',
            'sort_dir' => 'desc',
        ]));
        $elapsedMs = (microtime(true) - $t0) * 1000;

        $this->assertSame(200, $res->getStatusCode());
        $body = $this->decodeBody($res);
        $this->assertCount(25, $body['data']);
        $this->assertSame(1000, $body['meta']['total_records']);
        $this->assertSame(250, $body['meta']['filtered_records']);
        $this->assertSame(10, $body['meta']['total_pages']);
        $this->assertLessThan(2000.0, $elapsedMs, sprintf('Expected 1000-row paginated query under 2000ms, got %.2fms', $elapsedMs));
    }
}
