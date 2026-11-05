<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\HttpException;
use App\Repositories\AppointmentRepository;
use App\Repositories\ClinicScheduleRepository;
use App\Repositories\DentistRepository;
use App\Repositories\DentistScheduleRepository;
use App\Repositories\DentistTimeOffRepository;
use App\Repositories\ServiceRepository;
use App\Services\AvailabilityService;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

class AvailabilityServiceTest extends TestCase
{
    private AvailabilityService $service;
    private DentistRepository $dentistRepo;
    private ServiceRepository $serviceRepo;
    private DentistScheduleRepository $scheduleRepo;
    private DentistTimeOffRepository $timeOffRepo;
    private ClinicScheduleRepository $clinicRepo;
    private AppointmentRepository $appointmentRepo;
    private \PDO $pdo;
    private DateTimeZone $tz;
    private DateTimeImmutable $simulatedNow;

    protected function setUp(): void
    {
        $this->pdo = TestDb::create();
        $this->tz = new DateTimeZone('Asia/Manila');
        // Monday Nov 9, 2026 at 06:00:00 AM Manila
        $this->simulatedNow = new DateTimeImmutable('2026-11-09 06:00:00', $this->tz);

        $this->dentistRepo = new DentistRepository();
        $this->serviceRepo = new ServiceRepository();
        $this->scheduleRepo = new DentistScheduleRepository();
        $this->timeOffRepo = new DentistTimeOffRepository();
        $this->clinicRepo = new ClinicScheduleRepository();
        $this->appointmentRepo = new AppointmentRepository();

        $this->service = new AvailabilityService(
            $this->dentistRepo,
            $this->serviceRepo,
            $this->scheduleRepo,
            $this->timeOffRepo,
            $this->clinicRepo,
            $this->appointmentRepo
        );

        $this->seedBaseData();
    }

