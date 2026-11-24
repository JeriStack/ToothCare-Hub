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
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use Throwable;

/**
 * Centralized Appointment Availability & Conflict Validation Engine
 *
 * Single authoritative source of truth used by both patient booking and
 * receptionist/admin appointment approval workflows.
 *
 * Evaluates:
 * - Dentist account & profile active status
 * - Dental service active status & duration
 * - Clinic operating hours & holiday/maintenance closures
 * - Dentist recurring working shifts (authoritative duty schedule) & split-shift breaks
 * - Date-specific dentist schedule exceptions (if configured)
 * - Dentist approved leaves / time-off
 * - Existing blocking appointments (PENDING & CONFIRMED) with half-open overlap + turnaround buffer
 * - Operatory chair/room conflicts across distinct practitioners
 */
class AvailabilityService
{
    public const REASON_AVAILABLE = 'AVAILABLE';
    public const REASON_DENTIST_INACTIVE = 'DENTIST_INACTIVE';
    public const REASON_SERVICE_INACTIVE = 'SERVICE_INACTIVE';
    public const REASON_CLINIC_CLOSED = 'CLINIC_CLOSED';
    public const REASON_NOT_WORKING_DAY = 'NOT_WORKING_DAY';
    public const REASON_OUTSIDE_WORKING_HOURS = 'OUTSIDE_WORKING_HOURS';
    public const REASON_NOT_ON_DUTY = 'NOT_ON_DUTY';
    public const REASON_APPROVED_LEAVE = 'APPROVED_LEAVE';
    public const REASON_UNAVAILABLE_PERIOD = 'UNAVAILABLE_PERIOD';
    public const REASON_APPOINTMENT_CONFLICT = 'APPOINTMENT_CONFLICT';
    public const REASON_ROOM_CONFLICT = 'ROOM_CONFLICT';
    public const REASON_SERVICE_DURATION_CONFLICT = 'SERVICE_DURATION_CONFLICT';
    public const REASON_ADVANCE_NOTICE_REQUIRED = 'ADVANCE_NOTICE_REQUIRED';
    public const REASON_BOOKING_HORIZON_EXCEEDED = 'BOOKING_HORIZON_EXCEEDED';
    public const REASON_PAST_DATE = 'PAST_DATE';
    public const REASON_ALL_SLOTS_BOOKED = 'ALL_SLOTS_BOOKED';
    public const REASON_APPOINTMENT_NO_LONGER_ELIGIBLE = 'APPOINTMENT_NO_LONGER_ELIGIBLE';

    public const STATUS_AVAILABLE = 'AVAILABLE';
    public const STATUS_SCHEDULING_CONFLICT = 'SCHEDULING_CONFLICT';
    public const STATUS_DENTIST_NOT_ON_DUTY = 'DENTIST_NOT_ON_DUTY';
    public const STATUS_DENTIST_UNAVAILABLE = 'DENTIST_UNAVAILABLE';
    public const STATUS_REQUIRES_REVIEW = 'REQUIRES_REVIEW';

    private const DAY_NAMES = [
        1 => 'Mondays',
        2 => 'Tuesdays',
        3 => 'Wednesdays',
        4 => 'Thursdays',
        5 => 'Fridays',
        6 => 'Saturdays',
        7 => 'Sundays',
    ];

    private Database $database;
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
        $this->database = $database ?? Database::getInstance();
        $this->dentistRepo = $dentistRepo ?? new DentistRepository($this->database);
        $this->serviceRepo = $serviceRepo ?? new ServiceRepository($this->database);
        $this->scheduleRepo = $scheduleRepo ?? new DentistScheduleRepository($this->database);
        $this->timeOffRepo = $timeOffRepo ?? new DentistTimeOffRepository($this->database);
        $this->clinicRepo = $clinicRepo ?? new ClinicScheduleRepository($this->database);
        $this->appointmentRepo = $appointmentRepo ?? new AppointmentRepository($this->database);

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

    public function getDefaultBufferMinutes(): int
    {
        return $this->defaultBufferMinutes;
    }

