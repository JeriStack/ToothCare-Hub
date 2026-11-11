<?php

declare(strict_types=1);

namespace App\Validators;

use App\Core\HttpException;
use DateTimeImmutable;
use DateTimeZone;

/**
 * Appointment Validator
 * Validates booking payloads, lifecycle status transitions, cancellation, and rejection reasons.
 */
class AppointmentValidator
{
    public const STATUS_PENDING = 'PENDING';
    public const STATUS_CONFIRMED = 'CONFIRMED';
    public const STATUS_REJECTED = 'REJECTED';
    public const STATUS_CANCELLED = 'CANCELLED';
    public const STATUS_COMPLETED = 'COMPLETED';

    public const VALID_STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_CONFIRMED,
        self::STATUS_REJECTED,
        self::STATUS_CANCELLED,
        self::STATUS_COMPLETED,
    ];

    /**
     * Allowed state transitions map
     * [ CurrentStatus => [ AllowedNextStatus, ... ] ]
     */
    public const ALLOWED_TRANSITIONS = [
        self::STATUS_PENDING => [
            self::STATUS_CONFIRMED,
            self::STATUS_REJECTED,
            self::STATUS_CANCELLED,
        ],
        self::STATUS_CONFIRMED => [
            self::STATUS_COMPLETED,
            self::STATUS_CANCELLED,
        ],
        self::STATUS_REJECTED => [],
        self::STATUS_CANCELLED => [],
        self::STATUS_COMPLETED => [],
    ];

    /**
     * Validate an appointment booking request payload.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed> Sanitized, normalized booking data
     * @throws HttpException
     */
    public static function validateBooking(array $data): array
    {
        $errors = [];

        // 1. Dentist ID
        if (!isset($data['dentist_id']) || !is_numeric($data['dentist_id']) || (int) $data['dentist_id'] <= 0) {
            $errors['dentist_id'] = 'A valid dentist ID is required.';
        }

        // 2. Service ID
        if (!isset($data['service_id']) || !is_numeric($data['service_id']) || (int) $data['service_id'] <= 0) {
            $errors['service_id'] = 'A valid dental service ID is required.';
        }

        // 3. Start At (timestamp or ISO string)
        $startAtStr = isset($data['start_at']) ? trim((string) $data['start_at']) : '';
        if ($startAtStr === '') {
            $errors['start_at'] = 'Appointment start date and time is required.';
        } else {
            $parsedDate = self::parseDateTime($startAtStr);
            if ($parsedDate === null) {
                $errors['start_at'] = 'Appointment start must be a valid ISO 8601 or YYYY-MM-DD HH:MM:SS string.';
            }
        }

        // 4. Chief Complaint / Reason (Optional)
        $chiefComplaint = null;
        if (isset($data['chief_complaint']) && trim((string) $data['chief_complaint']) !== '') {
            $raw = trim((string) $data['chief_complaint']);
            if (mb_strlen($raw) > 1000) {
                $errors['chief_complaint'] = 'Reason / chief complaint must not exceed 1000 characters.';
            } else {
                // Strip tags to prevent stored HTML or script execution
                $chiefComplaint = htmlspecialchars(strip_tags($raw), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            }
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity(
                'Appointment booking validation failed.',
                $errors
            );
        }

        return [
            'dentist_id' => (int) $data['dentist_id'],
            'service_id' => (int) $data['service_id'],
            'start_at' => $startAtStr,
            'chief_complaint' => $chiefComplaint,
        ];
    }

    /**
     * Validate an appointment reschedule request payload.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     * @throws HttpException
     */
    public static function validateReschedule(array $data): array
    {
        $errors = [];

        // 1. Start At
        $startAtStr = isset($data['start_at']) ? trim((string) $data['start_at']) : '';
        if ($startAtStr === '') {
            $errors['start_at'] = 'New appointment start date and time is required.';
        } else {
            $parsedDate = self::parseDateTime($startAtStr);
            if ($parsedDate === null) {
                $errors['start_at'] = 'Appointment start must be a valid ISO 8601 or YYYY-MM-DD HH:MM:SS string.';
            }
        }

        // 2. Dentist ID (Optional override)
        $dentistId = null;
        if (isset($data['dentist_id']) && $data['dentist_id'] !== '') {
            if (!is_numeric($data['dentist_id']) || (int) $data['dentist_id'] <= 0) {
                $errors['dentist_id'] = 'Dentist ID must be a positive integer.';
            } else {
                $dentistId = (int) $data['dentist_id'];
            }
        }

        // 3. Service ID (Optional override)
        $serviceId = null;
        if (isset($data['service_id']) && $data['service_id'] !== '') {
            if (!is_numeric($data['service_id']) || (int) $data['service_id'] <= 0) {
                $errors['service_id'] = 'Service ID must be a positive integer.';
            } else {
                $serviceId = (int) $data['service_id'];
            }
        }

        // 4. Reschedule Reason
        $reason = 'Patient requested reschedule';
        if (isset($data['reason']) && trim((string) $data['reason']) !== '') {
            $rawReason = trim((string) $data['reason']);
            if (mb_strlen($rawReason) > 255) {
                $errors['reason'] = 'Reschedule reason must not exceed 255 characters.';
            } else {
                $reason = htmlspecialchars(strip_tags($rawReason), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            }
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity(
                'Appointment reschedule validation failed.',
                $errors
            );
        }

        return [
            'start_at' => $startAtStr,
            'dentist_id' => $dentistId,
            'service_id' => $serviceId,
            'reason' => $reason,
        ];
    }

    /**
     * Validate an appointment cancellation payload.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     * @throws HttpException
     */
    public static function validateCancellation(array $data): array
    {
        $errors = [];
        $reason = 'Patient requested cancellation';

        if (isset($data['reason']) && trim((string) $data['reason']) !== '') {
            $raw = trim((string) $data['reason']);
            if (mb_strlen($raw) > 255) {
                $errors['reason'] = 'Cancellation reason must not exceed 255 characters.';
            } else {
                $reason = htmlspecialchars(strip_tags($raw), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            }
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity(
                'Cancellation validation failed.',
                $errors
            );
        }

        return ['reason' => $reason];
    }

    /**
     * Validate an administrative rejection payload.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     * @throws HttpException
     */
    public static function validateRejection(array $data): array
    {
        $errors = [];
        $reason = 'Appointment request declined by clinic administration';

        if (isset($data['reason']) && trim((string) $data['reason']) !== '') {
            $raw = trim((string) $data['reason']);
            if (mb_strlen($raw) > 255) {
                $errors['reason'] = 'Rejection reason must not exceed 255 characters.';
            } else {
                $reason = htmlspecialchars(strip_tags($raw), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            }
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity(
                'Rejection validation failed.',
                $errors
            );
        }

        return ['reason' => $reason];
    }

    /**
     * Enforce strict status lifecycle transition rules.
     *
     * @param string $currentStatus
     * @param string $newStatus
     * @throws HttpException
     */
    public static function validateStatusTransition(string $currentStatus, string $newStatus): void
    {
        $current = strtoupper(trim($currentStatus));
        $target = strtoupper(trim($newStatus));

        if (!in_array($current, self::VALID_STATUSES, true)) {
            throw HttpException::unprocessableEntity(
                "Current appointment status '{$current}' is invalid.",
                ['current_status' => $current]
            );
        }

        if (!in_array($target, self::VALID_STATUSES, true)) {
            throw HttpException::unprocessableEntity(
                "Target appointment status '{$target}' is invalid.",
                ['target_status' => $target]
            );
        }

        if ($current === $target) {
            throw HttpException::conflict(
                "Appointment is already in '{$target}' status.",
                'STATUS_UNCHANGED'
            );
        }

        $allowedNext = self::ALLOWED_TRANSITIONS[$current] ?? [];

        if (!in_array($target, $allowedNext, true)) {
            throw HttpException::conflict(
                "Cannot transition appointment status from '{$current}' to '{$target}'.",
                'ILLEGAL_STATUS_TRANSITION',
                [
                    'current_status' => $current,
                    'attempted_status' => $target,
                    'allowed_transitions' => $allowedNext,
                ]
            );
        }
    }

    /**
     * Parse date string safely into DateTimeImmutable.
     */
    public static function parseDateTime(string $dateTimeStr, ?DateTimeZone $tz = null): ?DateTimeImmutable
    {
        $timezone = $tz ?? new DateTimeZone('Asia/Manila');

        // Check format: Y-m-d H:i:s
        $dt = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $dateTimeStr, $timezone);
        if ($dt !== false) {
            return $dt;
        }

        // Check format: Y-m-d H:i
        $dt = DateTimeImmutable::createFromFormat('Y-m-d H:i', $dateTimeStr, $timezone);
        if ($dt !== false) {
            return $dt;
        }

        // Check format: ATOM / ISO 8601
        $dt = DateTimeImmutable::createFromFormat(DateTimeImmutable::ATOM, $dateTimeStr);
        if ($dt !== false) {
            return $dt->setTimezone($timezone);
        }

        // General fallback with try/catch
        try {
            return new DateTimeImmutable($dateTimeStr, $timezone);
        } catch (\Throwable $e) {
            return null;
        }
    }
}
