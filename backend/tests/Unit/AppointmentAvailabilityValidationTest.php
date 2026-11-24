<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\HttpException;
use App\Repositories\AppointmentRepository;
use App\Repositories\ClinicScheduleRepository;
use App\Repositories\DentistScheduleRepository;
use App\Repositories\DentistTimeOffRepository;
use App\Services\AppointmentService;
use App\Services\AvailabilityService;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Comprehensive verification for Centralized Availability Validation,
 * Receptionist Approval Revalidation, Conflict-Aware Rejection Mapping,
 * Reference Search, Summary Counts, and Notification Reason Persistence.
 */
class AppointmentAvailabilityValidationTest extends TestCase
{
    private PDO $pdo;
    private AvailabilityService $availabilityService;
    private AppointmentService $appointmentService;
    private AppointmentRepository $appointmentRepo;
    private DentistScheduleRepository $scheduleRepo;
    private DentistTimeOffRepository $timeOffRepo;
    private ClinicScheduleRepository $clinicRepo;
    private DateTimeZone $tz;
    private DateTimeImmutable $simulatedNow;

    protected function setUp(): void
    {
        $this->pdo = TestDb::create();
        $this->tz = new DateTimeZone('Asia/Manila');
        // Monday Nov 16, 2026 06:00 AM PST
        $this->simulatedNow = new DateTimeImmutable('2026-11-16 06:00:00', $this->tz);

        $this->appointmentRepo = new AppointmentRepository();
        $this->scheduleRepo = new DentistScheduleRepository();
        $this->timeOffRepo = new DentistTimeOffRepository();
        $this->clinicRepo = new ClinicScheduleRepository();
        $this->availabilityService = new AvailabilityService();
        $this->appointmentService = new AppointmentService();

        $this->seedFixtures();
    }

    private function seedFixtures(): void
    {
        $this->pdo->exec('
            INSERT INTO users (id, email, password_hash, role, is_active) VALUES
            (10, "patient1@test.com", "hash", "PATIENT", 1),
            (11, "patient2@test.com", "hash", "PATIENT", 1),
            (30, "dr.santos@test.com", "hash", "DENTIST", 1),
            (31, "dr.reyes@test.com", "hash", "DENTIST", 1),
            (99, "receptionist@test.com", "hash", "RECEPTIONIST", 1);

            INSERT INTO patients (id, user_id, first_name, last_name, date_of_birth, phone) VALUES
            (1, 10, "Juan", "Dela Cruz", "1995-05-18", "+639171111111"),
            (2, 11, "Maria", "Garcia", "1992-03-10", "+639172222222");

            INSERT INTO dentists (id, user_id, license_number, first_name, last_name, specialization, phone, default_operatory_chair, is_active) VALUES
            (1, 30, "PRC-1001", "Maria", "Santos", "General Dentistry", "+639175551111", "Chair 1", 1),
            (2, 31, "PRC-1002", "Roberto", "Reyes", "Orthodontics", "+639175552222", "Chair 2", 1);

            INSERT INTO services (id, name, category, price, duration_minutes, is_active) VALUES
            (1, "Dental Prophylaxis", "Preventive", 1500.00, 30, 1),
            (2, "Root Canal Therapy", "Restorative", 6000.00, 90, 1);
        ');

        // Dentist 1 works Mon & Wed split shifts (08:00-12:00, 13:00-17:00) on Chair 1
        foreach ([1, 3] as $day) {
            $this->scheduleRepo->create([
                'dentist_id' => 1,
                'day_of_week' => $day,
                'start_time' => '08:00:00',
                'end_time' => '12:00:00',
                'operatory_chair' => 'Chair 1',
                'is_active' => 1,
            ]);
            $this->scheduleRepo->create([
                'dentist_id' => 1,
                'day_of_week' => $day,
                'start_time' => '13:00:00',
                'end_time' => '17:00:00',
                'operatory_chair' => 'Chair 1',
                'is_active' => 1,
            ]);
        }

        // Dentist 2 works Tue (day 2) 08:00-17:00 on Chair 2, and Mon (day 1) on Chair 1 (for room conflict test)
        $this->scheduleRepo->create([
            'dentist_id' => 2,
            'day_of_week' => 2,
            'start_time' => '08:00:00',
            'end_time' => '17:00:00',
            'operatory_chair' => 'Chair 2',
            'is_active' => 1,
        ]);
        $this->scheduleRepo->create([
            'dentist_id' => 2,
            'day_of_week' => 1,
            'start_time' => '08:00:00',
            'end_time' => '17:00:00',
            'operatory_chair' => 'Chair 1',
            'is_active' => 1,
        ]);
    }

    public function testValidateSlotDetectsAllConflictCategories(): void
    {
        // 1. Valid working slot: Mon Nov 16 09:00 AM
        $valid = $this->availabilityService->validateSlot(
            1,
            1,
            new DateTimeImmutable('2026-11-16 09:00:00', $this->tz),
            $this->simulatedNow
        );
        $this->assertTrue($valid['available']);
        $this->assertSame(AvailabilityService::REASON_AVAILABLE, $valid['reason_code']);

        // 2. Dentist not working on Tuesday (day 2)
        $notWorking = $this->availabilityService->validateSlot(
            1,
            1,
            new DateTimeImmutable('2026-11-17 09:00:00', $this->tz),
            $this->simulatedNow
        );
        $this->assertFalse($notWorking['available']);
        $this->assertSame(AvailabilityService::REASON_NOT_WORKING_DAY, $notWorking['reason_code']);
        $this->assertNotEmpty($notWorking['suggested_rejection_reason']);

        // 3. Dentist lunch break 12:15 PM (between split shifts 08:00-12:00 and 13:00-17:00)
        $lunchBreak = $this->availabilityService->validateSlot(
            1,
            1,
            new DateTimeImmutable('2026-11-16 12:15:00', $this->tz),
            $this->simulatedNow
        );
        $this->assertFalse($lunchBreak['available']);
        $this->assertSame(AvailabilityService::REASON_NOT_ON_DUTY, $lunchBreak['reason_code']);

        // 4. Service duration + buffer exceeds shift end (90m + 10m buffer starting at 11:00 > 12:00)
        $durationOverflow = $this->availabilityService->validateSlot(
            1,
            2,
            new DateTimeImmutable('2026-11-16 11:00:00', $this->tz),
            $this->simulatedNow
        );
        $this->assertFalse($durationOverflow['available']);
        $this->assertSame(AvailabilityService::REASON_SERVICE_DURATION_CONFLICT, $durationOverflow['reason_code']);

        // 5. Room conflict: Dentist 1 books Chair 1 at 09:00-09:30, Dentist 2 tries Chair 1 at 09:00
        $this->appointmentService->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-16 09:00:00',
        ], $this->simulatedNow);

