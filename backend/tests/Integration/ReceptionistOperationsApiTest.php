<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Request;
use App\Repositories\AppointmentRepository;
use App\Repositories\AttendanceRepository;
use App\Repositories\DentistRepository;
use App\Repositories\PatientRepository;
use App\Repositories\ServiceRepository;
use App\Repositories\UserRepository;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Integration Test for Receptionist Front Desk Operations & RBAC Separation.
 */
class ReceptionistOperationsApiTest extends TestCase
{
    private Application $app;
    private UserRepository $userRepo;
    private PatientRepository $patientRepo;
    private DentistRepository $dentistRepo;
    private ServiceRepository $serviceRepo;
    private AppointmentRepository $appointmentRepo;
    private AttendanceRepository $attendanceRepo;

    private array $receptionistUser;
    private array $patientUser;
    private int $patientId;
    private int $dentistId;
    private int $serviceId;
    private int $appointmentId;

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
        $this->attendanceRepo = new AttendanceRepository();

        // 1. Create Receptionist User
        $recUser = $this->userRepo->findByEmail('receptionist.test@toothcare.local');
        if (!$recUser) {
            $recId = $this->userRepo->create(
                'receptionist.test@toothcare.local',
                password_hash('Password123!', PASSWORD_BCRYPT),
                'RECEPTIONIST',
                1
            );
            $this->receptionistUser = $this->userRepo->findById($recId);
        } else {
            $this->receptionistUser = $recUser;
        }

        // 2. Create Patient User & Record
        $patUser = $this->userRepo->findByEmail('patient.rec.test@toothcare.local');
        if (!$patUser) {
            $patUserId = $this->userRepo->create(
                'patient.rec.test@toothcare.local',
                password_hash('Password123!', PASSWORD_BCRYPT),
                'PATIENT',
                1
            );
            $this->patientUser = $this->userRepo->findById($patUserId);
            $this->patientId = $this->patientRepo->create([
                'user_id' => $patUserId,
                'first_name' => 'Maria',
                'last_name' => 'TestReceptionist',
                'date_of_birth' => '1992-04-15',
                'gender' => 'FEMALE',
                'phone' => '+639171234888',
                'address' => 'Makati City',
                'emergency_contact_name' => 'John',
                'emergency_contact_phone' => '+639171234999',
                'medical_alerts' => 'None recorded',
            ]);
        } else {
            $this->patientUser = $patUser;
            $patRec = $this->patientRepo->findByUserId((int) $patUser['id']);
            $this->patientId = (int) $patRec['id'];
        }

        // 3. Find or Create Dentist
        $dentists = $this->dentistRepo->listActive();
        if (!empty($dentists)) {
            $this->dentistId = (int) $dentists[0]['id'];
        } else {
            $dUserId = $this->userRepo->create('dentist.rec.test@toothcare.local', password_hash('Pass123!', PASSWORD_BCRYPT), 'DENTIST', 1);
            $this->dentistId = $this->dentistRepo->create([
                'user_id' => $dUserId,
                'first_name' => 'Roberto',
                'last_name' => 'Dentist',
                'license_number' => 'PRC-099999',
                'specialization' => 'General Dentistry',
                'phone' => '+639185551234',
                'is_active' => 1,
            ]);
        }

        // 4. Find or Create Service
        $services = $this->serviceRepo->listActive();
        if (!empty($services)) {
            $this->serviceId = (int) $services[0]['id'];
        } else {
            $this->serviceId = $this->serviceRepo->create([
                'name' => 'Routine Oral Cleaning',
                'category' => 'Preventive',
                'duration_minutes' => 45,
                'price' => 1200.00,
                'is_active' => 1,
            ]);
        }

        // 5. Create an Appointment for Today
        $now = new \DateTimeImmutable('now', new \DateTimeZone('Asia/Manila'));
        $startAt = $now->format('Y-m-d') . ' 15:00:00';
        $endAt = $now->format('Y-m-d') . ' 15:45:00';

