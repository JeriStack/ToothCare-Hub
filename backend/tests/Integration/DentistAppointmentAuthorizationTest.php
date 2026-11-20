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
 * Integration Test for Dentist Appointment Authorization & Zero-Trust IDOR Protection.
 * Verifies that Dentist A can never inspect, list, or complete Dentist B's appointments.
 */
class DentistAppointmentAuthorizationTest extends TestCase
{
    private Application $app;
    private UserRepository $userRepo;
    private DentistRepository $dentistRepo;
    private PatientRepository $patientRepo;
    private ServiceRepository $serviceRepo;
    private AppointmentRepository $appointmentRepo;

    private array $dentistUserA;
    private int $dentistAId;
    private array $dentistUserB;
    private int $dentistBId;
    private array $patientUser;
    private int $patientId;
    private int $serviceId;

    private int $aptAId;
    private int $aptBId;
    private int $pendingAptAId;

    protected function setUp(): void
    {
        $_SESSION = [];
        $pdo = TestDb::create();
        $this->app = new Application(null, false);

        $this->userRepo = new UserRepository();
        $this->dentistRepo = new DentistRepository();
        $this->patientRepo = new PatientRepository();
        $this->serviceRepo = new ServiceRepository();
        $this->appointmentRepo = new AppointmentRepository();

        // 1. Dentist A
        $uA = $this->userRepo->create(
            'dr.santos@toothcare.local',
            password_hash('Password123!', PASSWORD_BCRYPT),
            'DENTIST',
            1,
            1
        );
        $this->dentistUserA = $this->userRepo->findById($uA);
        $this->dentistAId = $this->dentistRepo->create([
            'user_id' => $uA,
            'license_number' => 'PRC-0042189',
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'specialization' => 'General & Cosmetic Dentistry',
            'phone' => '+639171112222',
            'default_operatory_chair' => 'Chair 1',
            'is_active' => 1,
        ]);

        // 2. Dentist B
        $uB = $this->userRepo->create(
            'dr.reyes@toothcare.local',
            password_hash('Password123!', PASSWORD_BCRYPT),
            'DENTIST',
            1,
            1
        );
        $this->dentistUserB = $this->userRepo->findById($uB);
        $this->dentistBId = $this->dentistRepo->create([
            'user_id' => $uB,
            'license_number' => 'PRC-0051280',
            'first_name' => 'Roberto',
            'last_name' => 'Reyes',
            'specialization' => 'Orthodontics',
            'phone' => '+639173334444',
            'default_operatory_chair' => 'Chair 2',
            'is_active' => 1,
        ]);

        // 3. Patient
        $pUser = $this->userRepo->create(
            'patient.juan@example.com',
            password_hash('Password123!', PASSWORD_BCRYPT),
            'PATIENT',
            1,
            1
        );
        $this->patientUser = $this->userRepo->findById($pUser);
        $this->patientId = $this->patientRepo->create([
            'user_id' => $pUser,
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'date_of_birth' => '1990-05-12',
            'phone' => '+639178889999',
            'gender' => 'MALE',
            'address' => 'Manila',
            'medical_alerts' => 'Penicillin allergy, Mild Asthma',
        ]);

        // 4. Service
        $this->serviceId = $this->serviceRepo->create([
            'name' => 'Root Canal Therapy',
            'category' => 'Endodontics',
            'price' => 7500.00,
            'duration_minutes' => 90,
            'is_active' => 1,
        ]);

        // 5. Appointments (relative future dates in clinic timezone so tests stay deterministic over time)
        $tz = new \DateTimeZone('Asia/Manila');
        $confirmedDay = (new \DateTimeImmutable('now', $tz))->modify('+2 days')->format('Y-m-d');
        $pendingDay = (new \DateTimeImmutable('now', $tz))->modify('+3 days')->format('Y-m-d');

        // Confirmed Appointment for Dentist A
        $this->aptAId = $this->appointmentRepo->create([
            'patient_id' => $this->patientId,
            'dentist_id' => $this->dentistAId,
            'service_id' => $this->serviceId,
            'start_at' => "{$confirmedDay} 09:00:00",
            'end_at' => "{$confirmedDay} 10:30:00",
            'duration_snapshot' => 90,
            'price_snapshot' => 7500.00,
            'status' => 'CONFIRMED',
            'chief_complaint' => 'Severe throbbing molar ache',
            'operatory_chair' => 'Chair 1',
        ]);

        // Confirmed Appointment for Dentist B
        $this->aptBId = $this->appointmentRepo->create([
            'patient_id' => $this->patientId,
            'dentist_id' => $this->dentistBId,
            'service_id' => $this->serviceId,
            'start_at' => "{$confirmedDay} 11:00:00",
            'end_at' => "{$confirmedDay} 12:30:00",
            'duration_snapshot' => 90,
            'price_snapshot' => 7500.00,
            'status' => 'CONFIRMED',
            'chief_complaint' => 'Orthodontic wire adjustment',
            'operatory_chair' => 'Chair 2',
        ]);

        // Pending Appointment for Dentist A
        $this->pendingAptAId = $this->appointmentRepo->create([
            'patient_id' => $this->patientId,
            'dentist_id' => $this->dentistAId,
            'service_id' => $this->serviceId,
            'start_at' => "{$pendingDay} 14:00:00",
            'end_at' => "{$pendingDay} 15:30:00",
            'duration_snapshot' => 90,
            'price_snapshot' => 7500.00,
            'status' => 'PENDING',
            'chief_complaint' => 'Routine checkup request',
            'operatory_chair' => 'Chair 1',
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

    public function testDentistCanViewOwnAssignedAppointment(): void
    {
        $req = $this->makeJsonRequest('GET', "/api/v1/dentist/appointments/{$this->aptAId}", null, $this->dentistUserA);
        $res = $this->app->handle($req);

        $this->assertSame(200, $res->getStatusCode());
        $data = json_decode($res->getBody(), true);
        $this->assertNull($data['error']);
        $this->assertSame($this->aptAId, (int) $data['data']['id']);
        $this->assertSame('Juan', $data['data']['patient_first_name']);
        $this->assertSame('Penicillin allergy, Mild Asthma', $data['data']['patient_medical_alerts']);
    }

    public function testDentistCannotViewOtherDentistAppointment(): void
    {
        // Dentist A tries to view Dentist B's appointment -> 403 Forbidden
        $req = $this->makeJsonRequest('GET', "/api/v1/dentist/appointments/{$this->aptBId}", null, $this->dentistUserA);
        $res = $this->app->handle($req);

        $this->assertSame(403, $res->getStatusCode());
        $data = json_decode($res->getBody(), true);
        $this->assertNotNull($data['error']);
    }

    public function testDentistCanCompleteOwnConfirmedAppointment(): void
    {
        $req = $this->makeJsonRequest('POST', "/api/v1/dentist/appointments/{$this->aptAId}/complete", [
            'notes' => 'Patient underwent successful pulpectomy and root canal cleaning.',
        ], $this->dentistUserA);
        $res = $this->app->handle($req);

        $this->assertSame(200, $res->getStatusCode());
        $data = json_decode($res->getBody(), true);
        $this->assertNull($data['error']);
        $this->assertSame('COMPLETED', $data['data']['status']);
    }

    public function testDentistCannotCompleteOtherDentistAppointment(): void
    {
        // Dentist A tries to complete Dentist B's appointment -> 403 Forbidden
        $req = $this->makeJsonRequest('POST', "/api/v1/dentist/appointments/{$this->aptBId}/complete", [], $this->dentistUserA);
        $res = $this->app->handle($req);

        $this->assertSame(403, $res->getStatusCode());
        $data = json_decode($res->getBody(), true);
        $this->assertNotNull($data['error']);
    }

    public function testDentistCannotCompletePendingAppointment(): void
    {
        // Dentist A tries to complete a PENDING appointment (must be CONFIRMED) -> 409 Conflict
        $req = $this->makeJsonRequest('POST', "/api/v1/dentist/appointments/{$this->pendingAptAId}/complete", [], $this->dentistUserA);
        $res = $this->app->handle($req);

        $this->assertSame(409, $res->getStatusCode());
        $data = json_decode($res->getBody(), true);
        $this->assertNotNull($data['error']);
    }

    public function testDentistDashboardMetricsScatteredExclusivelyToDentist(): void
    {
        $req = $this->makeJsonRequest('GET', '/api/v1/dentist/dashboard', null, $this->dentistUserA);
        $res = $this->app->handle($req);

        $this->assertSame(200, $res->getStatusCode());
        $data = json_decode($res->getBody(), true);
        $this->assertNull($data['error']);
        // Dentist A has 1 confirmed and 1 pending appointment
        $this->assertSame(1, $data['data']['upcoming_count']);
        $this->assertSame(1, $data['data']['pending_count']);
        $this->assertArrayHasKey('clinic_time', $data['data']);
        $this->assertArrayHasKey('next_appointment', $data['data']);
        $this->assertArrayHasKey('activity_summary', $data['data']);
        $this->assertNotNull($data['data']['next_appointment']);
        $this->assertSame($this->aptAId, (int) $data['data']['next_appointment']['id']);
        $this->assertSame(0, $data['data']['activity_summary']['pending_documentation_count']);
    }

    public function testDentistAppointmentsListingOnlyReturnsAssigned(): void
    {
        $req = $this->makeJsonRequest('GET', '/api/v1/dentist/appointments', null, $this->dentistUserA);
        $res = $this->app->handle($req);

        $this->assertSame(200, $res->getStatusCode());
        $data = json_decode($res->getBody(), true);
        $this->assertNull($data['error']);
        $items = $data['data']['items'];
        $this->assertCount(2, $items);
        foreach ($items as $item) {
            $this->assertSame($this->dentistAId, (int) $item['dentist_id']);
        }
    }
}