        $roomConflict = $this->availabilityService->validateSlot(
            2,
            1,
            new DateTimeImmutable('2026-11-16 09:00:00', $this->tz),
            $this->simulatedNow
        );
        $this->assertFalse($roomConflict['available']);
        $this->assertSame(AvailabilityService::REASON_ROOM_CONFLICT, $roomConflict['reason_code']);
    }

    public function testGetAvailabilityReturnsSpecificReasonAndValidatedAlternatives(): void
    {
        // Dentist 1 does not work Tuesdays (2026-11-17), while Dentist 2 DOES work Tuesday,
        // and Dentist 1 has slots on Wednesday (2026-11-18).
        $res = $this->availabilityService->getAvailability(1, 1, '2026-11-17', '2026-11-17', $this->simulatedNow);

        $day = $res['availability'][0];
        $this->assertEmpty($day['slots']);
        $this->assertSame(AvailabilityService::REASON_NOT_WORKING_DAY, $day['reason_code']);
        $this->assertStringContainsString('not scheduled to work', (string) $day['reason_message']);

        $this->assertArrayHasKey('alternatives', $res);
        $this->assertNotEmpty($res['alternatives']['next_available_dates']);
        $this->assertSame('2026-11-18', $res['alternatives']['next_available_dates'][0]['date']);
        $this->assertNotEmpty($res['alternatives']['alternative_dentists']);
        $this->assertSame(2, $res['alternatives']['alternative_dentists'][0]['dentist_id']);
    }

    public function testConfirmAppointmentBlocksWhenDentistTakesApprovedLeaveAfterBooking(): void
    {
        // Patient books valid Wednesday slot (2026-11-18 09:00)
        $appt = $this->appointmentService->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-18 09:00:00',
        ], $this->simulatedNow);

        // Dentist subsequently takes approved leave covering Wednesday morning
        $this->timeOffRepo->create([
            'dentist_id' => 1,
            'start_at' => '2026-11-18 08:00:00',
            'end_at' => '2026-11-18 12:00:00',
            'reason' => 'Medical Conference',
            'approved_by_user_id' => 99,
        ]);

        // Pre-approval revalidation reports APPROVED_LEAVE with suggested rejection reason
        $check = $this->appointmentService->validateAppointmentForApproval((int) $appt['id'], $this->simulatedNow);
        $this->assertFalse($check['available']);
        $this->assertSame(AvailabilityService::REASON_APPROVED_LEAVE, $check['reason_code']);
        $this->assertNotEmpty($check['suggested_rejection_reason']);

        // Attempting to confirm MUST fail with 409 and leave appointment PENDING
        try {
            $this->appointmentService->confirmAppointment(99, (int) $appt['id'], $this->simulatedNow);
            $this->fail('Expected confirmAppointment to throw 409 HttpException when dentist is on approved leave.');
        } catch (HttpException $e) {
            $this->assertSame(409, $e->getStatusCode());
            $this->assertSame(AvailabilityService::REASON_APPROVED_LEAVE, $e->getErrorCode());
            $details = $e->getDetails();
            $this->assertTrue($details['appointment_remains_pending']);
            $this->assertNotEmpty($details['suggested_rejection_reason']);
        }

        $stillPending = $this->appointmentRepo->findById((int) $appt['id']);
        $this->assertSame('PENDING', $stillPending['status']);
    }

    public function testConfirmAppointmentBlocksWhenClinicClosureAddedAfterBooking(): void
    {
        $appt = $this->appointmentService->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-18 14:00:00',
        ], $this->simulatedNow);

        $this->clinicRepo->createClosure([
            'title' => 'Emergency Maintenance',
            'start_at' => '2026-11-18 00:00:00',
            'end_at' => '2026-11-18 23:59:59',
            'closure_type' => 'MAINTENANCE',
        ]);

        try {
            $this->appointmentService->confirmAppointment(99, (int) $appt['id'], $this->simulatedNow);
            $this->fail('Expected confirmAppointment to fail during clinic closure.');
        } catch (HttpException $e) {
            $this->assertSame(409, $e->getStatusCode());
            $this->assertSame(AvailabilityService::REASON_UNAVAILABLE_PERIOD, $e->getErrorCode());
        }
    }

    public function testRejectionPreservesConflictCodeAndNotifiesPatientWithReason(): void
    {
        $appt = $this->appointmentService->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-18 10:00:00',
        ], $this->simulatedNow);

        $reason = 'The selected dentist is unavailable on your requested date. Please choose another date or dentist.';
        $rejected = $this->appointmentService->rejectAppointment(99, (int) $appt['id'], [
            'reason' => $reason,
            'conflict_reason_code' => AvailabilityService::REASON_APPROVED_LEAVE,
        ]);

        $this->assertSame('REJECTED', $rejected['status']);
        $this->assertSame($reason, $rejected['cancellation_reason']);

        // History retains conflict metadata
        $history = $this->appointmentRepo->getStatusHistory((int) $appt['id']);
        $lastEntry = end($history);
        $this->assertSame('REJECTED', $lastEntry['new_status']);
        $this->assertSame($reason, $lastEntry['reason']);
        $meta = json_decode((string) $lastEntry['metadata'], true);
        $this->assertSame(AvailabilityService::REASON_APPROVED_LEAVE, $meta['conflict_reason_code']);

        // Patient persisted in-app notification includes the patient-facing rejection reason
        $stmt = $this->pdo->prepare("SELECT message FROM notifications WHERE user_id = 10 AND type = 'APPOINTMENT_REJECTED' ORDER BY id DESC LIMIT 1");
        $stmt->execute();
        $notifMessage = (string) $stmt->fetchColumn();
        $this->assertStringContainsString($reason, $notifMessage);
    }

    public function testListAdminAppointmentsReturnsSummaryConflictCountAndReferenceSearch(): void
    {
        $appt = $this->appointmentService->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-18 10:00:00',
        ], $this->simulatedNow);

        // Add leave so pending appointment is flagged as conflict
        $this->timeOffRepo->create([
            'dentist_id' => 1,
            'start_at' => '2026-11-18 09:00:00',
            'end_at' => '2026-11-18 12:00:00',
            'reason' => 'Dentist Leave',
        ]);

        $list = $this->appointmentService->listAdminAppointments(['search' => '#' . $appt['id']], 1, 15);
        $this->assertCount(1, $list['items']);
        $this->assertSame((int) $appt['id'], (int) $list['items'][0]['id']);
        $this->assertFalse($list['items'][0]['availability_check']['available']);
        $this->assertSame(AvailabilityService::REASON_APPROVED_LEAVE, $list['items'][0]['availability_check']['reason_code']);

        $this->assertSame(1, $list['summary']['pending_review']);
        $this->assertSame(1, $list['summary']['scheduling_conflicts']);
    }
}
