<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\HttpException;
use App\Repositories\AppointmentRepository;
use App\Repositories\ClinicScheduleRepository;
use App\Repositories\DentistRepository;
use App\Repositories\DentistScheduleRepository;
use App\Repositories\DentistTimeOffRepository;
use App\Repositories\ServiceRepository;
use DateInterval;
use DateTimeImmutable;
use DateTimeZone;

/**
 * Centralized Appointment Availability Engine
 * Calculates bookable appointment time slots based on practitioner shifts,
 * clinic facility hours, procedure duration, recovery/turnaround buffer,
 * practitioner leaves, facility closures, and confirmed/pending bookings.
 */
class AvailabilityService
{
    private DentistRepository $dentistRepo;
    private ServiceRepository $serviceRepo;
    private DentistScheduleRepository $scheduleRepo;
    private DentistTimeOffRepository $timeOffRepo;
    private ClinicScheduleRepository $clinicRepo;
    private AppointmentRepository $appointmentRepo;

    private DateTimeZone $timezone;
    private int $minAdvanceNoticeMinutes;
    private int $maxBookingHorizonDays;
    private int $defaultBufferMinutes;
    private int $slotIntervalMinutes;

    public function __construct(
        ?DentistRepository $dentistRepo = null,
        ?ServiceRepository $serviceRepo = null,
        ?DentistScheduleRepository $scheduleRepo = null,
        ?DentistTimeOffRepository $timeOffRepo = null,
        ?ClinicScheduleRepository $clinicRepo = null,
        ?AppointmentRepository $appointmentRepo = null,
        ?Database $database = null
    ) {
        $db = $database ?? Database::getInstance();
        $this->dentistRepo = $dentistRepo ?? new DentistRepository($db);
        $this->serviceRepo = $serviceRepo ?? new ServiceRepository($db);
        $this->scheduleRepo = $scheduleRepo ?? new DentistScheduleRepository($db);
        $this->timeOffRepo = $timeOffRepo ?? new DentistTimeOffRepository($db);
        $this->clinicRepo = $clinicRepo ?? new ClinicScheduleRepository($db);
        $this->appointmentRepo = $appointmentRepo ?? new AppointmentRepository($db);

        $appConfig = require __DIR__ . '/../../config/app.php';
        $schedConfig = $appConfig['scheduling'] ?? [];

        $tzName = $schedConfig['timezone'] ?? 'Asia/Manila';
        $this->timezone = new DateTimeZone($tzName);
        $this->minAdvanceNoticeMinutes = (int) ($schedConfig['min_advance_notice_minutes'] ?? 120);
        $this->maxBookingHorizonDays = (int) ($schedConfig['max_booking_horizon_days'] ?? 90);
        $this->defaultBufferMinutes = (int) ($schedConfig['default_buffer_minutes'] ?? 10);
        $this->slotIntervalMinutes = (int) ($schedConfig['slot_interval_minutes'] ?? 15);
    }

    public function getTimezone(): DateTimeZone
    {
        return $this->timezone;
    }