        $this->appointmentId = $this->appointmentRepo->create([
            'patient_id' => $this->patientId,
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => $startAt,
            'end_at' => $endAt,
            'duration_snapshot' => 45,
            'price_snapshot' => 1200.00,
            'status' => 'CONFIRMED',
            'chief_complaint' => 'Routine visit',
            'created_by' => $this->patientUser['id'],
        ]);
    }

    private function createAuthenticatedRequest(string $method, string $path, array $headers = [], array $queryParams = [], array $body = []): Request
    {
        $req = new Request($method, $path, $headers, $queryParams, $body);
        $req->setUser($this->receptionistUser);
        return $req;
    }

    public function testReceptionistDashboardReturnsOperationalKpis(): void
    {
        $request = $this->createAuthenticatedRequest('GET', '/api/v1/receptionist/dashboard', [
            'Accept' => 'application/json',
        ]);

        $response = $this->app->handle($request);
        $this->assertSame(200, $response->getStatusCode());

        $body = json_decode($response->getBody(), true);
        $this->assertArrayHasKey('data', $body);
        $data = $body['data'];

        $this->assertArrayHasKey('clinic_date', $data);
        $this->assertArrayHasKey('clinic_time', $data);
        $this->assertArrayHasKey('counts', $data);
        $this->assertArrayHasKey('today_schedule', $data);
        $this->assertArrayHasKey('waiting_list', $data);

        $counts = $data['counts'];
        $this->assertArrayHasKey('today_total', $counts);
        $this->assertArrayHasKey('pending_requests', $counts);
        $this->assertArrayHasKey('confirmed_today', $counts);
        $this->assertArrayHasKey('checked_in', $counts);
        $this->assertArrayHasKey('waiting', $counts);
        $this->assertArrayHasKey('completed_today', $counts);
        $this->assertArrayHasKey('cancelled_today', $counts);
    }

    public function testReceptionistCanCheckInPatientAndRecordAttendance(): void
    {
        $request = $this->createAuthenticatedRequest(
            'POST',
            "/api/v1/receptionist/appointments/{$this->appointmentId}/check-in",
            ['Content-Type' => 'application/json'],
            [],
            ['notes' => 'Patient arrived at front desk on time.']
        );

        $response = $this->app->handle($request);
        $this->assertSame(200, $response->getStatusCode());

        $body = json_decode($response->getBody(), true);
        $this->assertTrue($body['data']['success']);
        $this->assertSame('CHECKED_IN', $body['data']['attendance']['status']);

        // Verify waiting list now contains this patient
        $wlRequest = $this->createAuthenticatedRequest('GET', '/api/v1/receptionist/waiting-list');
        $wlResponse = $this->app->handle($wlRequest);
        $this->assertSame(200, $wlResponse->getStatusCode());
        $wlBody = json_decode($wlResponse->getBody(), true);
        $this->assertNotEmpty($wlBody['data']);
    }

    public function testReceptionistCanTransitionAttendanceToInConsultationAndFinished(): void
    {
        // Transition to IN_CONSULTATION
        $req1 = $this->createAuthenticatedRequest(
            'PATCH',
            "/api/v1/receptionist/appointments/{$this->appointmentId}/attendance",
            ['Content-Type' => 'application/json'],
            [],
            ['status' => 'IN_CONSULTATION', 'notes' => 'Seated in Chair 1']
        );
        $res1 = $this->app->handle($req1);
        $this->assertSame(200, $res1->getStatusCode());
        $body1 = json_decode($res1->getBody(), true);
        $this->assertSame('IN_CONSULTATION', $body1['data']['attendance']['status']);

        // Transition to FINISHED
        $req2 = $this->createAuthenticatedRequest(
            'PATCH',
            "/api/v1/receptionist/appointments/{$this->appointmentId}/attendance",
            ['Content-Type' => 'application/json'],
            [],
            ['status' => 'FINISHED', 'notes' => 'Completed cleaning']
        );
        $res2 = $this->app->handle($req2);
        $this->assertSame(200, $res2->getStatusCode());
        $body2 = json_decode($res2->getBody(), true);
        $this->assertSame('FINISHED', $body2['data']['attendance']['status']);
    }

    public function testReceptionistCanRegisterWalkInPatient(): void
    {
        $uniqueEmail = 'walkin.' . time() . '@example.com';
        $payload = [
            'first_name' => 'WalkIn',
            'last_name' => 'Customer',
            'email' => $uniqueEmail,
            'phone' => '+639179998877',
            'gender' => 'MALE',
            'date_of_birth' => '1998-07-20',
            'address' => 'Pasig City',
            'emergency_contact_name' => 'Jane Customer',
            'emergency_contact_phone' => '+639179998866',
            'medical_alerts' => 'None recorded',
        ];

        $request = $this->createAuthenticatedRequest(
            'POST',
            '/api/v1/receptionist/patients',
            ['Content-Type' => 'application/json'],
            [],
            $payload
        );

        $response = $this->app->handle($request);
        $this->assertSame(201, $response->getStatusCode());

        $body = json_decode($response->getBody(), true);
        $this->assertNotNull($body['data']);
        $this->assertSame('WalkIn', $body['data']['first_name']);
    }

    public function testReceptionistIsForbiddenFromModifyingServicePrices(): void
    {
        $request = $this->createAuthenticatedRequest(
            'POST',
            '/api/v1/admin/services',
            ['Content-Type' => 'application/json'],
            [],
            [
                'name' => 'Unauthorized Service Price Change',
                'category' => 'Cosmetic',
                'duration_minutes' => 60,
                'price' => 9999.00,
            ]
        );

        $response = $this->app->handle($request);
        $this->assertSame(403, $response->getStatusCode());
    }

    public function testReceptionistIsForbiddenFromClinicalTreatmentRecords(): void
    {
        $request = $this->createAuthenticatedRequest('GET', '/api/v1/treatment-records');
        $response = $this->app->handle($request);
        $this->assertSame(403, $response->getStatusCode());
    }

    public function testPatientIsForbiddenFromReceptionistDashboard(): void
    {
        $request = new Request('GET', '/api/v1/receptionist/dashboard');
        $request->setUser($this->patientUser);
        $response = $this->app->handle($request);
        $this->assertSame(403, $response->getStatusCode());
    }
}