    private function seedBaseData(): void
    {
        // 1. Dentist (ID 1)
        $this->pdo->exec('
            INSERT INTO users (id, email, password_hash, role, is_active)
            VALUES (10, "dr.santos@toothcare.com", "hash", "DENTIST", 1);

            INSERT INTO dentists (id, user_id, license_number, first_name, last_name, specialization, phone, is_active)
            VALUES (1, 10, "DNT-1001", "Maria", "Santos", "General Dentistry", "09171234567", 1);
        ');

        // 2. Services:
        // Service 1: 30 mins
        // Service 2: 60 mins
        // Service 3: 15 mins
        // Service 4: 90 mins
        // Service 5: 120 mins
        // Service 99: Inactive (is_active = 0)
        $this->pdo->exec('
            INSERT INTO services (id, name, price, duration_minutes, is_active) VALUES
            (1, "Routine Cleaning 30m", 1200.00, 30, 1),
            (2, "Root Canal 60m", 4500.00, 60, 1),
            (3, "Consultation 15m", 500.00, 15, 1),
            (4, "Deep Scaling 90m", 3000.00, 90, 1),
            (5, "Complex Surgery 120m", 8000.00, 120, 1),
            (99, "Legacy Discontinued Service", 1000.00, 30, 0);
        ');

        // 3. Dentist standard Monday shift: 08:00:00 to 17:00:00 (Day 1)
        $this->scheduleRepo->create([
            'dentist_id' => 1,
            'day_of_week' => 1,
            'start_time' => '08:00:00',
            'end_time' => '17:00:00',
            'operatory_chair' => 'Chair 1',
            'is_active' => 1,
        ]);
    }

    // =========================================================================
    // 20 SCHEDULE & AVAILABILITY BOUNDARY CONDITIONS
    // =========================================================================

    /**
     * 1. Slot before clinic opening
     * Clinic opens at 08:00:00. Even if dentist shift were early (e.g. 07:00),
     * effective window clamps to 08:00 and no slot starts before 08:00:00.
     */
    public function testSlotBeforeClinicOpeningCannotBeGenerated(): void
    {
        $res = $this->service->getAvailability(1, 1, '2026-11-09', '2026-11-09', $this->simulatedNow);
        $slots = $res['availability'][0]['slots'];

        $this->assertNotEmpty($slots);
        foreach ($slots as $slot) {
            $dt = new DateTimeImmutable($slot['start_at'], $this->tz);
            $this->assertGreaterThanOrEqual('08:00:00', $dt->format('H:i:s'));
        }
    }

    /**
     * 2. Slot exactly at clinic opening
     * First candidate slot on Monday should start exactly at 08:00:00.
     */
    public function testSlotExactlyAtClinicOpeningIsGenerated(): void
    {
        $res = $this->service->getAvailability(1, 1, '2026-11-09', '2026-11-09', $this->simulatedNow);
        $firstSlot = $res['availability'][0]['slots'][0];

        $dt = new DateTimeImmutable($firstSlot['start_at'], $this->tz);
        $this->assertSame('08:00:00', $dt->format('H:i:s'));
    }

    /**
     * 3. Slot ending exactly at clinic closing
     * Service 30m + buffer 10m = 40m blocking window.
     * Starts at 16:15: service ends at 16:45, blocking window ends at 16:55 (<= 17:00).
     */
    public function testSlotEndingExactlyAtClinicClosing(): void
    {
        $res = $this->service->getAvailability(1, 1, '2026-11-09', '2026-11-09', $this->simulatedNow);
        $slots = $res['availability'][0]['slots'];
        $lastSlot = end($slots);

        $endDt = new DateTimeImmutable($lastSlot['blocking_end_at'], $this->tz);
        $this->assertLessThanOrEqual('17:00:00', $endDt->format('H:i:s'));
    }

    /**
     * 4. Slot extending beyond clinic closing
     * Candidate starting at 16:30 with 30m duration + 10m buffer = 17:10 (exceeds 17:00).
     * Must NOT be generated.
     */
    public function testSlotExtendingBeyondClinicClosingIsExcluded(): void
    {
        $res = $this->service->getAvailability(1, 1, '2026-11-09', '2026-11-09', $this->simulatedNow);
        $slots = $res['availability'][0]['slots'];

        foreach ($slots as $slot) {
            $blockingEnd = new DateTimeImmutable($slot['blocking_end_at'], $this->tz);
            $this->assertLessThanOrEqual('17:00:00', $blockingEnd->format('H:i:s'));
        }
    }

    /**
     * 5. Slot crossing lunch/schedule break
     * If dentist shift has a break (Shift A: 08:00-12:00, Shift B: 13:00-17:00),
     * no slot can bridge across 12:00-13:00.
     */
    public function testSlotCrossingLunchOrScheduleBreakIsExcluded(): void
    {
        // Tuesday (Day 2): Split shifts with 12:00-13:00 lunch break
        $this->scheduleRepo->create([
            'dentist_id' => 1,
            'day_of_week' => 2,
            'start_time' => '08:00:00',
            'end_time' => '12:00:00',
            'is_active' => 1,
        ]);
        $this->scheduleRepo->create([
            'dentist_id' => 1,
            'day_of_week' => 2,
            'start_time' => '13:00:00',
            'end_time' => '17:00:00',
            'is_active' => 1,
        ]);

        $res = $this->service->getAvailability(1, 1, '2026-11-10', '2026-11-10', $this->simulatedNow);
        $slots = $res['availability'][0]['slots'];

        foreach ($slots as $slot) {
            $start = new DateTimeImmutable($slot['start_at'], $this->tz)->format('H:i:s');
            $blockEnd = new DateTimeImmutable($slot['blocking_end_at'], $this->tz)->format('H:i:s');

            // Must NOT start in or cross into [12:00, 13:00)
            $isInsideBreak = ($start < '13:00:00' && $blockEnd > '12:00:00');
            $this->assertFalse($isInsideBreak, "Slot [{$start}, {$blockEnd}) crossed lunch break.");
        }
    }

    /**
     * 6. Full-day dentist time off
     * If dentist is on leave for the entire day, zero slots generated.
     */
    public function testFullDayDentistTimeOffBlocksAllSlots(): void
    {
        $this->timeOffRepo->create([
            'dentist_id' => 1,
            'start_at' => '2026-11-09 00:00:00',
            'end_at' => '2026-11-09 23:59:59',
            'reason' => 'Annual Vacation Leave',
        ]);

        $res = $this->service->getAvailability(1, 1, '2026-11-09', '2026-11-09', $this->simulatedNow);
        $this->assertEmpty($res['availability'][0]['slots']);
    }

    /**
     * 7. Partial-day dentist time off
     * Time-off from 10:00 to 12:00 suppresses only overlapping slots; 08:00 and 13:00 remain bookable.
     */
    public function testPartialDayDentistTimeOffBlocksOverlappingSlots(): void
    {
        $this->timeOffRepo->create([
            'dentist_id' => 1,
            'start_at' => '2026-11-09 10:00:00',
            'end_at' => '2026-11-09 12:00:00',
            'reason' => 'Dental Association Meeting',
        ]);

        $res = $this->service->getAvailability(1, 1, '2026-11-09', '2026-11-09', $this->simulatedNow);
        $slots = $res['availability'][0]['slots'];

        $this->assertNotEmpty($slots);
        foreach ($slots as $slot) {
            $start = new DateTimeImmutable($slot['start_at'], $this->tz)->format('H:i:s');
            $blockEnd = new DateTimeImmutable($slot['blocking_end_at'], $this->tz)->format('H:i:s');

            $overlapsLeave = ($start < '12:00:00' && $blockEnd > '10:00:00');
            $this->assertFalse($overlapsLeave, "Slot [{$start}, {$blockEnd}) overlapped partial time-off.");
        }
    }

    /**
     * 8. Clinic-wide closure
     * Facility holiday closure suppresses all slots regardless of dentist shifts.
     */
    public function testClinicWideClosureSuppressesSlots(): void
    {
        $this->clinicRepo->createClosure([
            'title' => 'National Holiday',
            'start_at' => '2026-11-09 00:00:00',
            'end_at' => '2026-11-09 23:59:59',
            'closure_type' => 'HOLIDAY',
        ]);

        $res = $this->service->getAvailability(1, 1, '2026-11-09', '2026-11-09', $this->simulatedNow);
        $this->assertEmpty($res['availability'][0]['slots']);
    }

    /**
     * 9. Inactive dentist (rejected)
     */
    public function testInactiveDentistIsRejected(): void
    {
        $this->pdo->exec('UPDATE dentists SET is_active = 0 WHERE id = 1');

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Dentist is currently inactive and cannot accept bookings.');
        $this->service->getAvailability(1, 1, '2026-11-09', '2026-11-09', $this->simulatedNow);
    }

    /**
     * 10. Inactive service (rejected)
     */
    public function testInactiveServiceIsRejected(): void
    {
        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Service is currently inactive and cannot be booked.');
        $this->service->getAvailability(1, 99, '2026-11-09', '2026-11-09', $this->simulatedNow);
    }

    /**
     * 11. Past date (rejected)
     */
    public function testPastDateIsRejected(): void
    {
        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Availability cannot be queried for past dates.');
        // Querying Nov 8 when simulated now is Nov 9
        $this->service->getAvailability(1, 1, '2026-11-08', '2026-11-08', $this->simulatedNow);
    }

    /**
     * 12. Date outside booking horizon (>90d, rejected)
     */
    public function testDateOutsideBookingHorizonIsRejected(): void
    {
        $futureDate = $this->simulatedNow->modify('+95 days')->format('Y-m-d');

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('exceeds the maximum booking horizon of 90 days');
        $this->service->getAvailability(1, 1, $futureDate, $futureDate, $this->simulatedNow);
    }

    /**
     * 13. Slot violating minimum advance notice (<2h, excluded)
     * If current time is 08:30 on Nov 9, candidate slots before 10:30 (120 mins notice) are excluded.
     */
    public function testSlotViolatingMinimumAdvanceNoticeIsExcluded(): void
    {
        $midMorningNow = new DateTimeImmutable('2026-11-09 08:30:00', $this->tz);
        $res = $this->service->getAvailability(1, 1, '2026-11-09', '2026-11-09', $midMorningNow);
        $slots = $res['availability'][0]['slots'];

        $this->assertNotEmpty($slots);
        foreach ($slots as $slot) {
            $dt = new DateTimeImmutable($slot['start_at'], $this->tz);
            $this->assertGreaterThanOrEqual('10:30:00', $dt->format('H:i:s'));
        }
    }

    /**
     * 14. Short service duration (15m and 30m)
     */
    public function testShortServiceDurationsGenerateAccurateIntervals(): void
    {
        // 15m service (ID 3): Duration 15m + Buffer 10m = 25m blocking interval
        $res15 = $this->service->getAvailability(1, 3, '2026-11-09', '2026-11-09', $this->simulatedNow);
        $first15 = $res15['availability'][0]['slots'][0];
        $this->assertSame(15, $first15['duration_minutes']);
        $this->assertSame(10, $first15['buffer_minutes']);

        $start15 = new DateTimeImmutable($first15['start_at'], $this->tz);
        $end15 = new DateTimeImmutable($first15['end_at'], $this->tz);
        $block15 = new DateTimeImmutable($first15['blocking_end_at'], $this->tz);

        $this->assertSame(15, ($end15->getTimestamp() - $start15->getTimestamp()) / 60);
        $this->assertSame(25, ($block15->getTimestamp() - $start15->getTimestamp()) / 60);
    }

    /**
     * 15. Long service duration (60m, 90m, 120m)
     */
    public function testLongServiceDurationsGenerateAccurateIntervals(): void
    {
        // 90m service (ID 4): Duration 90m + Buffer 10m = 100m blocking interval
        $res90 = $this->service->getAvailability(1, 4, '2026-11-09', '2026-11-09', $this->simulatedNow);
        $first90 = $res90['availability'][0]['slots'][0];
        $this->assertSame(90, $first90['duration_minutes']);
        $this->assertSame(10, $first90['buffer_minutes']);

        $start90 = new DateTimeImmutable($first90['start_at'], $this->tz);
        $end90 = new DateTimeImmutable($first90['end_at'], $this->tz);
        $block90 = new DateTimeImmutable($first90['blocking_end_at'], $this->tz);

        $this->assertSame(90, ($end90->getTimestamp() - $start90->getTimestamp()) / 60);
        $this->assertSame(100, ($block90->getTimestamp() - $start90->getTimestamp()) / 60);
    }

    /**
     * 16. Buffer extending beyond schedule (rejected)
     * For 60m service + 10m buffer = 70m.
     * Slot at 16:00 ends at 17:00, but buffer ends at 17:10 (exceeds shift end of 17:00).
     * Therefore 16:00 cannot be generated; last valid slot is 15:45 (blocking ends at 16:55).
     */
    public function testBufferExtendingBeyondScheduleIsRejected(): void
    {
        $res = $this->service->getAvailability(1, 2, '2026-11-09', '2026-11-09', $this->simulatedNow);
        $slots = $res['availability'][0]['slots'];

        foreach ($slots as $slot) {
            $blockEnd = new DateTimeImmutable($slot['blocking_end_at'], $this->tz);
            $this->assertLessThanOrEqual('17:00:00', $blockEnd->format('H:i:s'));
        }

        $lastSlot = end($slots);
        $lastStart = new DateTimeImmutable($lastSlot['start_at'], $this->tz)->format('H:i:s');
        $this->assertNotSame('16:00:00', $lastStart, 'Slot at 16:00 must not be allowed because buffer exceeds 17:00.');
    }

    /**
     * 17. Overlapping PENDING appointment (blocked)
     */
    public function testOverlappingPendingAppointmentBlocksSlot(): void
    {
        $this->appointmentRepo->create([
            'patient_id' => 1,
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-09 09:00:00',
            'end_at' => '2026-11-09 09:40:00',
            'duration_snapshot' => 30,
            'price_snapshot' => 1200.00,
            'status' => 'PENDING',
        ]);

        $res = $this->service->getAvailability(1, 1, '2026-11-09', '2026-11-09', $this->simulatedNow);
        $slots = $res['availability'][0]['slots'];

        foreach ($slots as $slot) {
            $start = new DateTimeImmutable($slot['start_at'], $this->tz)->format('H:i:s');
            $blockEnd = new DateTimeImmutable($slot['blocking_end_at'], $this->tz)->format('H:i:s');

            $overlapsPending = ($start < '09:40:00' && $blockEnd > '09:00:00');
            $this->assertFalse($overlapsPending, "Slot [{$start}, {$blockEnd}) overlapped PENDING appointment.");
        }
    }

    /**
     * 18. Overlapping CONFIRMED appointment (blocked)
     */
    public function testOverlappingConfirmedAppointmentBlocksSlot(): void
    {
        $this->appointmentRepo->create([
            'patient_id' => 1,
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-09 14:00:00',
            'end_at' => '2026-11-09 14:40:00',
            'duration_snapshot' => 30,
            'price_snapshot' => 1200.00,
            'status' => 'CONFIRMED',
        ]);

        $res = $this->service->getAvailability(1, 1, '2026-11-09', '2026-11-09', $this->simulatedNow);
        $slots = $res['availability'][0]['slots'];

        foreach ($slots as $slot) {
            $start = new DateTimeImmutable($slot['start_at'], $this->tz)->format('H:i:s');
            $blockEnd = new DateTimeImmutable($slot['blocking_end_at'], $this->tz)->format('H:i:s');

            $overlapsConfirmed = ($start < '14:40:00' && $blockEnd > '14:00:00');
            $this->assertFalse($overlapsConfirmed, "Slot [{$start}, {$blockEnd}) overlapped CONFIRMED appointment.");
        }
    }

    /**
     * 19. Overlapping CANCELLED appointment (available)
     * Cancelled appointment must NOT block candidate slots.
     */
    public function testOverlappingCancelledAppointmentDoesNotBlock(): void
    {
        $this->appointmentRepo->create([
            'patient_id' => 1,
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-09 11:00:00',
            'end_at' => '2026-11-09 11:40:00',
            'duration_snapshot' => 30,
            'price_snapshot' => 1200.00,
            'status' => 'CANCELLED',
        ]);

        $res = $this->service->getAvailability(1, 1, '2026-11-09', '2026-11-09', $this->simulatedNow);
        $slots = $res['availability'][0]['slots'];

        $foundSlotAt11 = false;
        foreach ($slots as $slot) {
            $start = new DateTimeImmutable($slot['start_at'], $this->tz)->format('H:i:s');
            if ($start === '11:00:00') {
                $foundSlotAt11 = true;
                break;
            }
        }

        $this->assertTrue($foundSlotAt11, 'Slot at 11:00:00 should be available since prior booking is CANCELLED.');
    }

    /**
     * 20. Adjacent non-overlapping intervals (available)
     * If an existing appointment's blocking interval ends at 10:00:00,
     * a candidate slot starting at 10:00:00 is perfectly valid under half-open interval [start, end).
     */
    public function testAdjacentNonOverlappingIntervalsAreAvailable(): void
    {
        // Existing appointment blocking [09:00:00, 10:00:00)
        $this->appointmentRepo->create([
            'patient_id' => 1,
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-09 09:00:00',
            'end_at' => '2026-11-09 10:00:00',
            'duration_snapshot' => 50,
            'price_snapshot' => 1200.00,
            'status' => 'CONFIRMED',
        ]);

        $res = $this->service->getAvailability(1, 1, '2026-11-09', '2026-11-09', $this->simulatedNow);
        $slots = $res['availability'][0]['slots'];

        $foundAdjacentSlot = false;
        foreach ($slots as $slot) {
            $start = new DateTimeImmutable($slot['start_at'], $this->tz)->format('H:i:s');
            if ($start === '10:00:00') {
                $foundAdjacentSlot = true;
                break;
            }
        }

        $this->assertTrue(
            $foundAdjacentSlot,
            'Slot at 10:00:00 must be available as it is adjacent to [09:00:00, 10:00:00).'
        );
    }
}
