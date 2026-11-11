<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Request;
use App\Repositories\ClinicScheduleRepository;
use App\Repositories\DentistRepository;
use App\Repositories\DentistScheduleRepository;
use App\Repositories\DentistTimeOffRepository;
use App\Repositories\ServiceRepository;
use App\Repositories\UserRepository;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

class AvailabilityApiTest extends TestCase
{
    private Application $app;
    private UserRepository $userRepo;
    private DentistRepository $dentistRepo;
    private ServiceRepository $serviceRepo;
    private DentistScheduleRepository $scheduleRepo;
    private DentistTimeOffRepository $timeOffRepo;
    private ClinicScheduleRepository $clinicRepo;
    private array $adminUser;
    private array $dentistUser;
    private array $patientUser;
    private int $dentistId;
    private int $serviceId;

    protected function setUp(): void
    {
        $_SESSION = [];
        TestDb::create();
        $this->app = new Application(null, false);

        $this->userRepo = new UserRepository();
        $this->dentistRepo = new DentistRepository();
        $this->serviceRepo = new ServiceRepository();
        $this->scheduleRepo = new DentistScheduleRepository();
        $this->timeOffRepo = new DentistTimeOffRepository();
        $this->clinicRepo = new ClinicScheduleRepository();

        // 1. Admin User
        $adminUserId = $this->userRepo->create(
            'admin.sched@toothcare.com',
            password_hash('AdminPass123!', PASSWORD_BCRYPT),
            'ADMIN',
            1,
            1
        );
        $this->adminUser = $this->userRepo->findById($adminUserId);

        // 2. Dentist User & Profile
        $dentistUserId = $this->userRepo->create(
            'dentist.sched@toothcare.com',
            password_hash('DentistPass123!', PASSWORD_BCRYPT),
            'DENTIST',
            1,
            1
        );
        $this->dentistUser = $this->userRepo->findById($dentistUserId);

        $this->dentistId = $this->dentistRepo->create([
            'user_id' => $dentistUserId,
            'license_number' => 'DNT-SCHED-900',
            'first_name' => 'Eduardo',
            'last_name' => 'Reyes',
            'specialization' => 'Orthodontics',
            'phone' => '09170001122',
            'is_active' => 1,
        ]);

        // 3. Regular Patient User
        $patientUserId = $this->userRepo->create(
            'patient.sched@example.com',
            password_hash('PatientPass123!', PASSWORD_BCRYPT),
            'PATIENT',
            1,
            1
        );
        $this->patientUser = $this->userRepo->findById($patientUserId);

        // 4. Service
        $this->serviceId = $this->serviceRepo->create([
            'name' => 'Orthodontic Consultation',
            'category' => 'Orthodontics',
            'price' => 2000.00,
            'duration_minutes' => 30,
            'is_active' => 1,
        ]);

        // 5. Monday Shift for Dentist: 08:00 to 17:00
        $this->scheduleRepo->create([
            'dentist_id' => $this->dentistId,
            'day_of_week' => 1,
            'start_time' => '08:00:00',
            'end_time' => '17:00:00',
            'operatory_chair' => 'Chair 1',
            'is_active' => 1,
        ]);
    }

    private function getNextMonday(): string
    {
        $tz = new DateTimeZone('Asia/Manila');
        $now = new DateTimeImmutable('now', $tz);
        $daysUntilMonday = (8 - (int) $now->format('N')) % 7;
        if ($daysUntilMonday === 0) {
            $daysUntilMonday = 7;
        }
        return $now->modify("+{$daysUntilMonday} days")->format('Y-m-d');
    }

