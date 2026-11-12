<?php

declare(strict_types=1);

namespace App\Validators;

use App\Core\HttpException;

/**
 * User and Staff Account Validator
 */
class UserValidator
{
    public const ALLOWED_ROLES = ['ADMIN', 'DENTIST', 'RECEPTIONIST', 'PATIENT'];
    public const STAFF_ROLES = ['ADMIN', 'DENTIST', 'RECEPTIONIST'];

    /**
     * Validate staff account creation payload
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     * @throws HttpException
     */
    public static function validateCreateStaff(array $data): array
    {
        $errors = [];
        $sanitized = [];

        // 1. Email
        $email = isset($data['email']) ? trim((string) $data['email']) : '';
        if ($email === '') {
            $errors['email'] = 'Email address is required.';
        } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Invalid email address format.';
        } elseif (strlen($email) > 255) {
            $errors['email'] = 'Email address cannot exceed 255 characters.';
        } else {
            $sanitized['email'] = strtolower($email);
        }

        // 2. Password
        $password = isset($data['password']) ? (string) $data['password'] : '';
        if ($password === '') {
            $errors['password'] = 'Password is required.';
        } elseif (strlen($password) < 8) {
            $errors['password'] = 'Password must be at least 8 characters.';
        } elseif (!preg_match('/[A-Z]/', $password)) {
            $errors['password'] = 'Password must contain at least one uppercase letter.';
        } elseif (!preg_match('/[a-z]/', $password)) {
            $errors['password'] = 'Password must contain at least one lowercase letter.';
        } elseif (!preg_match('/[0-9]/', $password)) {
            $errors['password'] = 'Password must contain at least one digit.';
        } elseif (!preg_match('/[^A-Za-z0-9]/', $password)) {
            $errors['password'] = 'Password must contain at least one special character.';
        } else {
            $sanitized['password'] = $password;
        }

        // 3. Role
        $role = isset($data['role']) ? strtoupper(trim((string) $data['role'])) : '';
        if ($role === '') {
            $errors['role'] = 'Staff role is required.';
        } elseif (!in_array($role, self::STAFF_ROLES, true)) {
            $errors['role'] = 'Staff role must be ADMIN, DENTIST, or RECEPTIONIST.';
        } else {
            $sanitized['role'] = $role;
        }

        // 4. First Name & Last Name
        $firstName = isset($data['first_name']) ? trim((string) $data['first_name']) : '';
        if ($firstName === '') {
            $errors['first_name'] = 'First name is required.';
        } elseif (strlen($firstName) < 2 || strlen($firstName) > 100) {
            $errors['first_name'] = 'First name must be between 2 and 100 characters.';
        } else {
            $sanitized['first_name'] = $firstName;
        }

        $lastName = isset($data['last_name']) ? trim((string) $data['last_name']) : '';
        if ($lastName === '') {
            $errors['last_name'] = 'Last name is required.';
        } elseif (strlen($lastName) < 2 || strlen($lastName) > 100) {
            $errors['last_name'] = 'Last name must be between 2 and 100 characters.';
        } else {
            $sanitized['last_name'] = $lastName;
        }

        // 5. Phone
        $phone = isset($data['phone']) ? trim((string) $data['phone']) : '';
        if ($phone !== '' && strlen($phone) > 50) {
            $errors['phone'] = 'Phone number cannot exceed 50 characters.';
        }
        $sanitized['phone'] = $phone;

        // 6. Dentist specific fields
        if ($role === 'DENTIST') {
            $sanitized['specialization'] = isset($data['specialization']) && trim((string) $data['specialization']) !== ''
                ? trim((string) $data['specialization'])
                : 'General Dentistry';

            $sanitized['license_number'] = isset($data['license_number']) && trim((string) $data['license_number']) !== ''
                ? trim((string) $data['license_number'])
                : 'PRC-' . rand(100000, 999999);
        }

        if (count($errors) > 0) {
            throw HttpException::unprocessable('Validation failed.', $errors);
        }

        return $sanitized;
    }

    /**
     * Validate role assignment payload
     *
     * @param array<string, mixed> $data
     * @return string Validated role
     * @throws HttpException
     */
    public static function validateRole(array $data): string
    {
        $role = isset($data['role']) ? strtoupper(trim((string) $data['role'])) : '';
        if ($role === '') {
            throw HttpException::unprocessable('Role is required.', ['role' => 'Role is required.']);
        }

        if (!in_array($role, self::ALLOWED_ROLES, true)) {
            throw HttpException::unprocessable(
                'Invalid role specified.',
                ['role' => 'Role must be ADMIN, DENTIST, RECEPTIONIST, or PATIENT.']
            );
        }

        return $role;
    }

    /**
     * Validate status payload
     *
     * @param array<string, mixed> $data
     * @return int (1 for active, 0 for inactive)
     * @throws HttpException
     */
    public static function validateStatus(array $data): int
    {
        if (!array_key_exists('is_active', $data) && !array_key_exists('status', $data)) {
            throw HttpException::unprocessable('Account status is required.', ['is_active' => 'Status is required.']);
        }

        $raw = $data['is_active'] ?? $data['status'];

        if (is_bool($raw)) {
            return $raw ? 1 : 0;
        }

        if (is_numeric($raw)) {
            $intVal = (int) $raw;
            if ($intVal === 0 || $intVal === 1) {
                return $intVal;
            }
        }

        if (is_string($raw)) {
            $upper = strtoupper(trim($raw));
            if ($upper === 'ACTIVE' || $upper === 'TRUE' || $upper === '1') {
                return 1;
            }
            if ($upper === 'INACTIVE' || $upper === 'DISABLED' || $upper === 'FALSE' || $upper === '0') {
                return 0;
            }
        }

        throw HttpException::unprocessable(
            'Invalid status value.',
            ['is_active' => 'Status must be a boolean or 1/0.']
        );
    }

    /**
     * Validate user profile update payload (name, phone)
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     * @throws HttpException
     */
    public static function validateUpdateProfile(array $data): array
    {
        $errors = [];
        $sanitized = [];

        if (array_key_exists('first_name', $data)) {
            $firstName = trim((string) $data['first_name']);
            if ($firstName === '') {
                $errors['first_name'] = 'First name cannot be empty.';
            } elseif (strlen($firstName) < 2 || strlen($firstName) > 100) {
                $errors['first_name'] = 'First name must be between 2 and 100 characters.';
            } else {
                $sanitized['first_name'] = $firstName;
            }
        }

        if (array_key_exists('last_name', $data)) {
            $lastName = trim((string) $data['last_name']);
            if ($lastName === '') {
                $errors['last_name'] = 'Last name cannot be empty.';
            } elseif (strlen($lastName) < 2 || strlen($lastName) > 100) {
                $errors['last_name'] = 'Last name must be between 2 and 100 characters.';
            } else {
                $sanitized['last_name'] = $lastName;
            }
        }

        if (array_key_exists('phone', $data)) {
            $phone = trim((string) ($data['phone'] ?? ''));
            if ($phone !== '' && strlen($phone) > 50) {
                $errors['phone'] = 'Phone number cannot exceed 50 characters.';
            } else {
                $sanitized['phone'] = $phone !== '' ? $phone : null;
            }
        }

        if (count($errors) > 0) {
            throw HttpException::unprocessable('Validation failed.', $errors);
        }

        return $sanitized;
    }
}
