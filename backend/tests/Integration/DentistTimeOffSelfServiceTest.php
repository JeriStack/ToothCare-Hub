<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Request;
use App\Repositories\DentistRepository;
use App\Repositories\DentistTimeOffRepository;
use App\Repositories\UserRepository;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Integration Test for Dentist Self-Service Time-Off & Leave Requests.
 * Verifies that authenticated dentists can submit leave requests awaiting admin approval,
 * cannot auto-approve, cannot submit overlapping requests, and unauthorized users are blocked.
 */
class DentistTimeOffSelfServiceTest extends TestCase
{
    private Application $app;
    private UserRepository $userRepo;
    private DentistRepository $dentistRepo;
    private DentistTimeOffRepository $timeOffRepo;

    private array $dentistUser;
    private int $dentistId;
    private array $patientUser;

    protected function setUp(): void
    {
        $_SESSION = [];
        $pdo = TestDb::create();
        $this->app = new Application(null, false);

        $this->userRepo = new UserRepository();
        $this->dentistRepo = new DentistRepository();
        $this->timeOffRepo = new DentistTimeOffRepository();

        // 1. Create Dentist User and Profile
        $du = $this->userRepo->create(
            'dr.selfservice@toothcare.local',
            password_hash('Password123!', PASSWORD_BCRYPT),
            'DENTIST',
            1,
            1
        );
        $this->dentistUser = $this->userRepo->findById($du);
        $this->dentistId = $this->dentistRepo->create([
            'user_id' => $du,
            'license_number' => 'PRC-LEAVE-998',
            'first_name' => 'Carla',
            'last_name' => 'Gomez',
            'specialization' => 'Pediatric Dentistry',
            'phone' => '+639175558888',
            'default_operatory_chair' => 'Chair 1',
            'is_active' => 1,
        ]);

        // 2. Create Patient User (Non-dentist)
        $pu = $this->userRepo->create(
            'patient.regular@toothcare.local',
            password_hash('Password123!', PASSWORD_BCRYPT),
            'PATIENT',
            1,
            1
        );
        $this->patientUser = $this->userRepo->findById($pu);
    }

    private function makeJsonRequest(string $method, string $path, ?array $body = null, ?array $user = null): Request
    {
        $headers = [];
        $rawBody = '';
        if ($body !== null) {
            $headers['content-type'] = 'application/json';
            $rawBody = json_encode($body);
        }
        $req = Request::create($method, $path, $headers, $rawBody);
        if ($user !== null) {
            $req->setUser($user);
        }
        return $req;
    }

    public function testDentistCanSubmitLeaveRequestPendingAdminApproval(): void
    {
        $payload = [
            'start_at' => '2026-12-01 08:00:00',
            'end_at' => '2026-12-03 18:00:00',
            'reason' => 'Annual Dental Association Conference (CME)',
        ];

        $req = $this->makeJsonRequest('POST', '/api/v1/dentist/time-off', $payload, $this->dentistUser);
        $res = $this->app->handle($req);

        $this->assertSame(201, $res->getStatusCode());
        $data = json_decode($res->getBody(), true);
        $this->assertNull($data['error']);
        $this->assertSame($this->dentistId, (int) $data['data']['dentist_id']);
        $this->assertSame('Annual Dental Association Conference (CME)', $data['data']['reason']);
        // Must NOT be auto-approved (approved_by_user_id is NULL)
        $this->assertNull($data['data']['approved_by_user_id']);
    }

    public function testDentistCannotSubmitOverlappingLeaveRequest(): void
    {
        // First request
        $payload1 = [
            'start_at' => '2026-12-10 09:00:00',
            'end_at' => '2026-12-12 17:00:00',
            'reason' => 'Personal Medical Leave',
        ];
        $req1 = $this->makeJsonRequest('POST', '/api/v1/dentist/time-off', $payload1, $this->dentistUser);
        $res1 = $this->app->handle($req1);
        $this->assertSame(201, $res1->getStatusCode());

        // Overlapping second request
        $payload2 = [
            'start_at' => '2026-12-11 10:00:00',
            'end_at' => '2026-12-14 17:00:00',
            'reason' => 'Extended Leave',
        ];
        $req2 = $this->makeJsonRequest('POST', '/api/v1/dentist/time-off', $payload2, $this->dentistUser);
        $res2 = $this->app->handle($req2);

        $this->assertSame(409, $res2->getStatusCode());
        $data = json_decode($res2->getBody(), true);
        $this->assertNotNull($data['error']);
        $this->assertStringContainsString('overlaps', $data['error']['message']);
    }

    public function testUnauthenticatedUserCannotSubmitLeaveRequest(): void
    {
        $payload = [
            'start_at' => '2026-12-20 09:00:00',
            'end_at' => '2026-12-21 17:00:00',
            'reason' => 'Holiday Vacation',
        ];

        $req = $this->makeJsonRequest('POST', '/api/v1/dentist/time-off', $payload, null);
        $res = $this->app->handle($req);

        $this->assertSame(401, $res->getStatusCode());
    }

    public function testPatientCannotSubmitDentistLeaveRequest(): void
    {
        $payload = [
            'start_at' => '2026-12-20 09:00:00',
            'end_at' => '2026-12-21 17:00:00',
            'reason' => 'Holiday Vacation',
        ];

        $req = $this->makeJsonRequest('POST', '/api/v1/dentist/time-off', $payload, $this->patientUser);
        $res = $this->app->handle($req);

        $this->assertSame(403, $res->getStatusCode());
    }
}