    public function testGetAvailabilitySuccess(): void
    {
        $targetDate = $this->getNextMonday();
        $req = Request::create('GET', "/api/v1/availability?dentist_id={$this->dentistId}&service_id={$this->serviceId}&date={$targetDate}");
        $res = $this->app->handle($req);

        $this->assertSame(200, $res->getStatusCode());
        $body = json_decode($res->getBody(), true);

        $this->assertNull($body['error']);
        $this->assertNotNull($body['data']);
        $this->assertSame('Asia/Manila', $body['data']['timezone']);
        $this->assertSame($this->dentistId, $body['data']['dentist']['id']);
        $this->assertSame($this->serviceId, $body['data']['service']['id']);

        $days = $body['data']['availability'];
        $this->assertCount(1, $days);
        $this->assertSame($targetDate, $days[0]['date']);
        $this->assertTrue($days[0]['is_clinic_open']);
        $this->assertNotEmpty($days[0]['slots']);

        $firstSlot = $days[0]['slots'][0];
        $this->assertArrayHasKey('start_at', $firstSlot);
        $this->assertArrayHasKey('end_at', $firstSlot);
        $this->assertArrayHasKey('blocking_end_at', $firstSlot);
        $this->assertSame(30, $firstSlot['duration_minutes']);
        $this->assertSame(10, $firstSlot['buffer_minutes']);
    }

    public function testGetAvailabilityValidationFailures(): void
    {
        // Missing parameters
        $req = Request::create('GET', '/api/v1/availability');
        $res = $this->app->handle($req);
        $this->assertSame(422, $res->getStatusCode());

        // Range exceeding 14 days
        $targetDate = $this->getNextMonday();
        $farDate = (new DateTimeImmutable($targetDate))->modify('+20 days')->format('Y-m-d');
        $reqRange = Request::create('GET', "/api/v1/availability?dentist_id={$this->dentistId}&service_id={$this->serviceId}&date={$targetDate}&end_date={$farDate}");
        $resRange = $this->app->handle($reqRange);
        $this->assertSame(422, $resRange->getStatusCode());
    }

    public function testClinicOperatingHoursEndpoints(): void
    {
        // Public get
        $reqGet = Request::create('GET', '/api/v1/clinic/hours');
        $resGet = $this->app->handle($reqGet);
        $this->assertSame(200, $resGet->getStatusCode());
        $bodyGet = json_decode($resGet->getBody(), true);
        $this->assertCount(7, $bodyGet['data']);

        // Admin update
        $reqPut = Request::create(
            'PUT',
            '/api/v1/admin/clinic/hours',
            ['content-type' => 'application/json'],
            json_encode([
                'day_of_week' => 6,
                'opening_time' => '08:30:00',
                'closing_time' => '13:00:00',
                'is_closed' => 0,
            ])
        );
        $reqPut->setUser($this->adminUser);
        $resPut = $this->app->handle($reqPut);
        $this->assertSame(200, $resPut->getStatusCode());

        // Unauthenticated update rejected with 401
        $reqUnauth = Request::create(
            'PUT',
            '/api/v1/admin/clinic/hours',
            ['content-type' => 'application/json'],
            json_encode([
                'day_of_week' => 1,
                'opening_time' => '08:00:00',
                'closing_time' => '17:00:00',
                'is_closed' => 0,
            ])
        );
        $resUnauth = $this->app->handle($reqUnauth);
        $this->assertSame(401, $resUnauth->getStatusCode());
    }

    public function testClinicClosuresLifecycle(): void
    {
        // Create closure
        $reqPost = Request::create(
            'POST',
            '/api/v1/admin/clinic/closures',
            ['content-type' => 'application/json'],
            json_encode([
                'title' => 'Christmas Holiday',
                'start_at' => '2026-12-25 00:00:00',
                'end_at' => '2026-12-25 23:59:59',
                'closure_type' => 'HOLIDAY',
                'notes' => 'Clinic closed for Christmas.',
            ])
        );
        $reqPost->setUser($this->adminUser);
        $resPost = $this->app->handle($reqPost);
        $this->assertSame(201, $resPost->getStatusCode());
        $closure = json_decode($resPost->getBody(), true)['data'];
        $closureId = (int) $closure['id'];

        // Get closures
        $reqGet = Request::create('GET', '/api/v1/clinic/closures');
        $resGet = $this->app->handle($reqGet);
        $this->assertSame(200, $resGet->getStatusCode());

        // Delete closure
        $reqDel = Request::create('DELETE', "/api/v1/admin/clinic/closures/{$closureId}");
        $reqDel->setUser($this->adminUser);
        $resDel = $this->app->handle($reqDel);
        $this->assertSame(200, $resDel->getStatusCode());
    }