    /**
     * Map a structured conflict reason code to a safe, patient-facing rejection reason template.
     */
    public static function getSuggestedRejectionReason(string $reasonCode): string
    {
        return match ($reasonCode) {
            self::REASON_NOT_WORKING_DAY => 'The selected dentist is not scheduled to work on your requested appointment date. Please select another date.',
            self::REASON_NOT_ON_DUTY => 'The selected dentist is not on duty during your requested appointment time. Please choose another available time.',
            self::REASON_OUTSIDE_WORKING_HOURS => "The requested appointment time is outside the dentist's working schedule. Please select an available time.",
            self::REASON_SERVICE_DURATION_CONFLICT => "The requested appointment duration extends beyond the dentist's available working hours. Please select an earlier or alternative time.",
            self::REASON_APPROVED_LEAVE => 'The selected dentist is unavailable on your requested date. Please choose another date or dentist.',
            self::REASON_CLINIC_CLOSED, self::REASON_UNAVAILABLE_PERIOD => 'The clinic or dentist is unavailable on your requested date and time. Please select another available date.',
            self::REASON_APPOINTMENT_CONFLICT => 'The selected dentist has another appointment during your requested time. Please select another available time.',
            self::REASON_ROOM_CONFLICT => 'The requested appointment slot is unavailable because the required clinic room is occupied. Please select another time.',
            self::REASON_DENTIST_INACTIVE => 'The selected dentist is currently unavailable for new appointments. Please choose another available dentist.',
            self::REASON_SERVICE_INACTIVE => 'The requested dental service is currently unavailable for booking. Please choose another service or contact the clinic.',
            self::REASON_PAST_DATE, self::REASON_ADVANCE_NOTICE_REQUIRED, self::REASON_BOOKING_HORIZON_EXCEEDED => 'The requested appointment time is no longer eligible for confirmation. Please choose an upcoming available time slot.',
            default => 'Your appointment request could not be approved due to a clinic scheduling conflict. Please select another available appointment slot.',
        };
    }

    /**
     * Map a structured conflict reason code to a concise UI availability status badge.
     */
    public static function getAvailabilityStatusForReason(string $reasonCode): string
    {
        return match ($reasonCode) {
            self::REASON_AVAILABLE => self::STATUS_AVAILABLE,
            self::REASON_APPOINTMENT_CONFLICT,
            self::REASON_ROOM_CONFLICT,
            self::REASON_SERVICE_DURATION_CONFLICT => self::STATUS_SCHEDULING_CONFLICT,
            self::REASON_NOT_WORKING_DAY,
            self::REASON_OUTSIDE_WORKING_HOURS,
            self::REASON_NOT_ON_DUTY => self::STATUS_DENTIST_NOT_ON_DUTY,
            self::REASON_DENTIST_INACTIVE,
            self::REASON_SERVICE_INACTIVE,
            self::REASON_APPROVED_LEAVE,
            self::REASON_CLINIC_CLOSED,
            self::REASON_UNAVAILABLE_PERIOD => self::STATUS_DENTIST_UNAVAILABLE,
            default => self::STATUS_REQUIRES_REVIEW,
        };
    }

