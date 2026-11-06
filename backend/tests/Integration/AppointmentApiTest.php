<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Request;
use App\Repositories\DentistRepository;
use App\Repositories\DentistScheduleRepository;
use App\Repositories\PatientRepository;
use App\Repositories\ServiceRepository;
use App\Repositories\UserRepository;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Integration API Test Suite for Appointment Booking & Lifecycle Management
 */
class AppointmentApiTest extends TestCase
{
    private Application $app;
    private UserRepository $userRepo;
    private PatientRepository $patientRepo;
    private DentistRepository $dentistRepo;
    private ServiceRepository $serviceRepo;
    private DentistScheduleRepository $scheduleRepo;

    private array $adminUser;
    private array $patientUser1;
    private array $patient1;
    private array $patientUser2;
    private array $patient2;
    private array $dentistUser;
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

        // 1. Admin User
        $adminId = $this->userRepo->create(
            'admin.appt@toothcare.com',
            password_hash('AdminPass123!', PASSWORD_BCRYPT),
            'ADMIN',
            1,
            1
        );
        $this->adminUser = $this->userRepo->findById($adminId);

        // 2. Patient 1 User & Profile
        $p1UserId = $this->userRepo->create(
            'patient1@example.com',
            password_hash('Pass123!', PASSWORD_BCRYPT),
            'PATIENT',
            1,
            1
        );
        $this->patientUser1 = $this->userRepo->findById($p1UserId);
        $p1Id = $this->patientRepo->create([
            'user_id' => $p1UserId,
            'first_name' => 'Carlos',
            'last_name' => 'Mendoza',
            'date_of_birth' => '1995-03-20',
            'phone' => '09171112233',
        ]);
        $this->patient1 = $this->patientRepo->findById($p1Id);

        // 3. Patient 2 User & Profile
        $p2UserId = $this->userRepo->create(
            'patient2@example.com',
            password_hash('Pass123!', PASSWORD_BCRYPT),
            'PATIENT',
            1,
            1
        );
        $this->patientUser2 = $this->userRepo->findById($p2UserId);
        $p2Id = $this->patientRepo->create([
            'user_id' => $p2UserId,
            'first_name' => 'Beatriz',
            'last_name' => 'Luna',
            'date_of_birth' => '1998-07-10',
            'phone' => '09174445566',
        ]);
        $this->patient2 = $this->patientRepo->findById($p2Id);

        // 4. Dentist User & Profile
        $dUserId = $this->userRepo->create(
            'dentist.appt@toothcare.com',
            password_hash('Pass123!', PASSWORD_BCRYPT),
            'DENTIST',
            1,
            1
        );
        $this->dentistUser = $this->userRepo->findById($dUserId);
        $this->dentistId = $this->dentistRepo->create([
            'user_id' => $dUserId,
            'license_number' => 'PRC-APPT-777',
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'specialization' => 'Pediatric Dentistry',
            'phone' => '09177778899',
            'is_active' => 1,
        ]);

        // 5. Active Service
        $this->serviceId = $this->serviceRepo->create([
            'name' => 'Dental Prophylaxis',
            'category' => 'Preventive',
            'price' => 1800.00,
            'duration_minutes' => 30,
            'is_active' => 1,
        ]);

        // 6. Dentist Shifts: Mon-Fri 08:00 to 17:00
        for ($day = 1; $day <= 5; $day++) {
            $this->scheduleRepo->create([
                'dentist_id' => $this->dentistId,
                'day_of_week' => $day,
                'start_time' => '08:00:00',
                'end_time' => '17:00:00',
                'operatory_chair' => 'Chair 1',
                'is_active' => 1,
            ]);
        }
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