    public function testDentistScheduleManagementAndConflictRejection(): void
    {
        // Admin creates Tuesday shift: 09:00 to 15:00
        $reqCreate = Request::create(
            'POST',
            "/api/v1/admin/dentists/{$this->dentistId}/schedules",
            ['content-type' => 'application/json'],
            json_encode([
                'day_of_week' => 2,
                'start_time' => '09:00:00',
                'end_time' => '15:00:00',
                'operatory_chair' => 'Chair 2',
                'is_active' => 1,
            ])
        );
        $reqCreate->setUser($this->adminUser);
        $resCreate = $this->app->handle($reqCreate);
        $this->assertSame(201, $resCreate->getStatusCode());
        $sched = json_decode($resCreate->getBody(), true)['data'];
        $schedId = (int) $sched['id'];

        // Colliding shift on Tuesday (10:00 to 14:00) should be rejected with 409 Conflict
        $reqCollide = Request::create(
            'POST',
            "/api/v1/admin/dentists/{$this->dentistId}/schedules",
            ['content-type' => 'application/json'],
            json_encode([
                'day_of_week' => 2,
                'start_time' => '10:00:00',
                'end_time' => '14:00:00',
                'operatory_chair' => 'Chair 2',
                'is_active' => 1,
            ])
        );
        $reqCollide->setUser($this->adminUser);
        $resCollide = $this->app->handle($reqCollide);
        $this->assertSame(409, $resCollide->getStatusCode());

        // Shift extending past clinic closing (18:00 when clinic closes at 17:00) rejected with 422
        $reqLate = Request::create(
            'POST',
            "/api/v1/admin/dentists/{$this->dentistId}/schedules",
            ['content-type' => 'application/json'],
            json_encode([
                'day_of_week' => 3,
                'start_time' => '14:00:00',
                'end_time' => '18:00:00',
                'operatory_chair' => 'Chair 1',
                'is_active' => 1,
            ])
        );
        $reqLate->setUser($this->adminUser);
        $resLate = $this->app->handle($reqLate);
        $this->assertSame(422, $resLate->getStatusCode());

        // Delete shift
        $reqDelete = Request::create('DELETE', "/api/v1/admin/dentists/{$this->dentistId}/schedules/{$schedId}");
        $reqDelete->setUser($this->adminUser);
        $resDelete = $this->app->handle($reqDelete);
        $this->assertSame(200, $resDelete->getStatusCode());
    }

    public function testDentistTimeOffManagementAndPrivacyMasking(): void
    {
        // Admin schedules leave
        $reqCreate = Request::create(
            'POST',
            "/api/v1/admin/dentists/{$this->dentistId}/time-off",
            ['content-type' => 'application/json'],
            json_encode([
                'start_at' => '2026-11-20 08:00:00',
                'end_at' => '2026-11-20 17:00:00',
                'reason' => 'Confidential Medical Leave',
            ])
        );
        $reqCreate->setUser($this->adminUser);
        $resCreate = $this->app->handle($reqCreate);
        $this->assertSame(201, $resCreate->getStatusCode());
        $timeOff = json_decode($resCreate->getBody(), true)['data'];
        $timeOffId = (int) $timeOff['id'];

        // 1. Admin views time-off -> Sees confidential reason
        $reqAdminView = Request::create('GET', "/api/v1/admin/dentists/{$this->dentistId}/time-off");
        $reqAdminView->setUser($this->adminUser);
        $resAdminView = $this->app->handle($reqAdminView);
        $bodyAdmin = json_decode($resAdminView->getBody(), true);
        $this->assertSame('Confidential Medical Leave', $bodyAdmin['data']['time_off'][0]['reason']);

        // 2. Unauthenticated viewer views time-off -> Reason is masked to "Unavailable" for privacy
        $reqPublicView = Request::create('GET', "/api/v1/dentists/{$this->dentistId}/time-off");
        $resPublicView = $this->app->handle($reqPublicView);
        $bodyPublic = json_decode($resPublicView->getBody(), true);
        $this->assertSame('Unavailable', $bodyPublic['data']['time_off'][0]['reason']);

        // Clean up
        $reqDelete = Request::create('DELETE', "/api/v1/admin/dentists/{$this->dentistId}/time-off/{$timeOffId}");
        $reqDelete->setUser($this->adminUser);
        $resDelete = $this->app->handle($reqDelete);
        $this->assertSame(200, $resDelete->getStatusCode());
    }
}