    /**
     * Compute available appointment slots for a dentist and service across a date range.
     *
     * @param int $dentistId
     * @param int $serviceId
     * @param string $startDate 'YYYY-MM-DD'
     * @param string $endDate 'YYYY-MM-DD'
     * @param DateTimeImmutable|null $currentTime For testing or time simulation
     * @return array<string, mixed>
     * @throws HttpException
     */
    public function getAvailability(
        int $dentistId,
        int $serviceId,
        string $startDate,
        string $endDate,
        ?DateTimeImmutable $currentTime = null
    ): array {
        $now = $currentTime ?? new DateTimeImmutable('now', $this->timezone);
        $now = $now->setTimezone($this->timezone);

        // 1. Verify Dentist Existence & Active Status
        $dentist = $this->dentistRepo->findById($dentistId);
        if (!$dentist) {
            throw HttpException::notFound('Dentist profile not found.');
        }
        if ((int) $dentist['is_active'] !== 1) {
            throw HttpException::unprocessableEntity('Dentist is currently inactive and cannot accept bookings.');
        }

        // 2. Verify Service Existence & Active Status
        $service = $this->serviceRepo->findById($serviceId);
        if (!$service) {
            throw HttpException::notFound('Dental service not found.');
        }
        if ((int) $service['is_active'] !== 1) {
            throw HttpException::unprocessableEntity('Service is currently inactive and cannot be booked.');
        }

        // 3. Validate Date Range Rules
        $startDt = DateTimeImmutable::createFromFormat('!Y-m-d', $startDate, $this->timezone);
        $endDt = DateTimeImmutable::createFromFormat('!Y-m-d', $endDate, $this->timezone);

        if (!$startDt || !$endDt) {
            throw HttpException::unprocessableEntity('Invalid date format. Expected YYYY-MM-DD.');
        }

        $todayDt = DateTimeImmutable::createFromFormat('!Y-m-d', $now->format('Y-m-d'), $this->timezone);
        if ($startDt < $todayDt) {
            throw HttpException::unprocessableEntity('Availability cannot be queried for past dates.');
        }

        $maxHorizonDt = $todayDt->modify("+{$this->maxBookingHorizonDays} days");
        if ($endDt > $maxHorizonDt) {
            throw HttpException::unprocessableEntity(
                "Requested date range exceeds the maximum booking horizon of {$this->maxBookingHorizonDays} days."
            );
        }

        if ($startDt > $endDt) {
            throw HttpException::unprocessableEntity('End date must be on or after start date.');
        }

        $durationMinutes = (int) $service['duration_minutes'];
        $bufferMinutes = $this->defaultBufferMinutes;

        // 4. Pre-fetch Data for Range to Minimize Database Queries
        $rangeStartStr = $startDt->format('Y-m-d 00:00:00');
        $rangeEndStr = $endDt->format('Y-m-d 23:59:59');

        $operatingHoursList = $this->clinicRepo->getOperatingHours();
        $operatingHoursByDay = [];
        foreach ($operatingHoursList as $oh) {
            $operatingHoursByDay[(int) $oh['day_of_week']] = $oh;
        }

        $closures = $this->clinicRepo->getClosures($startDt->format('Y-m-d'), $endDt->format('Y-m-d'));
        $dentistShifts = $this->scheduleRepo->findByDentistId($dentistId, true);
        $timeOffList = $this->timeOffRepo->findByDentistId($dentistId, $rangeStartStr, $rangeEndStr);
        $blockingAppointments = $this->appointmentRepo->findBlockingByDentistAndRange(
            $dentistId,
            $rangeStartStr,
            $rangeEndStr
        );

        // Group shifts by day of week
        $shiftsByDay = [];
        foreach ($dentistShifts as $shift) {
            $shiftsByDay[(int) $shift['day_of_week']][] = $shift;
        }

        // 5. Build Daily Slots
        $availabilityDays = [];
        $currentDay = $startDt;

        while ($currentDay <= $endDt) {
            $dateStr = $currentDay->format('Y-m-d');
            $dayOfWeek = (int) $currentDay->format('N'); // 1 (Mon) to 7 (Sun)

            $clinicHours = $operatingHoursByDay[$dayOfWeek] ?? null;
            $isClinicOpen = $clinicHours && !(bool) $clinicHours['is_closed'];

            $daySlots = [];

            if ($isClinicOpen && isset($shiftsByDay[$dayOfWeek])) {
                $clinicOpenDt = DateTimeImmutable::createFromFormat(
                    'Y-m-d H:i:s',
                    "{$dateStr} {$clinicHours['opening_time']}",
                    $this->timezone
                );
                $clinicCloseDt = DateTimeImmutable::createFromFormat(
                    'Y-m-d H:i:s',
                    "{$dateStr} {$clinicHours['closing_time']}",
                    $this->timezone
                );

                foreach ($shiftsByDay[$dayOfWeek] as $shift) {
                    $shiftStartDt = DateTimeImmutable::createFromFormat(
                        'Y-m-d H:i:s',
                        "{$dateStr} {$shift['start_time']}",
                        $this->timezone
                    );
                    $shiftEndDt = DateTimeImmutable::createFromFormat(
                        'Y-m-d H:i:s',
                        "{$dateStr} {$shift['end_time']}",
                        $this->timezone
                    );

                    // Clamp shift to clinic operating hours
                    $effectiveStart = $shiftStartDt > $clinicOpenDt ? $shiftStartDt : $clinicOpenDt;
                    $effectiveEnd = $shiftEndDt < $clinicCloseDt ? $shiftEndDt : $clinicCloseDt;

                    if ($effectiveStart >= $effectiveEnd) {
                        continue;
                    }

                    // Generate candidate slots every slotIntervalMinutes
                    $cursor = $effectiveStart;
                    while (true) {
                        $slotEnd = $cursor->modify("+{$durationMinutes} minutes");
                        $blockingEnd = $slotEnd->modify("+{$bufferMinutes} minutes");

                        // Boundary Check 1: Full blocking interval [cursor, cursor + duration + buffer)
                        // must fit strictly within effective schedule window (dentist shift and clinic closing)
                        if ($blockingEnd > $effectiveEnd) {
                            break;
                        }

                        // Boundary Check 2: Minimum advance notice (e.g. 120 minutes from now)
                        $minNoticeLimit = $now->modify("+{$this->minAdvanceNoticeMinutes} minutes");
                        if ($cursor < $minNoticeLimit) {
                            $cursor = $cursor->modify("+{$this->slotIntervalMinutes} minutes");
                            continue;
                        }

                        // Precedence Check 1: Overlap with clinic closures [start, end)
                        if ($this->hasIntervalOverlap($cursor, $blockingEnd, $closures)) {
                            $cursor = $cursor->modify("+{$this->slotIntervalMinutes} minutes");
                            continue;
                        }

                        // Precedence Check 2: Overlap with dentist time-off [start, end)
                        if ($this->hasIntervalOverlap($cursor, $blockingEnd, $timeOffList)) {
                            $cursor = $cursor->modify("+{$this->slotIntervalMinutes} minutes");
                            continue;
                        }

                        // Precedence Check 3: Overlap with existing blocking appointments [start, end)
                        if ($this->hasIntervalOverlap($cursor, $blockingEnd, $blockingAppointments)) {
                            $cursor = $cursor->modify("+{$this->slotIntervalMinutes} minutes");
                            continue;
                        }

                        // All checks passed: valid available slot!
                        $daySlots[] = [
                            'start_at' => $cursor->format(DateTimeImmutable::ATOM),
                            'end_at' => $slotEnd->format(DateTimeImmutable::ATOM),
                            'blocking_end_at' => $blockingEnd->format(DateTimeImmutable::ATOM),
                            'duration_minutes' => $durationMinutes,
                            'buffer_minutes' => $bufferMinutes,
                            'dentist_id' => $dentistId,
                            'operatory_chair' => $shift['operatory_chair'] ?? 'Chair 1',
                            'available' => true,
                        ];

                        $cursor = $cursor->modify("+{$this->slotIntervalMinutes} minutes");
                    }
                }
            }

            // Deduplicate and sort slots for the day by start_at
            usort($daySlots, fn($a, $b) => strcmp($a['start_at'], $b['start_at']));

            $availabilityDays[] = [
                'date' => $dateStr,
                'day_of_week' => $dayOfWeek,
                'is_clinic_open' => (bool) $isClinicOpen,
                'slots' => $daySlots,
            ];

            $currentDay = $currentDay->modify('+1 day');
        }

        return [
            'dentist' => [
                'id' => (int) $dentist['id'],
                'name' => 'Dr. ' . $dentist['first_name'] . ' ' . $dentist['last_name'],
                'specialization' => $dentist['specialization'],
            ],
            'service' => [
                'id' => (int) $service['id'],
                'name' => $service['name'],
                'duration_minutes' => $durationMinutes,
                'price' => (float) $service['price'],
                'buffer_minutes' => $bufferMinutes,
            ],
            'timezone' => $this->timezone->getName(),
            'availability' => $availabilityDays,
        ];
    }

