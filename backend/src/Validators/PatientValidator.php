<?php

declare(strict_types=1);

namespace App\Validators;

use App\Core\HttpException;
use DateTimeImmutable;

/**
 * Patient Record Validator
 * Validates patient demographic fields, emergency contacts, medical alerts, and dates.
 */
class PatientValidator
{
    private const ALLOWED_GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed> Validated and sanitized fields
     * @throws HttpException
     */
    public static function validate(array $data, bool $isUpdate = false): array
    {
        $errors = [];
        $sanitized = [];

        // 1. First Name
        if (!$isUpdate || array_key_exists('first_name', $data)) {
            $firstName = isset($data['first_name']) ? trim((string) $data['first_name']) : '';
            if ($firstName === '') {
                $errors['first_name'] = 'First name is required.';
            } elseif (mb_strlen($firstName) < 2 || mb_strlen($firstName) > 100) {
                $errors['first_name'] = 'First name must be between 2 and 100 characters.';
            } else {
                $sanitized['first_name'] = $firstName;
            }
        }

        // 2. Last Name
        if (!$isUpdate || array_key_exists('last_name', $data)) {
            $lastName = isset($data['last_name']) ? trim((string) $data['last_name']) : '';
            if ($lastName === '') {
                $errors['last_name'] = 'Last name is required.';
            } elseif (mb_strlen($lastName) < 2 || mb_strlen($lastName) > 100) {
                $errors['last_name'] = 'Last name must be between 2 and 100 characters.';
            } else {
                $sanitized['last_name'] = $lastName;
            }
        }

        // 3. Date of Birth
        if (!$isUpdate || array_key_exists('date_of_birth', $data)) {
            $dob = isset($data['date_of_birth']) ? trim((string) $data['date_of_birth']) : '';
            if ($dob === '') {
                $errors['date_of_birth'] = 'Date of birth is required.';
            } else {
                $d = DateTimeImmutable::createFromFormat('Y-m-d', $dob);
                $now = new DateTimeImmutable('today');
                if (!$d || $d->format('Y-m-d') !== $dob) {
                    $errors['date_of_birth'] = 'Date of birth must be a valid date in YYYY-MM-DD format.';
                } elseif ($d > $now) {
                    $errors['date_of_birth'] = 'Date of birth cannot be in the future.';
                } else {
                    $sanitized['date_of_birth'] = $dob;
                }
            }
        }

        // 4. Phone
        if (!$isUpdate || array_key_exists('phone', $data)) {
            $phone = isset($data['phone']) ? trim((string) $data['phone']) : '';
            if ($phone === '') {
                $errors['phone'] = 'Phone number is required.';
            } elseif (mb_strlen($phone) < 7 || mb_strlen($phone) > 30) {
                $errors['phone'] = 'Phone number must be between 7 and 30 characters.';
            } else {
                $sanitized['phone'] = $phone;
            }
        }

        // 5. Gender
        if (!$isUpdate || array_key_exists('gender', $data)) {
            $gender = isset($data['gender']) ? strtoupper(trim((string) $data['gender'])) : 'PREFER_NOT_TO_SAY';
            if (!in_array($gender, self::ALLOWED_GENDERS, true)) {
                $errors['gender'] = 'Invalid gender. Allowed values: ' . implode(', ', self::ALLOWED_GENDERS);
            } else {
                $sanitized['gender'] = $gender;
            }
        }

        // 6. Address
        if (array_key_exists('address', $data)) {
            $address = $data['address'] !== null ? trim((string) $data['address']) : null;
            if ($address !== null && mb_strlen($address) > 255) {
                $errors['address'] = 'Address cannot exceed 255 characters.';
            } else {
                $sanitized['address'] = $address === '' ? null : $address;
            }
        }

        // 7. Emergency Contact Name
        if (array_key_exists('emergency_contact_name', $data)) {
            $ecName = $data['emergency_contact_name'] !== null ? trim((string) $data['emergency_contact_name']) : null;
            if ($ecName !== null && mb_strlen($ecName) > 150) {
                $errors['emergency_contact_name'] = 'Emergency contact name cannot exceed 150 characters.';
            } else {
                $sanitized['emergency_contact_name'] = $ecName === '' ? null : $ecName;
            }
        }

        // 8. Emergency Contact Phone
        if (array_key_exists('emergency_contact_phone', $data)) {
            $ecPhone = $data['emergency_contact_phone'] !== null ? trim((string) $data['emergency_contact_phone']) : null;
            if ($ecPhone !== null && mb_strlen($ecPhone) > 30) {
                $errors['emergency_contact_phone'] = 'Emergency contact phone cannot exceed 30 characters.';
            } else {
                $sanitized['emergency_contact_phone'] = $ecPhone === '' ? null : $ecPhone;
            }
        }

        // 9. Medical Alerts
        if (array_key_exists('medical_alerts', $data)) {
            $alerts = $data['medical_alerts'] !== null ? trim((string) $data['medical_alerts']) : null;
            $sanitized['medical_alerts'] = $alerts === '' ? null : $alerts;
        }

        if (!empty($errors)) {
            throw HttpException::unprocessable('Validation failed for patient data.', $errors);
        }

        return $sanitized;
    }

    /**
     * @param array<string, mixed> $data
     * @return int 0 or 1
     * @throws HttpException
     */
    public static function validateStatus(array $data): int
    {
        if (!array_key_exists('is_active', $data)) {
            throw HttpException::unprocessable('Validation failed.', ['is_active' => 'The is_active field is required.']);
        }

        $val = $data['is_active'];
        if (!in_array($val, [0, 1, '0', '1', true, false], true)) {
            throw HttpException::unprocessable('Validation failed.', ['is_active' => 'The is_active field must be 0 or 1.']);
        }

        return (int) (bool) $val;
    }
}