    private function getNextValidWeekdayDate(): string
    {
        $tz = new DateTimeZone('Asia/Manila');
        $now = new DateTimeImmutable('now', $tz);
        $target = $now->modify('+2 days');

        // If Saturday (6) or Sunday (7), advance to Monday
        $dow = (int) $target->format('N');
        if ($dow === 6) {
            $target = $target->modify('+2 days');
        } elseif ($dow === 7) {
            $target = $target->modify('+1 day');
        }

        return $target->format('Y-m-d');
    }

    public function testUnauthenticatedBookingIsRejected(): void
    {
        $req = $this->makeJsonRequest('POST', '/api/v1/appointments', [
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => $this->getNextValidWeekdayDate() . ' 09:00:00',
        ]);

        $res = $this->app->handle($req);
        $this->assertSame(401, $res->getStatusCode());
    }

    public function testPatientCanBookAppointmentViaApi(): void
    {
        $bookingDate = $this->getNextValidWeekdayDate() . ' 09:00:00';
        $req = $this->makeJsonRequest(
            'POST',
            '/api/v1/appointments',
            [
                'dentist_id' => $this->dentistId,
                'service_id' => $this->serviceId,
                'start_at' => $bookingDate,
                'chief_complaint' => 'Annual dental checkup and routine cleaning',
            ],
            $this->patientUser1
        );

        $res = $this->app->handle($req);
        $this->assertSame(201, $res->getStatusCode());

        $body = json_decode($res->getBody(), true);
        $this->assertNull($body['error']);
        $this->assertNotNull($body['data']);
        $this->assertSame('PENDING', $body['data']['status']);
        $this->assertSame($this->patient1['id'], (int) $body['data']['patient_id']);
        $this->assertSame($this->dentistId, (int) $body['data']['dentist_id']);
        $this->assertSame($this->serviceId, (int) $body['data']['service_id']);
        $this->assertSame(30, (int) $body['data']['duration_snapshot']);
        $this->assertSame(1800.00, (float) $body['data']['price_snapshot']);
    }

    public function testBookingConflictingSlotReturns409(): void
    {
        $bookingDate = $this->getNextValidWeekdayDate() . ' 10:00:00';

        // Patient 1 books
        $req1 = $this->makeJsonRequest('POST', '/api/v1/appointments', [
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => $bookingDate,
        ], $this->patientUser1);
        $res1 = $this->app->handle($req1);
        $this->assertSame(201, $res1->getStatusCode());

        // Patient 2 attempts booking same slot
        $req2 = $this->makeJsonRequest('POST', '/api/v1/appointments', [
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => $bookingDate,
        ], $this->patientUser2);
        $res2 = $this->app->handle($req2);

        $this->assertSame(409, $res2->getStatusCode());
        $body2 = json_decode($res2->getBody(), true);
        $this->assertNotNull($body2['error']);
    }

    public function testPatientCanListTheirOwnAppointments(): void
    {
        $bookingDate = $this->getNextValidWeekdayDate() . ' 11:00:00';
        $reqCreate = $this->makeJsonRequest('POST', '/api/v1/appointments', [
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => $bookingDate,
        ], $this->patientUser1);
        $this->app->handle($reqCreate);

        // List
        $reqList = $this->makeJsonRequest('GET', '/api/v1/appointments', null, $this->patientUser1);
        $resList = $this->app->handle($reqList);

        $this->assertSame(200, $resList->getStatusCode());
        $body = json_decode($resList->getBody(), true);
        $this->assertGreaterThanOrEqual(1, $body['data']['total']);
        $this->assertSame($this->patient1['id'], (int) $body['data']['items'][0]['patient_id']);
    }

    public function testPatientCannotViewAnotherPatientsAppointment(): void
    {
        $bookingDate = $this->getNextValidWeekdayDate() . ' 13:00:00';
        $reqCreate = $this->makeJsonRequest('POST', '/api/v1/appointments', [
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => $bookingDate,
        ], $this->patientUser1);
        $resCreate = $this->app->handle($reqCreate);
        $created = json_decode($resCreate->getBody(), true);
        $apptId = $created['data']['id'];

        // Patient 2 attempts to view Patient 1's appointment
        $reqView = $this->makeJsonRequest('GET', "/api/v1/appointments/{$apptId}", null, $this->patientUser2);
        $resView = $this->app->handle($reqView);

        $this->assertSame(404, $resView->getStatusCode());
    }

