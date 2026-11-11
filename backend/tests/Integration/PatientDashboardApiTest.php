<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Request;
use App\Repositories\AppointmentRepository;
use App\Repositories\DentistRepository;
use App\Repositories\PatientRepository;
use App\Repositories\ServiceRepository;
use App\Repositories\UserRepository;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Integration Test for Patient Dashboard API & Zero-Trust Telemetry.
 * Verifies that authenticated patients receive their real-time statistics,
 * next appointment hero card, pending triage requests, and recent activity,
 * with strict IDOR isolation.
 */
class PatientDashboardApiTest extends TestCase
{
    private Application $app;
    private UserRepository $userRepo;
    private PatientRepository $patientRepo;
    private DentistRepository $dentistRepo;
    private ServiceRepository $serviceRepo;
    private AppointmentRepository $appointmentRepo;

    private array $patientUserA;
    private int $patientAId;
    private array $patientUserB;
    private int $patientBId;
    private int $dentistId;
    private int $serviceId;

    private int $aptConfirmedA;
    private int $aptPendingA;
    private int $aptCompletedA;
    private int $aptConfirmedB;

    protected function setUp(): void
    {
        $_SESSION = [];
        $pdo = TestDb::create();
        $this->app = new Application(null, false);

        $this->userRepo = new UserRepository();
        $this->patientRepo = new PatientRepository();
        $this->dentistRepo = new DentistRepository();
        $this->serviceRepo = new ServiceRepository();
        $this->appointmentRepo = new AppointmentRepository();

        // 1. Patient User A & Profile
        $uA = $this->userRepo->create(
            'patient.a@toothcare.local',
            password_hash('Password123!', PASSWORD_BCRYPT),
            'PATIENT',
            1,
            1
        );
        $this->patientUserA = $this->userRepo->findById($uA);
        $this->patientAId = $this->patientRepo->create([
            'user_id' => $uA,
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'phone' => '+639175551111',
            'date_of_birth' => '1995-05-18',
            'gender' => 'MALE',
            'medical_alerts' => 'Penicillin allergy',
        ]);

        // 2. Patient User B & Profile
        $uB = $this->userRepo->create(
            'patient.b@toothcare.local',
            password_hash('Password123!', PASSWORD_BCRYPT),
            'PATIENT',
            1,
            1
        );
        $this->patientUserB = $this->userRepo->findById($uB);
        $this->patientBId = $this->patientRepo->create([
            'user_id' => $uB,
            'first_name' => 'Maria',
            'last_name' => 'Clara',
            'phone' => '+639175552222',
            'date_of_birth' => '1998-08-20',
            'gender' => 'FEMALE',
        ]);

        // 3. Attending Dentist
        $du = $this->userRepo->create(
            'dentist.dash@toothcare.local',
            password_hash('Password123!', PASSWORD_BCRYPT),
            'DENTIST',
            1,
            1
        );
        $this->dentistId = $this->dentistRepo->create([
            'user_id' => $du,
            'license_number' => 'PRC-PAT-DASH',
            'first_name' => 'Elena',
            'last_name' => 'Santos',
            'specialization' => 'Orthodontics & General',
            'phone' => '+639175553333',
            'default_operatory_chair' => 'Chair 1',
            'is_active' => 1,
        ]);

        // 4. Clinical Service
        $this->serviceId = $this->serviceRepo->create([
            'name' => 'Comprehensive Oral Prophylaxis',
            'description' => 'Complete teeth scaling, stain removal and polishing',
            'duration_minutes' => 45,
            'price' => 1500.00,
            'is_active' => 1,
        ]);

        // 5. Appointments for Patient A
        // Upcoming Confirmed
        $this->aptConfirmedA = $this->appointmentRepo->create([
            'patient_id' => $this->patientAId,
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => '2026-12-10 10:00:00',
            'end_at' => '2026-12-10 10:45:00',
            'duration_snapshot' => 45,
            'price_snapshot' => 1500.00,
            'status' => 'CONFIRMED',
            'operatory_chair' => 'Chair 1',
        ]);

        // Pending Request
        $this->aptPendingA = $this->appointmentRepo->create([
            'patient_id' => $this->patientAId,
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => '2026-12-15 14:00:00',
            'end_at' => '2026-12-15 14:45:00',
            'duration_snapshot' => 45,
            'price_snapshot' => 1500.00,
            'status' => 'PENDING',
            'operatory_chair' => 'Chair 1',
        ]);

        // Completed Care
        $this->aptCompletedA = $this->appointmentRepo->create([
            'patient_id' => $this->patientAId,
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => '2026-10-01 09:00:00',
            'end_at' => '2026-10-01 09:45:00',
            'duration_snapshot' => 45,
            'price_snapshot' => 1500.00,
            'status' => 'COMPLETED',
            'operatory_chair' => 'Chair 1',
        ]);

        // 6. Appointment for Patient B (to test IDOR isolation)
        $this->aptConfirmedB = $this->appointmentRepo->create([
            'patient_id' => $this->patientBId,
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => '2026-12-12 11:00:00',
            'end_at' => '2026-12-12 11:45:00',
            'duration_snapshot' => 45,
            'price_snapshot' => 1500.00,
            'status' => 'CONFIRMED',
            'operatory_chair' => 'Chair 2',
        ]);
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

    public function testAuthenticatedPatientCanRetrieveDashboardSummary(): void
    {
        $req = $this->makeJsonRequest('GET', '/api/v1/patient/dashboard', null, $this->patientUserA);
        $res = $this->app->handle($req);

        $this->assertSame(200, $res->getStatusCode());
        $data = json_decode($res->getBody(), true);
        $this->assertNull($data['error']);

        $summary = $data['data'];
        $this->assertArrayHasKey('clinic_time', $summary);
        $this->assertSame(1, $summary['upcoming_count']);
        $this->assertSame(1, $summary['pending_count']);
        $this->assertSame(1, $summary['completed_count']);

        // Next Appointment Verification
        $this->assertNotNull($summary['next_appointment']);
        $this->assertSame($this->aptConfirmedA, (int) $summary['next_appointment']['id']);
        $this->assertSame('Dr. Elena Santos', 'Dr. ' . $summary['next_appointment']['dentist_first_name'] . ' ' . $summary['next_appointment']['dentist_last_name']);
        $this->assertSame('Comprehensive Oral Prophylaxis', $summary['next_appointment']['service_name']);

        // Pending Requests
        $this->assertCount(1, $summary['pending_requests']);
        $this->assertSame($this->aptPendingA, (int) $summary['pending_requests'][0]['id']);
    }

    public function testPatientDashboardEnforcesZeroTrustIDORIsolation(): void
    {
        // Patient B retrieves dashboard: should only see Patient B's appointment, not Patient A's
        $req = $this->makeJsonRequest('GET', '/api/v1/patient/dashboard', null, $this->patientUserB);
        $res = $this->app->handle($req);

        $this->assertSame(200, $res->getStatusCode());
        $data = json_decode($res->getBody(), true);
        $this->assertNull($data['error']);

        $summary = $data['data'];
        $this->assertSame(1, $summary['upcoming_count']);
        $this->assertSame(0, $summary['pending_count']);
        $this->assertSame(0, $summary['completed_count']);
        $this->assertSame($this->aptConfirmedB, (int) $summary['next_appointment']['id']);
    }

    public function testUnauthenticatedUserCannotAccessPatientDashboard(): void
    {
        $req = $this->makeJsonRequest('GET', '/api/v1/patient/dashboard', null, null);
        $res = $this->app->handle($req);

        $this->assertSame(401, $res->getStatusCode());
    }
}