    /**
     * Validate whether a specific requested start date-time slot is strictly available for booking.
     *
     * @param int $dentistId
     * @param int $serviceId
     * @param DateTimeImmutable $startAt
     * @param DateTimeImmutable|null $currentTime
     * @return bool
     */
    public function isSlotAvailable(
        int $dentistId,
        int $serviceId,
        DateTimeImmutable $startAt,
        ?DateTimeImmutable $currentTime = null
    ): bool {
        $startAtManila = $startAt->setTimezone($this->timezone);
        $dateStr = $startAtManila->format('Y-m-d');

        try {
            $result = $this->getAvailability($dentistId, $serviceId, $dateStr, $dateStr, $currentTime);
        } catch (HttpException $e) {
            return false;
        }

        $requestedIso = $startAtManila->format(DateTimeImmutable::ATOM);
        foreach ($result['availability'][0]['slots'] ?? [] as $slot) {
            if ($slot['start_at'] === $requestedIso && !empty($slot['available'])) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a candidate half-open interval [candidateStart, candidateBlockingEnd)
     * overlaps with any existing record intervals in $records.
     * Overlap condition: candidateStart < recordEnd AND candidateBlockingEnd > recordStart.
     *
     * @param DateTimeImmutable $candidateStart
     * @param DateTimeImmutable $candidateBlockingEnd
     * @param list<array<string, mixed>> $records
     * @return bool True if overlap occurs (conflict), false otherwise
     */
    private function hasIntervalOverlap(
        DateTimeImmutable $candidateStart,
        DateTimeImmutable $candidateBlockingEnd,
        array $records
    ): bool {
        foreach ($records as $record) {
            $recStartStr = $record['start_at'] ?? null;
            $recEndStr = $record['end_at'] ?? null;

            if (!$recStartStr || !$recEndStr) {
                continue;
            }

            $recStart = $this->parseRecordDateTime($recStartStr);
            $recEnd = $this->parseRecordDateTime($recEndStr);

            if (!$recStart || !$recEnd) {
                continue;
            }

            // Half-open interval overlap check
            if ($candidateStart < $recEnd && $candidateBlockingEnd > $recStart) {
                return true;
            }
        }

        return false;
    }

    private function parseRecordDateTime(string $dateTimeStr): ?DateTimeImmutable
    {
        $d = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $dateTimeStr, $this->timezone);
        if ($d !== false) {
            return $d;
        }

        $d = DateTimeImmutable::createFromFormat(DateTimeImmutable::ATOM, $dateTimeStr);
        if ($d !== false) {
            return $d->setTimezone($this->timezone);
        }

        return null;
    }
}

