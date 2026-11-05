<?php

declare(strict_types=1);

namespace App\Validators;

use App\Core\HttpException;
use DateTimeImmutable;
use DateTimeZone;

/**
 * Schedule & Availability Validator
 * Validates clinic operating hours, recurring weekly dentist shifts, time-off intervals, and closures.
 */
class ScheduleValidator
{
    private const ALLOWED_CLOSURE_TYPES = ['HOLIDAY', 'MAINTENANCE', 'EMERGENCY', 'SPECIAL_CLOSURE'];

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed> Validated and normalized schedule data
     * @throws HttpException
     */
    public static function validateWeeklySchedule(array $data): array
    {
        $errors = [];

        // 1. Day of Week
        if (!isset($data['day_of_week']) || !is_numeric($data['day_of_week'])) {
            $errors['day_of_week'] = 'Day of week is required (1=Monday to 7=Sunday).';
        } else {
            $day = (int) $data['day_of_week'];
            if ($day < 1 || $day > 7) {
                $errors['day_of_week'] = 'Day of week must be between 1 (Monday) and 7 (Sunday).';
            }
        }

        // 2. Start Time
        $startTime = isset($data['start_time']) ? trim((string) $data['start_time']) : '';
        if ($startTime === '') {
            $errors['start_time'] = 'Start time is required (HH:MM:SS or HH:MM).';
        } elseif (!self::isValidTime($startTime)) {
            $errors['start_time'] = 'Start time must be a valid time in HH:MM or HH:MM:SS format.';
        }

        // 3. End Time
        $endTime = isset($data['end_time']) ? trim((string) $data['end_time']) : '';
        if ($endTime === '') {
            $errors['end_time'] = 'End time is required (HH:MM:SS or HH:MM).';
        } elseif (!self::isValidTime($endTime)) {
            $errors['end_time'] = 'End time must be a valid time in HH:MM or HH:MM:SS format.';
        }

        // 4. Chronological Interval Check
        if (empty($errors['start_time']) && empty($errors['end_time'])) {
            $normStart = self::normalizeTime($startTime);
            $normEnd = self::normalizeTime($endTime);
            if ($normStart >= $normEnd) {
                $errors['end_time'] = 'End time must be strictly after start time.';
            }
        }

        // 5. Operatory Chair
        $chair = isset($data['operatory_chair']) ? trim((string) $data['operatory_chair']) : 'Chair 1';
        if ($chair === '') {
            $chair = 'Chair 1';
        }

        // 6. Active status
        $isActive = isset($data['is_active']) ? ((int) $data['is_active'] ? 1 : 0) : 1;

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Validation failed for dentist schedule shift.', $errors);
        }