    /**
     * Compute available appointment slots for a dentist and service across a date range.
     *
     * @param int $dentistId
     * @param int $serviceId
     * @param string $startDate 'YYYY-MM-DD'
     * @param string $endDate 'YYYY-MM-DD'
     * @param DateTimeImmutable|null $currentTime For testing or time simulation
     * @param bool $includeAlternatives When true and querying a single day with 0 slots, compute validated alternatives
     * @return array<string, mixed>
     * @throws HttpException
     */
    public function getAvailability(
        int $dentistId,
        int $serviceId,
        string $startDate,
        string $endDate,
        ?DateTimeImmutable $currentTime = null,
        bool $includeAlternatives = true
    ): array {
        $now = ($currentTime ?? new DateTimeImmutable('now', $this->timezone))
            ->setTimezone($this->timezone);

        // 1. Verify Dentist Existence & Active Status
        $dentist = $this->dentistRepo->findById($dentistId);
        if (!$dentist) {
            throw HttpException::notFound('Dentist profile not found.');
        }
        if ((int) $dentist['is_active'] !== 1 || (isset($dentist['user_active']) && (int) $dentist['user_active'] !== 1)) {
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
        $dentistLabel = 'Dr. ' . trim(($dentist['first_name'] ?? '') . ' ' . ($dentist['last_name'] ?? ''));

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
        $exceptionsByDate = $this->getScheduleExceptionsByRange(
            $dentistId,
            $startDt->format('Y-m-d'),
            $endDt->format('Y-m-d')
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
            $dayReasonCode = null;
            $dayReasonMessage = null;
            $dentistOnDuty = false;

            $dayExceptions = $exceptionsByDate[$dateStr] ?? [];
            $effectiveShifts = $this->resolveEffectiveShiftsForDay(
                $shiftsByDay[$dayOfWeek] ?? [],
                $dayExceptions,
                $dentist['default_operatory_chair'] ?? 'Chair 1'
            );

            $skippedByClosure = 0;
            $skippedByLeave = 0;
            $skippedByBooking = 0;
            $skippedByRoom = 0;
            $skippedByAdvanceNotice = 0;
            $candidateCount = 0;

            if (!$isClinicOpen) {
                $dayReasonCode = self::REASON_CLINIC_CLOSED;
                $dayName = self::DAY_NAMES[$dayOfWeek] ?? 'this day';
                $dayReasonMessage = "The clinic is closed on {$dayName}. Please select another operating day.";
            } elseif ($effectiveShifts['marked_unavailable']) {
                $dayReasonCode = self::REASON_UNAVAILABLE_PERIOD;
                $dayReasonMessage = "{$dentistLabel} is marked unavailable on this date. Please select another date or dentist.";
            } elseif (empty($effectiveShifts['shifts'])) {
                $dayReasonCode = self::REASON_NOT_WORKING_DAY;
                $dayName = self::DAY_NAMES[$dayOfWeek] ?? 'this day';
                $dayReasonMessage = "{$dentistLabel} is not scheduled to work on {$dayName}. Please select another date.";
            } else {
                $dentistOnDuty = true;
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

                // Check full-day closure / full-day leave upfront for clean messaging
                $dayStartDt = $currentDay->setTime(0, 0, 0);
                $dayEndDt = $currentDay->setTime(23, 59, 59);

                // Pre-fetch room conflicts for chairs used in shifts on this date
                $chairsUsed = [];
                foreach ($effectiveShifts['shifts'] as $sh) {
                    $c = trim((string) ($sh['operatory_chair'] ?? ($dentist['default_operatory_chair'] ?? 'Chair 1')));
                    if ($c !== '') {
                        $chairsUsed[$c] = true;
                    }
                }
                $roomConflictsByChair = [];
                foreach (array_keys($chairsUsed) as $chairName) {
                    $roomConflictsByChair[$chairName] = $this->appointmentRepo->findRoomConflicts(
                        $chairName,
                        $dayStartDt->format('Y-m-d H:i:s'),
                        $dayEndDt->format('Y-m-d H:i:s'),
                        $dentistId
                    );
                }

                foreach ($effectiveShifts['shifts'] as $shift) {
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
                    if (!$shiftStartDt || !$shiftEndDt || !$clinicOpenDt || !$clinicCloseDt) {
                        continue;
                    }

                    // Clamp shift to clinic operating hours
                    $effectiveStart = $shiftStartDt > $clinicOpenDt ? $shiftStartDt : $clinicOpenDt;
                    $effectiveEnd = $shiftEndDt < $clinicCloseDt ? $shiftEndDt : $clinicCloseDt;

                    if ($effectiveStart >= $effectiveEnd) {
                        continue;
                    }

                    $chairName = trim((string) ($shift['operatory_chair'] ?? ($dentist['default_operatory_chair'] ?? 'Chair 1')));
                    $chairBookings = $roomConflictsByChair[$chairName] ?? [];

                    $stepMinutes = max($this->slotIntervalMinutes, $durationMinutes);
                    $cursor = $effectiveStart;
                    while (true) {
                        $slotEnd = $cursor->modify("+{$durationMinutes} minutes");
                        $blockingEnd = $slotEnd->modify("+{$bufferMinutes} minutes");

                        if ($blockingEnd > $effectiveEnd) {
                            break;
                        }

                        $candidateCount++;

                        $minNoticeLimit = $now->modify("+{$this->minAdvanceNoticeMinutes} minutes");
                        if ($cursor < $minNoticeLimit) {
                            $skippedByAdvanceNotice++;
                            $cursor = $cursor->modify("+{$this->slotIntervalMinutes} minutes");
                            continue;
                        }

                        if ($this->hasIntervalOverlap($cursor, $blockingEnd, $closures)) {
                            $skippedByClosure++;
                            $cursor = $cursor->modify("+{$this->slotIntervalMinutes} minutes");
                            continue;
                        }

                        if ($this->hasIntervalOverlap($cursor, $blockingEnd, $timeOffList)) {
                            $skippedByLeave++;
                            $cursor = $cursor->modify("+{$this->slotIntervalMinutes} minutes");
                            continue;
                        }

                        if ($this->hasIntervalOverlap($cursor, $blockingEnd, $blockingAppointments)) {
                            $skippedByBooking++;
                            $cursor = $cursor->modify("+{$this->slotIntervalMinutes} minutes");
                            continue;
                        }

                        if (!empty($chairBookings) && $this->hasIntervalOverlap($cursor, $blockingEnd, $chairBookings)) {
                            $skippedByRoom++;
                            $cursor = $cursor->modify("+{$this->slotIntervalMinutes} minutes");
                            continue;
                        }

                        $daySlots[] = [
                            'start_at' => $cursor->format(DateTimeImmutable::ATOM),
                            'end_at' => $slotEnd->format(DateTimeImmutable::ATOM),
                            'blocking_end_at' => $blockingEnd->format(DateTimeImmutable::ATOM),
                            'duration_minutes' => $durationMinutes,
                            'buffer_minutes' => $bufferMinutes,
                            'dentist_id' => $dentistId,
                            'operatory_chair' => $chairName !== '' ? $chairName : 'Chair 1',
                            'available' => true,
                        ];

                        $cursor = $cursor->modify("+{$stepMinutes} minutes");
                    }
                }

                // Derive clear, specific explanation when zero slots are available
                if (empty($daySlots)) {
                    if ($candidateCount === 0) {
                        $dayReasonCode = self::REASON_SERVICE_DURATION_CONFLICT;
                        $dayReasonMessage = "The selected {$durationMinutes}-minute procedure does not fit within {$dentistLabel}'s scheduled hours on this date.";
                    } elseif ($skippedByClosure > 0 && $skippedByClosure >= ($candidateCount - $skippedByAdvanceNotice)) {
                        $dayReasonCode = self::REASON_CLINIC_CLOSED;
                        $dayReasonMessage = 'The clinic is closed on this date due to a scheduled holiday or facility closure.';
                    } elseif ($skippedByLeave > 0 && $skippedByLeave >= ($candidateCount - $skippedByAdvanceNotice)) {
                        $dayReasonCode = self::REASON_APPROVED_LEAVE;
                        $dayReasonMessage = "{$dentistLabel} is unavailable (approved leave/time off) on this date. Please choose another date or dentist.";
                    } elseif ($skippedByBooking > 0) {
                        $dayReasonCode = self::REASON_ALL_SLOTS_BOOKED;
                        $dayReasonMessage = "All appointment slots for {$dentistLabel} on this date are already booked. Please choose another date or dentist.";
                    } elseif ($skippedByRoom > 0) {
                        $dayReasonCode = self::REASON_ROOM_CONFLICT;
                        $dayReasonMessage = 'All operatory room slots for this date are currently occupied. Please select another date or dentist.';
                    } elseif ($skippedByAdvanceNotice > 0) {
                        $dayReasonCode = self::REASON_ADVANCE_NOTICE_REQUIRED;
                        $hours = round($this->minAdvanceNoticeMinutes / 60, 1);
                        $dayReasonMessage = "No remaining slots meet the clinic's {$hours}-hour minimum advance booking notice for today. Please choose an upcoming date.";
                    } else {
                        $dayReasonCode = self::REASON_UNAVAILABLE_PERIOD;
                        $dayReasonMessage = "No appointment slots are available for {$dentistLabel} on this date.";
                    }
                }
            }

            usort($daySlots, fn($a, $b) => strcmp($a['start_at'], $b['start_at']));

            $availabilityDays[] = [
                'date' => $dateStr,
                'day_of_week' => $dayOfWeek,
                'is_clinic_open' => (bool) $isClinicOpen,
                'dentist_on_duty' => $dentistOnDuty,
                'reason_code' => $dayReasonCode,
                'reason_message' => $dayReasonMessage,
                'slots' => $daySlots,
            ];

            $currentDay = $currentDay->modify('+1 day');
        }

        $response = [
            'dentist' => [
                'id' => (int) $dentist['id'],
                'name' => $dentistLabel,
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

        // Provide validated alternatives when a single-day lookup has zero available slots
        if (
            $includeAlternatives
            && $startDate === $endDate
            && isset($availabilityDays[0])
            && empty($availabilityDays[0]['slots'])
        ) {
            $response['alternatives'] = $this->findAlternatives($dentistId, $serviceId, $startDate, $now);
        }

        return $response;
    }

    /**
     * Authoritative slot & appointment availability validator.
     * Used by patient booking, live validation API, triage queue status, and receptionist approval.
     *
     * @return array{
     *   available: bool,
     *   availability_status: string,
     *   reason_code: string,
     *   message: string,
     *   suggested_rejection_reason: ?string,
     *   operatory_chair: ?string,
     *   conflict_context: ?array<string, mixed>
     * }
     */
    public function validateSlot(
        int $dentistId,
        int $serviceId,
        DateTimeImmutable $startAt,
        ?DateTimeImmutable $currentTime = null,
        ?int $excludeAppointmentId = null,
        bool $enforceAdvanceNotice = true,
        bool $enforceIntervalAlignment = true,
        ?int $overrideDurationMinutes = null,
        ?string $overrideOperatoryChair = null,
        ?PDO $pdo = null,
        bool $enforceDateHorizon = true
    ): array {
        $now = ($currentTime ?? new DateTimeImmutable('now', $this->timezone))
            ->setTimezone($this->timezone);
        $startAtManila = $startAt->setTimezone($this->timezone);
        $dateStr = $startAtManila->format('Y-m-d');

        // 1. Verify active dentist (profile + user account)
        $dentist = $this->dentistRepo->findById($dentistId);
        if (
            !$dentist
            || (int) $dentist['is_active'] !== 1
            || (isset($dentist['user_active']) && (int) $dentist['user_active'] !== 1)
        ) {
            return $this->buildValidationResult(
                false,
                self::REASON_DENTIST_INACTIVE,
                'The assigned dentist is currently inactive and cannot accept appointments.'
            );
        }

        $dentistLabel = 'Dr. ' . trim(($dentist['first_name'] ?? '') . ' ' . ($dentist['last_name'] ?? ''));

        // 2. Verify active service
        $service = $this->serviceRepo->findById($serviceId);
        if (!$service || (int) $service['is_active'] !== 1) {
            return $this->buildValidationResult(
                false,
                self::REASON_SERVICE_INACTIVE,
                'The requested dental service is currently inactive and cannot be scheduled.'
            );
        }

        // 3. Verify date range, past date, horizon, and minimum advance notice
        $slotDateDt = DateTimeImmutable::createFromFormat('!Y-m-d', $dateStr, $this->timezone);
        $todayDt = DateTimeImmutable::createFromFormat('!Y-m-d', $now->format('Y-m-d'), $this->timezone);
        if (!$slotDateDt || !$todayDt) {
            return $this->buildValidationResult(
                false,
                self::REASON_UNAVAILABLE_PERIOD,
                'Unable to evaluate the requested appointment date.'
            );
        }

        if ($enforceDateHorizon) {
            if ($slotDateDt < $todayDt) {
                return $this->buildValidationResult(
                    false,
                    self::REASON_PAST_DATE,
                    'Appointments cannot be scheduled in the past.'
                );
            }
            if ($slotDateDt > $todayDt->modify("+{$this->maxBookingHorizonDays} days")) {
                return $this->buildValidationResult(
                    false,
                    self::REASON_BOOKING_HORIZON_EXCEEDED,
                    "Requested appointment exceeds the maximum booking horizon of {$this->maxBookingHorizonDays} days."
                );
            }
        }

        if ($enforceAdvanceNotice) {
            $minNoticeLimit = $now->modify("+{$this->minAdvanceNoticeMinutes} minutes");
            if ($startAtManila < $minNoticeLimit) {
                $hours = round($this->minAdvanceNoticeMinutes / 60, 1);
                return $this->buildValidationResult(
                    false,
                    self::REASON_ADVANCE_NOTICE_REQUIRED,
                    "Appointments must be booked at least {$hours} hours in advance."
                );
            }
        }

        // 4. Verify clinic operating hours on that weekday
        $dayOfWeek = (int) $startAtManila->format('N');
        $clinicHours = null;
        foreach ($this->clinicRepo->getOperatingHours() as $oh) {
            if ((int) $oh['day_of_week'] === $dayOfWeek) {
                $clinicHours = $oh;
                break;
            }
        }
        if (!$clinicHours || (bool) $clinicHours['is_closed']) {
            $dayName = self::DAY_NAMES[$dayOfWeek] ?? 'this day';
            return $this->buildValidationResult(
                false,
                self::REASON_CLINIC_CLOSED,
                "The clinic is closed on {$dayName}."
            );
        }

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
        if (!$clinicOpenDt || !$clinicCloseDt) {
            return $this->buildValidationResult(
                false,
                self::REASON_CLINIC_CLOSED,
                'Clinic operating hours are not configured for this day.'
            );
        }

        $durationMinutes = $overrideDurationMinutes !== null && $overrideDurationMinutes > 0
            ? $overrideDurationMinutes
            : (int) $service['duration_minutes'];
        $bufferMinutes = $this->defaultBufferMinutes;
        $serviceEndDt = $startAtManila->modify("+{$durationMinutes} minutes");
        $blockingEnd = $serviceEndDt->modify("+{$bufferMinutes} minutes");

        // 5. Check clinic-wide holiday / maintenance closures first
        $closures = $this->clinicRepo->getClosures($dateStr, $dateStr);
        $overlappingClosure = $this->findFirstOverlap($startAtManila, $blockingEnd, $closures);
        if ($overlappingClosure !== null) {
            $closureTitle = trim((string) ($overlappingClosure['title'] ?? 'Scheduled Closure'));
            return $this->buildValidationResult(
                false,
                self::REASON_UNAVAILABLE_PERIOD,
                "The clinic is closed during the requested time ({$closureTitle}).",
                null,
                [
                    'type' => 'clinic_closure',
                    'window' => $this->formatIntervalWindow($overlappingClosure['start_at'] ?? null, $overlappingClosure['end_at'] ?? null),
                ]
            );
        }

        // 6. Check dentist approved leave / time-off
        $rangeStartStr = $slotDateDt->format('Y-m-d 00:00:00');
        $rangeEndStr = $slotDateDt->format('Y-m-d 23:59:59');
        $timeOffList = $this->timeOffRepo->findByDentistId($dentistId, $rangeStartStr, $rangeEndStr);
        $overlappingLeave = $this->findFirstOverlap($startAtManila, $blockingEnd, $timeOffList);
        if ($overlappingLeave !== null) {
            return $this->buildValidationResult(
                false,
                self::REASON_APPROVED_LEAVE,
                "{$dentistLabel} is on approved leave/time off during the requested appointment window.",
                null,
                [
                    'type' => 'approved_leave',
                    'window' => $this->formatIntervalWindow($overlappingLeave['start_at'] ?? null, $overlappingLeave['end_at'] ?? null),
                ]
            );
        }

        // 7. Check dentist recurring working shifts & date-specific schedule exceptions
        $exceptionsByDate = $this->getScheduleExceptionsByRange($dentistId, $dateStr, $dateStr);
        $dayShifts = [];
        foreach ($this->scheduleRepo->findByDentistId($dentistId, true) as $sh) {
            if ((int) $sh['day_of_week'] === $dayOfWeek) {
                $dayShifts[] = $sh;
            }
        }
        $effectiveShifts = $this->resolveEffectiveShiftsForDay(
            $dayShifts,
            $exceptionsByDate[$dateStr] ?? [],
            $dentist['default_operatory_chair'] ?? 'Chair 1'
        );

        if ($effectiveShifts['marked_unavailable']) {
            return $this->buildValidationResult(
                false,
                self::REASON_UNAVAILABLE_PERIOD,
                "{$dentistLabel} has a date-specific unavailability override on {$dateStr}."
            );
        }

        if (empty($effectiveShifts['shifts'])) {
            $dayName = self::DAY_NAMES[$dayOfWeek] ?? 'this day';
            return $this->buildValidationResult(
                false,
                self::REASON_NOT_WORKING_DAY,
                "{$dentistLabel} is not scheduled to work on {$dayName}."
            );
        }

        $matchedShift = null;
        $intervalSeconds = max(1, $this->slotIntervalMinutes) * 60;
        $startedInsideAShift = false;
        $earliestShiftStart = null;
        $latestShiftEnd = null;
        $alignmentFailed = false;

        foreach ($effectiveShifts['shifts'] as $shift) {
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
            if (!$shiftStartDt || !$shiftEndDt) {
                continue;
            }

            $effectiveStart = $shiftStartDt > $clinicOpenDt ? $shiftStartDt : $clinicOpenDt;
            $effectiveEnd = $shiftEndDt < $clinicCloseDt ? $shiftEndDt : $clinicCloseDt;

            if ($effectiveStart >= $effectiveEnd) {
                continue;
            }

            if ($earliestShiftStart === null || $effectiveStart < $earliestShiftStart) {
                $earliestShiftStart = $effectiveStart;
            }
            if ($latestShiftEnd === null || $effectiveEnd > $latestShiftEnd) {
                $latestShiftEnd = $effectiveEnd;
            }

            if ($startAtManila >= $effectiveStart && $startAtManila < $effectiveEnd) {
                $startedInsideAShift = true;
                if ($blockingEnd <= $effectiveEnd) {
                    if ($enforceIntervalAlignment) {
                        $offsetSeconds = $startAtManila->getTimestamp() - $effectiveStart->getTimestamp();
                        if ($offsetSeconds % $intervalSeconds === 0) {
                            $matchedShift = $shift;
                            break;
                        }
                        $alignmentFailed = true;
                    } else {
                        $matchedShift = $shift;
                        break;
                    }
                }
            }
        }

        if ($matchedShift === null) {
            if ($alignmentFailed) {
                return $this->buildValidationResult(
                    false,
                    self::REASON_OUTSIDE_WORKING_HOURS,
                    "Requested time must align to {$this->slotIntervalMinutes}-minute scheduling intervals."
                );
            }
            if ($startedInsideAShift) {
                return $this->buildValidationResult(
                    false,
                    self::REASON_SERVICE_DURATION_CONFLICT,
                    "The {$durationMinutes}-minute procedure (including {$bufferMinutes}m sterilization buffer) extends past {$dentistLabel}'s scheduled shift."
                );
            }
            if ($earliestShiftStart !== null && $latestShiftEnd !== null && $startAtManila >= $earliestShiftStart && $startAtManila < $latestShiftEnd) {
                return $this->buildValidationResult(
                    false,
                    self::REASON_NOT_ON_DUTY,
                    "{$dentistLabel} is not on duty (scheduled break period) during the requested time."
                );
            }
            return $this->buildValidationResult(
                false,
                self::REASON_OUTSIDE_WORKING_HOURS,
                "The requested time falls outside {$dentistLabel}'s working hours on this date."
            );
        }

        $resolvedChair = trim((string) (
            $overrideOperatoryChair
            ?: ($matchedShift['operatory_chair'] ?? ($dentist['default_operatory_chair'] ?? 'Chair 1'))
        ));
        if ($resolvedChair === '') {
            $resolvedChair = 'Chair 1';
        }

        // 8. Check overlapping blocking appointments for this dentist.
        // For new bookings ($enforceAdvanceNotice === true), check [start, end + buffer) against stored [start, end)
        // so forward buffer collisions are caught while allowing Rule 8 adjacent back-to-back bookings.
        // For approval revalidation of existing bookings ($enforceAdvanceNotice === false), check true service overlap
        // [start, end) against stored [start, end) so valid back-to-back bookings can both be approved.
        $overlapEndDt = $enforceAdvanceNotice ? $blockingEnd : $serviceEndDt;
        $blockingAppointments = $this->appointmentRepo->findBlockingByDentistAndRange(
            $dentistId,
            $rangeStartStr,
            $rangeEndStr,
            $excludeAppointmentId,
            $pdo
        );
        $overlappingAppt = $this->findFirstOverlap($startAtManila, $overlapEndDt, $blockingAppointments);
        if ($overlappingAppt !== null) {
            return $this->buildValidationResult(
                false,
                self::REASON_APPOINTMENT_CONFLICT,
                "{$dentistLabel} already has another scheduled appointment overlapping this time slot.",
                $resolvedChair,
                [
                    'type' => 'existing_appointment',
                    'status' => $overlappingAppt['status'] ?? 'CONFIRMED',
                    'window' => $this->formatIntervalWindow($overlappingAppt['start_at'] ?? null, $overlappingAppt['end_at'] ?? null),
                ]
            );
        }

        // 9. Check operatory chair / room conflicts across other practitioners
        $roomConflicts = $this->appointmentRepo->findRoomConflicts(
            $resolvedChair,
            $startAtManila->format('Y-m-d H:i:s'),
            $overlapEndDt->format('Y-m-d H:i:s'),
            $dentistId,
            $excludeAppointmentId,
            $pdo
        );
        $overlappingRoom = $this->findFirstOverlap($startAtManila, $overlapEndDt, $roomConflicts);
        if ($overlappingRoom !== null) {
            return $this->buildValidationResult(
                false,
                self::REASON_ROOM_CONFLICT,
                "Assigned room ({$resolvedChair}) is already occupied by another appointment during this time.",
                $resolvedChair,
                [
                    'type' => 'room_conflict',
                    'operatory_chair' => $resolvedChair,
                    'window' => $this->formatIntervalWindow($overlappingRoom['start_at'] ?? null, $overlappingRoom['end_at'] ?? null),
                ]
            );
        }

        return $this->buildValidationResult(
            true,
            self::REASON_AVAILABLE,
            'Dentist and clinic schedule are available for this appointment.',
            $resolvedChair
        );
    }

    /**
     * Boolean convenience wrapper around validateSlot() — preserves exact backward compatibility.
     */
    public function isSlotAvailable(
        int $dentistId,
        int $serviceId,
        DateTimeImmutable $startAt,
        ?DateTimeImmutable $currentTime = null
    ): bool {
        $result = $this->validateSlot($dentistId, $serviceId, $startAt, $currentTime);
        return $result['available'];
    }

    /**
     * Find validated alternative dates (same dentist) and alternative active dentists (same date)
     * using the exact same availability engine.
     *
     * @return array{
     *   next_available_dates: list<array{date: string, slot_count: int, first_slot_start_at: string}>,
     *   alternative_dentists: list<array{dentist_id: int, name: string, specialization: string, slot_count: int, first_slot_start_at: string}>
     * }
     */
    public function findAlternatives(
        int $dentistId,
        int $serviceId,
        string $requestedDate,
        ?DateTimeImmutable $currentTime = null,
        int $maxDates = 3,
        int $maxDentists = 3
    ): array {
        $now = ($currentTime ?? new DateTimeImmutable('now', $this->timezone))
            ->setTimezone($this->timezone);
        $reqDt = DateTimeImmutable::createFromFormat('!Y-m-d', $requestedDate, $this->timezone);
        $todayDt = DateTimeImmutable::createFromFormat('!Y-m-d', $now->format('Y-m-d'), $this->timezone);

        $nextDates = [];
        $altDentists = [];

        if (!$reqDt || !$todayDt) {
            return [
                'next_available_dates' => [],
                'alternative_dentists' => [],
            ];
        }

        $maxHorizonDt = $todayDt->modify("+{$this->maxBookingHorizonDays} days");

        // 1. Next available dates for the same dentist (scan next 14 days in a single call)
        $scanStart = $reqDt->modify('+1 day');
        if ($scanStart <= $maxHorizonDt) {
            $scanEnd = $scanStart->modify('+13 days');
            if ($scanEnd > $maxHorizonDt) {
                $scanEnd = $maxHorizonDt;
            }
            try {
                $rangeAvail = $this->getAvailability(
                    $dentistId,
                    $serviceId,
                    $scanStart->format('Y-m-d'),
                    $scanEnd->format('Y-m-d'),
                    $now,
                    false
                );
                foreach ($rangeAvail['availability'] ?? [] as $day) {
                    if (!empty($day['slots'])) {
                        $nextDates[] = [
                            'date' => $day['date'],
                            'slot_count' => count($day['slots']),
                            'first_slot_start_at' => $day['slots'][0]['start_at'],
                        ];
                        if (count($nextDates) >= $maxDates) {
                            break;
                        }
                    }
                }
            } catch (Throwable) {
                // Skip if dentist is inactive
            }
        }

        // 2. Alternative active dentists with available slots on the requested date
        if ($reqDt >= $todayDt && $reqDt <= $maxHorizonDt) {
            try {
                $activeDentists = $this->dentistRepo->listActive();
                foreach ($activeDentists as $other) {
                    $otherId = (int) ($other['id'] ?? 0);
                    if ($otherId <= 0 || $otherId === $dentistId) {
                        continue;
                    }
                    try {
                        $otherAvail = $this->getAvailability(
                            $otherId,
                            $serviceId,
                            $requestedDate,
                            $requestedDate,
                            $now,
                            false
                        );
                        $otherSlots = $otherAvail['availability'][0]['slots'] ?? [];
                        if (!empty($otherSlots)) {
                            $altDentists[] = [
                                'dentist_id' => $otherId,
                                'name' => 'Dr. ' . trim(($other['first_name'] ?? '') . ' ' . ($other['last_name'] ?? '')),
                                'specialization' => (string) ($other['specialization'] ?? ''),
                                'slot_count' => count($otherSlots),
                                'first_slot_start_at' => $otherSlots[0]['start_at'],
                            ];
                            if (count($altDentists) >= $maxDentists) {
                                break;
                            }
                        }
                    } catch (Throwable) {
                        continue;
                    }
                }
            } catch (Throwable) {
                // Non-fatal
            }
        }

        return [
            'next_available_dates' => $nextDates,
            'alternative_dentists' => $altDentists,
        ];
    }

    /**
     * @param array<string, mixed>|null $conflictContext
     * @return array{
     *   available: bool,
     *   availability_status: string,
     *   reason_code: string,
     *   message: string,
     *   suggested_rejection_reason: ?string,
     *   operatory_chair: ?string,
     *   conflict_context: ?array<string, mixed>
     * }
     */
    private function buildValidationResult(
        bool $available,
        string $reasonCode,
        string $message,
        ?string $operatoryChair = null,
        ?array $conflictContext = null
    ): array {
        return [
            'available' => $available,
            'availability_status' => self::getAvailabilityStatusForReason($reasonCode),
            'reason_code' => $reasonCode,
            'message' => $message,
            'suggested_rejection_reason' => $available ? null : self::getSuggestedRejectionReason($reasonCode),
            'operatory_chair' => $operatoryChair,
            'conflict_context' => $conflictContext,
        ];
    }

    /**
     * Load date-specific schedule exceptions if the optional table exists.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    private function getScheduleExceptionsByRange(int $dentistId, string $startDate, string $endDate): array
    {
        try {
            $pdo = $this->database->getConnection();
            $stmt = $pdo->prepare('
                SELECT id, dentist_id, exception_date, start_time, end_time, is_unavailable, reason
                FROM dentist_schedule_exceptions
                WHERE dentist_id = ?
                  AND exception_date >= ?
                  AND exception_date <= ?
                ORDER BY exception_date ASC, start_time ASC
            ');
            $stmt->execute([$dentistId, $startDate, $endDate]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $grouped = [];
            foreach ($rows as $row) {
                $d = (string) ($row['exception_date'] ?? '');
                if ($d !== '') {
                    $grouped[$d][] = $row;
                }
            }
            return $grouped;
        } catch (Throwable) {
            // Table may not exist in isolated SQLite unit test schemas
            return [];
        }
    }

    /**
     * Combine recurring shifts with any date-specific schedule exceptions.
     *
     * @param list<array<string, mixed>> $recurringShifts
     * @param list<array<string, mixed>> $exceptions
     * @return array{marked_unavailable: bool, shifts: list<array<string, mixed>>}
     */
    private function resolveEffectiveShiftsForDay(array $recurringShifts, array $exceptions, string $defaultChair): array
    {
        if (empty($exceptions)) {
            return ['marked_unavailable' => false, 'shifts' => $recurringShifts];
        }

        $overrideShifts = [];
        foreach ($exceptions as $ex) {
            if ((int) ($ex['is_unavailable'] ?? 0) === 1) {
                return ['marked_unavailable' => true, 'shifts' => []];
            }
            if (!empty($ex['start_time']) && !empty($ex['end_time'])) {
                $overrideShifts[] = [
                    'start_time' => $ex['start_time'],
                    'end_time' => $ex['end_time'],
                    'operatory_chair' => $defaultChair,
                ];
            }
        }

        if (!empty($overrideShifts)) {
            return ['marked_unavailable' => false, 'shifts' => $overrideShifts];
        }

        return ['marked_unavailable' => false, 'shifts' => $recurringShifts];
    }

    /**
     * Check if a candidate half-open interval [candidateStart, candidateEnd)
     * overlaps with any existing record intervals in $records.
     * Overlap condition: candidateStart < recordEnd AND candidateEnd > recordStart.
     *
     * @param list<array<string, mixed>> $records
     */
    private function hasIntervalOverlap(
        DateTimeImmutable $candidateStart,
        DateTimeImmutable $candidateEnd,
        array $records
    ): bool {
        return $this->findFirstOverlap($candidateStart, $candidateEnd, $records) !== null;
    }

    /**
     * @param list<array<string, mixed>> $records
     * @return array<string, mixed>|null
     */
    private function findFirstOverlap(
        DateTimeImmutable $candidateStart,
        DateTimeImmutable $candidateEnd,
        array $records
    ): ?array {
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

            if ($candidateStart < $recEnd && $candidateEnd > $recStart) {
                return $record;
            }
        }

        return null;
    }

    private function formatIntervalWindow(?string $startStr, ?string $endStr): ?string
    {
        if (!$startStr || !$endStr) {
            return null;
        }
        $s = $this->parseRecordDateTime($startStr);
        $e = $this->parseRecordDateTime($endStr);
        if (!$s || !$e) {
            return null;
        }
        if ($s->format('Y-m-d') === $e->format('Y-m-d')) {
            return $s->format('M j, Y g:i A') . ' – ' . $e->format('g:i A');
        }
        return $s->format('M j, Y g:i A') . ' – ' . $e->format('M j, Y g:i A');
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