    public function testPatientCanCancelOwnAppointment(): void
    {
        $bookingDate = $this->getNextValidWeekdayDate() . ' 14:00:00';
        $reqCreate = $this->makeJsonRequest('POST', '/api/v1/appointments', [
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => $bookingDate,
        ], $this->patientUser1);
        $resCreate = $this->app->handle($reqCreate);
        $created = json_decode($resCreate->getBody(), true);
        $apptId = $created['data']['id'];

        // Cancel
        $reqCancel = $this->makeJsonRequest('POST', "/api/v1/appointments/{$apptId}/cancel", [
            'reason' => 'Work schedule conflict',
        ], $this->patientUser1);
        $resCancel = $this->app->handle($reqCancel);

        $this->assertSame(200, $resCancel->getStatusCode());
        $body = json_decode($resCancel->getBody(), true);
        $this->assertSame('CANCELLED', $body['data']['status']);
    }

    public function testAdminCanConfirmAndCompleteAppointment(): void
    {
        $bookingDate = $this->getNextValidWeekdayDate() . ' 15:00:00';
        $reqCreate = $this->makeJsonRequest('POST', '/api/v1/appointments', [
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => $bookingDate,
        ], $this->patientUser1);
        $resCreate = $this->app->handle($reqCreate);
        $created = json_decode($resCreate->getBody(), true);
        $apptId = $created['data']['id'];

        // Admin confirms
        $reqConfirm = $this->makeJsonRequest('PATCH', "/api/v1/admin/appointments/{$apptId}/confirm", null, $this->adminUser);
        $resConfirm = $this->app->handle($reqConfirm);

        $this->assertSame(200, $resConfirm->getStatusCode());
        $bodyConfirm = json_decode($resConfirm->getBody(), true);
        $this->assertSame('CONFIRMED', $bodyConfirm['data']['status']);

        // Admin completes
        $reqComplete = $this->makeJsonRequest('PATCH', "/api/v1/admin/appointments/{$apptId}/complete", null, $this->adminUser);
        $resComplete = $this->app->handle($reqComplete);

        $this->assertSame(200, $resComplete->getStatusCode());
        $bodyComplete = json_decode($resComplete->getBody(), true);
        $this->assertSame('COMPLETED', $bodyComplete['data']['status']);
    }

    public function testAdminCanRejectAppointment(): void
    {
        $bookingDate = $this->getNextValidWeekdayDate() . ' 16:00:00';
        $reqCreate = $this->makeJsonRequest('POST', '/api/v1/appointments', [
            'dentist_id' => $this->dentistId,
            'service_id' => $this->serviceId,
            'start_at' => $bookingDate,
        ], $this->patientUser1);
        $resCreate = $this->app->handle($reqCreate);
        $created = json_decode($resCreate->getBody(), true);
        $apptId = $created['data']['id'];

        // Admin rejects
        $reqReject = $this->makeJsonRequest('PATCH', "/api/v1/admin/appointments/{$apptId}/reject", [
            'reason' => 'Doctor called in sick',
        ], $this->adminUser);
        $resReject = $this->app->handle($reqReject);

        $this->assertSame(200, $resReject->getStatusCode());
        $bodyReject = json_decode($resReject->getBody(), true);
        $this->assertSame('REJECTED', $bodyReject['data']['status']);
    }

    public function testNonAdminCannotAccessAdminEndpoints(): void
    {
        $req = $this->makeJsonRequest('GET', '/api/v1/admin/appointments', null, $this->patientUser1);
        $res = $this->app->handle($req);

        $this->assertSame(403, $res->getStatusCode());
    }
}
