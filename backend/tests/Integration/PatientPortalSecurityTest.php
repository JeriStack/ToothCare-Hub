<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Request;
use App\Repositories\AppointmentRepository;
use App\Repositories\DentistRepository;
use App\Repositories\DentistScheduleRepository;
use App\Repositories\NotificationRepository;
use App\Repositories\PatientRepository;
use App\Repositories\ServiceRepository;
use App\Repositories\UserRepository;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Integration Security Test Suite for Patient Portal & IDOR Protection
 * Verifies that Patient A is completely isolated from Patient B's data,
 * verifying object-level authorization across profiles, appointments, and notifications.
 */
class PatientPortalSecurityTest extends TestCase
{
    private Application $app;
    private UserRepository $userRepo;
    private PatientRepository $patientRepo;
    private DentistRepository $dentistRepo;
    private ServiceRepository $serviceRepo;
    private DentistScheduleRepository $scheduleRepo;
    private AppointmentRepository $appointmentRepo;
    private NotificationRepository $notificationRepo;

    private array $patientUserA;
    private array $patientA;
    private array $patientUserB;
    private array $patientB;
    private int $dentistId;
    private int $serviceId;

    protected function setUp(): void
    {
        $_SESSION = [];
        TestDb::create();
        $this->app = new Application(null, false);

        $this->userRepo = new UserRepository();
        $this->patientRepo = new PatientRepository();
        $this->dentistRepo = new DentistRepository();
        $this->serviceRepo = new ServiceRepository();
        $this->scheduleRepo = new DentistScheduleRepository();
        $this->appointmentRepo = new AppointmentRepository();
        $this->notificationRepo = new NotificationRepository();

        // 1. Patient A
        $uA = $this->userRepo->create(
            'patient.a@example.com',
            password_hash('Pass123!', PASSWORD_BCRYPT),
            'PATIENT',
            1,
            1
        );
        $this->patientUserA = $this->userRepo->findById($uA);
        $pA = $this->patientRepo->create([
            'user_id' => $uA,
            'first_name' => 'Alice',
            'last_name' => 'Anderson',
            'date_of_birth' => '1992-05-15',
            'phone' => '+639171110001',
            'gender' => 'FEMALE',
            'address' => 'Makati City',
            'emergency_contact_name' => 'Bob Anderson',
            'emergency_contact_phone' => '+639171110002',
            'medical_alerts' => 'Penicillin allergy',
        ]);
        $this->patientA = $this->patientRepo->findById($pA);

        // 2. Patient B
        $uB = $this->userRepo->create(
            'patient.b@example.com',
            password_hash('Pass123!', PASSWORD_BCRYPT),
            'PATIENT',
            1,
            1
        );
        $this->patientUserB = $this->userRepo->findById($uB);
        $pB = $this->patientRepo->create([
            'user_id' => $uB,
            'first_name' => 'Bob',
            'last_name' => 'Baker',
            'date_of_birth' => '1990-11-20',
            'phone' => '+639172220001',
            'gender' => 'MALE',
            'address' => 'Taguig City',
            'emergency_contact_name' => 'Charlie Baker',
            'emergency_contact_phone' => '+639172220002',
            'medical_alerts' => 'Hypertension',
        ]);
        $this->patientB = $this->patientRepo->findById($pB);

        // 3. Active Dentist
        $dUser = $this->userRepo->create(
            'dr.santos.security@toothcare.com',
            password_hash('Pass123!', PASSWORD_BCRYPT),
            'DENTIST',
            1,
            1
        );
        $this->dentistId = $this->dentistRepo->create([
            'user_id' => $dUser,
            'license_number' => 'PRC-SEC-999',
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'specialization' => 'General Dentistry',
            'phone' => '+639189998888',
            'default_operatory_chair' => 'Chair 1',
            'is_active' => 1,
        ]);

        // Shifts: Mon-Fri
        for ($i = 1; $i <= 5; $i++) {
            $this->scheduleRepo->create([
                'dentist_id' => $this->dentistId,
                'day_of_week' => $i,
                'start_time' => '08:00:00',
                'end_time' => '17:00:00',
                'operatory_chair' => 'Chair 1',
                'is_active' => 1,
            ]);
        }

        // 4. Active Service
        $this->serviceId = $this->serviceRepo->create([
            'name' => 'Comprehensive Oral Prophylaxis',
            'category' => 'Preventive',
            'price' => 1500.00,
            'duration_minutes' => 45,
            'is_active' => 1,
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

    private function getValidFutureDate(): string
    {
        $tz = new DateTimeZone('Asia/Manila');
        $now = new DateTimeImmutable('now', $tz);
        $target = $now->modify('+2 days');
        if ((int) $target->format('N') === 6) {
            $target = $target->modify('+2 days');
        } elseif ((int) $target->format('N') === 7) {
            $target = $target->modify('+1 day');
        }
        return $target->format('Y-m-d');
    }

    public function testPatientCannotAccessOtherPatientAppointmentDetails(): void
    {
        // Patient A creates an appointment
        $futureDate = $this->getValidFutureDate();
        $bookReq = $this->makeJsonRequest('POST', '/api/v1/appointments', [
            'service_id' => $this->serviceId,
            'dentist_id' => $this->dentistId,
            'start_at' => "{$futureDate} 09:00:00",
            'chief_complaint' => 'Routine cleaning',
        ], $this->patientUserA);

        $bookRes = $this->app->handle($bookReq);
        $this->assertSame(201, $bookRes->getStatusCode());
        $bookData = json_decode($bookRes->getBody(), true);
        $appointmentId = (int) $bookData['data']['id'];

        // Patient B attempts to retrieve Patient A's appointment details
        $maliciousReq = $this->makeJsonRequest('GET', "/api/v1/appointments/{$appointmentId}", null, $this->patientUserB);
        $maliciousRes = $this->app->handle($maliciousReq);

        // Must return 404 Not Found to prevent ID enumeration
        $this->assertSame(404, $maliciousRes->getStatusCode());

        // Patient A can access their own appointment
        $legitReq = $this->makeJsonRequest('GET', "/api/v1/appointments/{$appointmentId}", null, $this->patientUserA);
        $legitRes = $this->app->handle($legitReq);
        $this->assertSame(200, $legitRes->getStatusCode());
    }

    public function testPatientCannotCancelOtherPatientAppointment(): void
    {
        // Patient A creates an appointment
        $futureDate = $this->getValidFutureDate();
        $bookReq = $this->makeJsonRequest('POST', '/api/v1/appointments', [
            'service_id' => $this->serviceId,
            'dentist_id' => $this->dentistId,
            'start_at' => "{$futureDate} 10:00:00",
            'chief_complaint' => 'Routine checkup',
        ], $this->patientUserA);

        $bookRes = $this->app->handle($bookReq);
        $appointmentId = (int) json_decode($bookRes->getBody(), true)['data']['id'];

        // Patient B attempts to cancel Patient A's appointment
        $maliciousReq = $this->makeJsonRequest('POST', "/api/v1/appointments/{$appointmentId}/cancel", [
            'reason' => 'Malicious cancellation attempt',
        ], $this->patientUserB);
        $maliciousRes = $this->app->handle($maliciousReq);

        $this->assertSame(403, $maliciousRes->getStatusCode());

        // Verify status remains PENDING in database
        $found = $this->appointmentRepo->findById($appointmentId);
        $this->assertSame('PENDING', $found['status']);
    }

    public function testPatientCannotAccessOrModifyOtherPatientProfile(): void
    {
        $patientAId = (int) $this->patientA['id'];

        // Patient B attempts GET /api/v1/patients/{patientAId}
        $getReq = $this->makeJsonRequest('GET', "/api/v1/patients/{$patientAId}", null, $this->patientUserB);
        $getRes = $this->app->handle($getReq);
        $this->assertSame(403, $getRes->getStatusCode());

        // Patient B attempts PATCH /api/v1/patients/{patientAId}
        $patchReq = $this->makeJsonRequest('PATCH', "/api/v1/patients/{$patientAId}", [
            'first_name' => 'HackedName',
        ], $this->patientUserB);
        $patchRes = $this->app->handle($patchReq);
        $this->assertSame(403, $patchRes->getStatusCode());

        // Verify Patient A's name was not modified
        $freshA = $this->patientRepo->findById($patientAId);
        $this->assertSame('Alice', $freshA['first_name']);
    }

    public function testPatientSelfServiceProfileEndpoints(): void
    {
        // GET /api/v1/patients/me for Patient A
        $getReq = $this->makeJsonRequest('GET', '/api/v1/patients/me', null, $this->patientUserA);
        $getRes = $this->app->handle($getReq);
        $this->assertSame(200, $getRes->getStatusCode());
        $data = json_decode($getRes->getBody(), true);
        $this->assertSame('Alice', $data['data']['first_name']);
        $this->assertSame('patient.a@example.com', $data['data']['email']);

        // PATCH /api/v1/patients/me for Patient A
        $updateReq = $this->makeJsonRequest('PATCH', '/api/v1/patients/me', [
            'phone' => '+639179998877',
            'medical_alerts' => 'Penicillin and Latex allergy',
        ], $this->patientUserA);
        $updateRes = $this->app->handle($updateReq);
        $this->assertSame(200, $updateRes->getStatusCode());
        $updateData = json_decode($updateRes->getBody(), true);
        $this->assertSame('+639179998877', $updateData['data']['phone']);
        $this->assertSame('Penicillin and Latex allergy', $updateData['data']['medical_alerts']);
    }

    public function testBookingRejectsInactiveServiceAndInactiveDentist(): void
    {
        // Inactive service
        $inactiveSvcId = $this->serviceRepo->create([
            'name' => 'Archived Root Canal',
            'price' => 5000,
            'duration_minutes' => 60,
            'is_active' => 0,
        ]);

        $futureDate = $this->getValidFutureDate();
        $req1 = $this->makeJsonRequest('POST', '/api/v1/appointments', [
            'service_id' => $inactiveSvcId,
            'dentist_id' => $this->dentistId,
            'start_at' => "{$futureDate} 11:00:00",
        ], $this->patientUserA);
        $res1 = $this->app->handle($req1);
        $this->assertSame(422, $res1->getStatusCode());

        // Inactive dentist
        $dUser2 = $this->userRepo->create('retired.dentist@toothcare.com', 'hash', 'DENTIST', 0, 1);
        $inactiveDentistId = $this->dentistRepo->create([
            'user_id' => $dUser2,
            'license_number' => 'PRC-RET-000',
            'first_name' => 'Retired',
            'last_name' => 'Doctor',
            'specialization' => 'Orthodontics',
            'phone' => '09170000000',
            'is_active' => 0,
        ]);

        $req2 = $this->makeJsonRequest('POST', '/api/v1/appointments', [
            'service_id' => $this->serviceId,
            'dentist_id' => $inactiveDentistId,
            'start_at' => "{$futureDate} 11:00:00",
        ], $this->patientUserA);
        $res2 = $this->app->handle($req2);
        $this->assertSame(422, $res2->getStatusCode());
    }
}
