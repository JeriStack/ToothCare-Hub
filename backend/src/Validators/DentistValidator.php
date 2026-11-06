<?php

declare(strict_types=1);

namespace App\Validators;

use App\Core\Config;
use App\Core\HttpException;

/**
 * Dentist Profile and Account Validator
 */
class DentistValidator
{
    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed> Validated data
     * @throws HttpException
     */
    public static function validateCreate(array $data): array
    {
        $errors = [];
        $config = Config::getInstance();
        $minPasswordLength = $config->getInt('auth_password_min_length', 8);

        // 1. Email
        $rawEmail = isset($data['email']) ? trim((string) $data['email']) : '';
        if ($rawEmail === '') {
            $errors['email'] = 'Dentist email address is required.';
        } elseif (!filter_var($rawEmail, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'A valid email address is required.';
        }

        // 2. Password (optional for invitation, or validated if specified)
        $password = isset($data['password']) ? (string) $data['password'] : '';
        if ($password !== '') {
            if (strlen($password) < $minPasswordLength) {
                $errors['password'] = "Password must be at least {$minPasswordLength} characters long.";
            } elseif (
                !preg_match('/[A-Z]/', $password) ||
                !preg_match('/[a-z]/', $password) ||
                !preg_match('/[0-9]/', $password) ||
                !preg_match('/[^A-Za-z0-9]/', $password)
            ) {
                $errors['password'] = 'Password must include uppercase, lowercase, digit, and special characters.';
            }
        }

        // 3. Names
        $firstName = isset($data['first_name']) ? trim((string) $data['first_name']) : '';
        if ($firstName === '' || mb_strlen($firstName) > 100) {
            $errors['first_name'] = 'First name is required and cannot exceed 100 characters.';
        }

        $lastName = isset($data['last_name']) ? trim((string) $data['last_name']) : '';
        if ($lastName === '' || mb_strlen($lastName) > 100) {
            $errors['last_name'] = 'Last name is required and cannot exceed 100 characters.';
        }

        // 4. License Number
        $license = isset($data['license_number']) ? trim((string) $data['license_number']) : '';
        if ($license === '' || mb_strlen($license) > 50) {
            $errors['license_number'] = 'Professional license number is required and cannot exceed 50 characters.';
        }

        // 5. Specialization
        $specialization = isset($data['specialization']) ? trim((string) $data['specialization']) : '';
        if ($specialization === '' || mb_strlen($specialization) > 150) {
            $errors['specialization'] = 'Dental specialization is required and cannot exceed 150 characters.';
        }

        // 6. Phone
        $phone = isset($data['phone']) ? trim((string) $data['phone']) : '';
        if ($phone === '' || !preg_match('/^[0-9+\s\-()]{7,30}$/', $phone)) {
            $errors['phone'] = 'A valid contact phone number is required.';
        }

        $chair = isset($data['default_operatory_chair']) ? trim((string) $data['default_operatory_chair']) : 'Chair 1';
        $bio = isset($data['bio']) ? trim((string) $data['bio']) : null;
        $isActive = isset($data['is_active']) ? ((int) $data['is_active'] ? 1 : 0) : 1;

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Validation failed for dentist account.', $errors);
        }

        return [
            'email' => strtolower($rawEmail),
            'password' => $password !== '' ? $password : bin2hex(random_bytes(8)) . 'A1!',
            'first_name' => $firstName,
            'last_name' => $lastName,
            'license_number' => $license,
            'specialization' => $specialization,
            'phone' => $phone,
            'default_operatory_chair' => $chair !== '' ? $chair : 'Chair 1',
            'bio' => $bio,
            'is_active' => $isActive,
        ];
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public static function validateUpdate(array $data): array
    {
        $errors = [];
        $result = [];

        if (array_key_exists('first_name', $data)) {
            $fn = trim((string) $data['first_name']);
            if ($fn === '' || mb_strlen($fn) > 100) {
                $errors['first_name'] = 'First name cannot be empty and cannot exceed 100 characters.';
            } else {
                $result['first_name'] = $fn;
            }
        }

        if (array_key_exists('last_name', $data)) {
            $ln = trim((string) $data['last_name']);
            if ($ln === '' || mb_strlen($ln) > 100) {
                $errors['last_name'] = 'Last name cannot be empty and cannot exceed 100 characters.';
            } else {
                $result['last_name'] = $ln;
            }
        }

        if (array_key_exists('specialization', $data)) {
            $spec = trim((string) $data['specialization']);
            if ($spec === '' || mb_strlen($spec) > 150) {
                $errors['specialization'] = 'Specialization cannot be empty and cannot exceed 150 characters.';
            } else {
                $result['specialization'] = $spec;
            }
        }

        if (array_key_exists('license_number', $data)) {
            $lic = trim((string) $data['license_number']);
            if ($lic === '' || mb_strlen($lic) > 50) {
                $errors['license_number'] = 'License number cannot be empty and cannot exceed 50 characters.';
            } else {
                $result['license_number'] = $lic;
            }
        }

        if (array_key_exists('phone', $data)) {
            $phone = trim((string) $data['phone']);
            if ($phone === '' || !preg_match('/^[0-9+\s\-()]{7,30}$/', $phone)) {
                $errors['phone'] = 'A valid contact phone number is required.';
            } else {
                $result['phone'] = $phone;
            }
        }

        if (array_key_exists('default_operatory_chair', $data)) {
            $chair = trim((string) $data['default_operatory_chair']);
            $result['default_operatory_chair'] = $chair !== '' ? $chair : 'Chair 1';
        }

        if (array_key_exists('bio', $data)) {
            $result['bio'] = trim((string) $data['bio']) ?: null;
        }

        if (array_key_exists('is_active', $data)) {
            $result['is_active'] = (int) $data['is_active'] ? 1 : 0;
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Validation failed for dentist update.', $errors);
        }

        return $result;
    }

    /**
     * @param array<string, mixed> $data
     * @return int 0 or 1
     */
    public static function validateStatus(array $data): int
    {
        if (!isset($data['is_active'])) {
            throw HttpException::unprocessableEntity('Validation failed.', [
                'is_active' => 'Active status boolean or integer (0 or 1) is required.',
            ]);
        }

        $val = $data['is_active'];
        if ($val === true || $val === 1 || $val === '1' || $val === 'true') {
            return 1;
        }
        if ($val === false || $val === 0 || $val === '0' || $val === 'false') {
            return 0;
        }

        throw HttpException::unprocessableEntity('Validation failed.', [
            'is_active' => 'Invalid active status. Must be 0 or 1.',
        ]);
    }
}