        return [
            'day_of_week' => (int) $data['day_of_week'],
            'start_time' => self::normalizeTime($startTime),
            'end_time' => self::normalizeTime($endTime),
            'operatory_chair' => $chair,
            'is_active' => $isActive,
        ];
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     * @throws HttpException
     */
    public static function validateTimeOff(array $data): array
    {
        $errors = [];

        // 1. Start At
        $startAtStr = isset($data['start_at']) ? trim((string) $data['start_at']) : '';
        $startAt = self::parseDateTime($startAtStr);
        if ($startAt === null) {
            $errors['start_at'] = 'Valid start date-time is required (ISO 8601 or YYYY-MM-DD HH:MM:SS).';
        }

        // 2. End At
        $endAtStr = isset($data['end_at']) ? trim((string) $data['end_at']) : '';
        $endAt = self::parseDateTime($endAtStr);
        if ($endAt === null) {
            $errors['end_at'] = 'Valid end date-time is required (ISO 8601 or YYYY-MM-DD HH:MM:SS).';
        }

        // 3. Chronological Order
        if ($startAt !== null && $endAt !== null) {
            if ($startAt >= $endAt) {
                $errors['end_at'] = 'End date-time must be strictly after start date-time.';
            }
        }

        // 4. Reason
        $reason = isset($data['reason']) ? trim((string) $data['reason']) : '';
        if ($reason === '') {
            $errors['reason'] = 'A reason or description for time off is required.';
        } elseif (mb_strlen($reason) < 2 || mb_strlen($reason) > 255) {
            $errors['reason'] = 'Reason must be between 2 and 255 characters.';
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Validation failed for practitioner time off.', $errors);
        }

        return [
            'start_at' => $startAt->format('Y-m-d H:i:s'),
            'end_at' => $endAt->format('Y-m-d H:i:s'),
            'reason' => $reason,
        ];
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     * @throws HttpException
     */
    public static function validateClinicOperatingHours(array $data): array
    {
        $errors = [];

        if (!isset($data['day_of_week']) || !is_numeric($data['day_of_week'])) {
            $errors['day_of_week'] = 'Day of week is required (1=Monday to 7=Sunday).';
        } else {
            $day = (int) $data['day_of_week'];
            if ($day < 1 || $day > 7) {
                $errors['day_of_week'] = 'Day of week must be between 1 and 7.';
            }
        }

        $isClosed = isset($data['is_closed']) ? ((int) $data['is_closed'] ? 1 : 0) : 0;

        $openingTime = isset($data['opening_time']) ? trim((string) $data['opening_time']) : '08:00:00';
        $closingTime = isset($data['closing_time']) ? trim((string) $data['closing_time']) : '17:00:00';

        if (!$isClosed) {
            if (!self::isValidTime($openingTime)) {
                $errors['opening_time'] = 'Opening time must be a valid time format.';
            }
            if (!self::isValidTime($closingTime)) {
                $errors['closing_time'] = 'Closing time must be a valid time format.';
            }
            if (empty($errors['opening_time']) && empty($errors['closing_time'])) {
                $normOpen = self::normalizeTime($openingTime);
                $normClose = self::normalizeTime($closingTime);
                if ($normOpen >= $normClose) {
                    $errors['closing_time'] = 'Closing time must be after opening time.';
                }
            }
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Validation failed for clinic operating hours.', $errors);
        }

        return [
            'day_of_week' => (int) $data['day_of_week'],
            'opening_time' => self::normalizeTime($openingTime),
            'closing_time' => self::normalizeTime($closingTime),
            'is_closed' => $isClosed,
        ];
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     * @throws HttpException
     */
    public static function validateClinicClosure(array $data): array
    {
        $errors = [];

        // 1. Title
        $title = isset($data['title']) ? trim((string) $data['title']) : '';
        if ($title === '') {
            $errors['title'] = 'Closure title is required (e.g., Christmas Day, Facility Maintenance).';
        } elseif (mb_strlen($title) < 2 || mb_strlen($title) > 150) {
            $errors['title'] = 'Closure title must be between 2 and 150 characters.';
        }

        // 2. Start At
        $startAtStr = isset($data['start_at']) ? trim((string) $data['start_at']) : '';
        $startAt = self::parseDateTime($startAtStr);
        if ($startAt === null) {
            $errors['start_at'] = 'Valid start date-time is required.';
        }

        // 3. End At
        $endAtStr = isset($data['end_at']) ? trim((string) $data['end_at']) : '';
        $endAt = self::parseDateTime($endAtStr);
        if ($endAt === null) {
            $errors['end_at'] = 'Valid end date-time is required.';
        }

        // 4. Chronological
        if ($startAt !== null && $endAt !== null && $startAt >= $endAt) {
            $errors['end_at'] = 'End date-time must be strictly after start date-time.';
        }

        // 5. Type
        $type = isset($data['closure_type']) ? strtoupper(trim((string) $data['closure_type'])) : 'HOLIDAY';
        if (!in_array($type, self::ALLOWED_CLOSURE_TYPES, true)) {
            $errors['closure_type'] = 'Invalid closure type. Allowed: ' . implode(', ', self::ALLOWED_CLOSURE_TYPES);
        }

        $notes = isset($data['notes']) ? trim((string) $data['notes']) : null;

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Validation failed for clinic closure.', $errors);
        }

        return [
            'title' => $title,
            'start_at' => $startAt->format('Y-m-d H:i:s'),
            'end_at' => $endAt->format('Y-m-d H:i:s'),
            'closure_type' => $type,
            'notes' => $notes !== '' ? $notes : null,
        ];
    }

    /**
     * @param array<string, mixed> $params
     * @return array{dentist_id: int, service_id: int, start_date: string, end_date: string}
     * @throws HttpException
     */
    public static function validateAvailabilityQuery(array $params): array
    {
        $errors = [];

        // Dentist ID
        if (!isset($params['dentist_id']) || !is_numeric($params['dentist_id']) || (int) $params['dentist_id'] <= 0) {
            $errors['dentist_id'] = 'A valid positive integer dentist_id is required.';
        }

        // Service ID
        if (!isset($params['service_id']) || !is_numeric($params['service_id']) || (int) $params['service_id'] <= 0) {
            $errors['service_id'] = 'A valid positive integer service_id is required.';
        }

        // Date parameter (support either 'date' or 'start_date')
        $startDateStr = (string) ($params['date'] ?? $params['start_date'] ?? '');
        $startDate = self::parseDate($startDateStr);
        if ($startDate === null) {
            $errors['date'] = 'A valid date in YYYY-MM-DD format is required.';
        }

        // Optional end_date for range queries
        $endDateStr = (string) ($params['end_date'] ?? $startDateStr);
        $endDate = self::parseDate($endDateStr);
        if ($endDate === null && !empty($params['end_date'])) {
            $errors['end_date'] = 'end_date must be a valid date in YYYY-MM-DD format.';
        }

        if ($startDate !== null && $endDate !== null) {
            if ($startDate > $endDate) {
                $errors['end_date'] = 'end_date must be on or after start date.';
            } else {
                // Max range limit of 14 days per request to prevent resource exhaustion
                $diffDays = $startDate->diff($endDate)->days;
                if ($diffDays > 14) {
                    $errors['end_date'] = 'Date range query cannot exceed 14 days.';
                }
            }
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Validation failed for availability query.', $errors);
        }

        return [
            'dentist_id' => (int) $params['dentist_id'],
            'service_id' => (int) $params['service_id'],
            'start_date' => $startDate->format('Y-m-d'),
            'end_date' => $endDate ? $endDate->format('Y-m-d') : $startDate->format('Y-m-d'),
        ];
    }

    private static function isValidTime(string $time): bool
    {
        return (bool) preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/', $time);
    }

    private static function normalizeTime(string $time): string
    {
        if (preg_match('/^(\d{2}:\d{2})$/', $time)) {
            return $time . ':00';
        }
        return $time;
    }

    private static function parseDate(string $dateStr): ?DateTimeImmutable
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateStr)) {
            return null;
        }
        $d = DateTimeImmutable::createFromFormat('Y-m-d', $dateStr, new DateTimeZone('Asia/Manila'));
        return ($d && $d->format('Y-m-d') === $dateStr) ? $d : null;
    }

    private static function parseDateTime(string $dateTimeStr): ?DateTimeImmutable
    {
        if (empty($dateTimeStr)) {
            return null;
        }

        // Try ISO 8601 first
        $d = DateTimeImmutable::createFromFormat(DateTimeImmutable::ATOM, $dateTimeStr);
        if ($d !== false) {
            return $d->setTimezone(new DateTimeZone('Asia/Manila'));
        }

        // Try standard SQL format Y-m-d H:i:s
        $d = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $dateTimeStr, new DateTimeZone('Asia/Manila'));
        if ($d !== false) {
            return $d;
        }

        // Try Y-m-d H:i
        $d = DateTimeImmutable::createFromFormat('Y-m-d H:i', $dateTimeStr, new DateTimeZone('Asia/Manila'));
        if ($d !== false) {
            return $d;
        }

        // Try Y-m-d
        $d = DateTimeImmutable::createFromFormat('Y-m-d', $dateTimeStr, new DateTimeZone('Asia/Manila'));
        if ($d !== false) {
            return $d->setTime(0, 0, 0);
        }

        return null;
    }
}

