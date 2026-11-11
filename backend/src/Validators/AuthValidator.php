<?php

declare(strict_types=1);

namespace App\Validators;

use App\Core\Config;
use App\Core\HttpException;

/**
 * Authentication and Account Security Validator
 * Enforces strict input validation and server-side constraints.
 */
class AuthValidator
{
    /**
     * Validate registration payload for a new Patient
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed> Cleaned and normalized data
     * @throws HttpException
     */
    public static function validateRegister(array $data): array
    {
        $errors = [];
        $config = Config::getInstance();
        $minPasswordLength = $config->getInt('auth_password_min_length', 8);

        // 1. Email
        $rawEmail = isset($data['email']) ? trim((string) $data['email']) : '';
        if ($rawEmail === '') {
            $errors['email'] = 'Email address is required.';
        } elseif (strlen($rawEmail) > 255) {
            $errors['email'] = 'Email address cannot exceed 255 characters.';
        } elseif (!filter_var($rawEmail, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'A valid email address is required.';
        }

        // 2. Password
        $password = isset($data['password']) ? (string) $data['password'] : '';
        if ($password === '') {
            $errors['password'] = 'Password is required.';
        } elseif (strlen($password) < $minPasswordLength) {
            $errors['password'] = "Password must be at least {$minPasswordLength} characters long.";
        } elseif (
            !preg_match('/[A-Z]/', $password) ||
            !preg_match('/[a-z]/', $password) ||
            !preg_match('/[0-9]/', $password) ||
            !preg_match('/[^A-Za-z0-9]/', $password)
        ) {
            $errors['password'] = 'Password must include at least one uppercase letter, one lowercase letter, one number, and one special character.';
        }

        // 3. First Name
        $firstName = isset($data['first_name']) ? trim((string) $data['first_name']) : '';
        if ($firstName === '') {
            $errors['first_name'] = 'First name is required.';
        } elseif (mb_strlen($firstName) > 100) {
            $errors['first_name'] = 'First name cannot exceed 100 characters.';
        }

        // 4. Last Name
        $lastName = isset($data['last_name']) ? trim((string) $data['last_name']) : '';
        if ($lastName === '') {
            $errors['last_name'] = 'Last name is required.';
        } elseif (mb_strlen($lastName) > 100) {
            $errors['last_name'] = 'Last name cannot exceed 100 characters.';
        }

        // 5. Phone
        $phone = isset($data['phone']) ? trim((string) $data['phone']) : '';
        if ($phone === '') {
            $errors['phone'] = 'Phone number is required.';
        } elseif (!preg_match('/^[0-9+\s\-()]{7,30}$/', $phone)) {
            $errors['phone'] = 'Phone number format is invalid.';
        }

        // 6. Date of Birth (YYYY-MM-DD)
        $dob = isset($data['date_of_birth']) ? trim((string) $data['date_of_birth']) : '';
        if ($dob === '') {
            $errors['date_of_birth'] = 'Date of birth is required.';
        } else {
            $d = \DateTimeImmutable::createFromFormat('Y-m-d', $dob);
            if (!$d || $d->format('Y-m-d') !== $dob) {
                $errors['date_of_birth'] = 'Date of birth must be a valid date in YYYY-MM-DD format.';
            } elseif ($d > new \DateTimeImmutable('today')) {
                $errors['date_of_birth'] = 'Date of birth cannot be in the future.';
            }
        }

        // 7. Gender (Optional enum)
        $gender = isset($data['gender']) ? strtoupper(trim((string) $data['gender'])) : 'PREFER_NOT_TO_SAY';
        $allowedGenders = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
        if (!in_array($gender, $allowedGenders, true)) {
            $errors['gender'] = 'Gender must be MALE, FEMALE, OTHER, or PREFER_NOT_TO_SAY.';
        }

        // Optional demographic fields
        $address = isset($data['address']) ? trim((string) $data['address']) : null;
        if ($address !== null && mb_strlen($address) > 255) {
            $errors['address'] = 'Address cannot exceed 255 characters.';
        }

        $emergencyContactName = isset($data['emergency_contact_name']) ? trim((string) $data['emergency_contact_name']) : null;
        if ($emergencyContactName !== null && mb_strlen($emergencyContactName) > 150) {
            $errors['emergency_contact_name'] = 'Emergency contact name cannot exceed 150 characters.';
        }

        $emergencyContactPhone = isset($data['emergency_contact_phone']) ? trim((string) $data['emergency_contact_phone']) : null;
        if ($emergencyContactPhone !== null && !preg_match('/^[0-9+\s\-()]{7,30}$/', $emergencyContactPhone)) {
            $errors['emergency_contact_phone'] = 'Emergency contact phone format is invalid.';
        }

        $medicalAlerts = isset($data['medical_alerts']) ? trim((string) $data['medical_alerts']) : null;

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Validation failed for registration input.', $errors);
        }

        return [
            'email' => strtolower($rawEmail),
            'password' => $password,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'phone' => $phone,
            'date_of_birth' => $dob,
            'gender' => $gender,
            'address' => $address,
            'emergency_contact_name' => $emergencyContactName,
            'emergency_contact_phone' => $emergencyContactPhone,
            'medical_alerts' => $medicalAlerts,
            // Strictly enforce PATIENT role on server - client input cannot override
            'role' => 'PATIENT',
        ];
    }

    /**
     * Validate login input
     *
     * @param array<string, mixed> $data
     * @return array{email: string, password: string}
     * @throws HttpException
     */
    public static function validateLogin(array $data): array
    {
        $errors = [];

        $rawEmail = isset($data['email']) ? trim((string) $data['email']) : '';
        if ($rawEmail === '') {
            $errors['email'] = 'Email address is required.';
        } elseif (!filter_var($rawEmail, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'A valid email address is required.';
        }

        $password = isset($data['password']) ? (string) $data['password'] : '';
        if ($password === '') {
            $errors['password'] = 'Password is required.';
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Validation failed for login credentials.', $errors);
        }

        return [
            'email' => strtolower($rawEmail),
            'password' => $password,
        ];
    }

    /**
     * Validate verify email input
     *
     * @param array<string, mixed> $data
     * @return array{token: string}
     */
    public static function validateVerifyEmail(array $data): array
    {
        $token = isset($data['token']) ? trim((string) $data['token']) : '';
        if ($token === '' || strlen($token) < 16) {
            throw HttpException::unprocessableEntity('Validation failed for email verification.', [
                'token' => 'A valid verification token is required.',
            ]);
        }

        return ['token' => $token];
    }

    /**
     * Validate resend verification input
     *
     * @param array<string, mixed> $data
     * @return array{email: string}
     */
    public static function validateResendVerification(array $data): array
    {
        $rawEmail = isset($data['email']) ? trim((string) $data['email']) : '';
        if ($rawEmail === '' || !filter_var($rawEmail, FILTER_VALIDATE_EMAIL)) {
            throw HttpException::unprocessableEntity('Validation failed for resending verification email.', [
                'email' => 'A valid email address is required.',
            ]);
        }

        return ['email' => strtolower($rawEmail)];
    }

    /**
     * Validate forgot password input
     *
     * @param array<string, mixed> $data
     * @return array{email: string}
     */
    public static function validateForgotPassword(array $data): array
    {
        $rawEmail = isset($data['email']) ? trim((string) $data['email']) : '';
        if ($rawEmail === '' || !filter_var($rawEmail, FILTER_VALIDATE_EMAIL)) {
            throw HttpException::unprocessableEntity('Validation failed for password reset request.', [
                'email' => 'A valid email address is required.',
            ]);
        }

        return ['email' => strtolower($rawEmail)];
    }

    /**
     * Validate reset password completion input
     *
     * @param array<string, mixed> $data
     * @return array{token: string, password: string}
     */
    public static function validateResetPassword(array $data): array
    {
        $errors = [];
        $config = Config::getInstance();
        $minPasswordLength = $config->getInt('auth_password_min_length', 8);

        $token = isset($data['token']) ? trim((string) $data['token']) : '';
        if ($token === '' || strlen($token) < 16) {
            $errors['token'] = 'A valid password reset token is required.';
        }

        $password = isset($data['password']) ? (string) $data['password'] : '';
        if ($password === '') {
            $errors['password'] = 'New password is required.';
        } elseif (strlen($password) < $minPasswordLength) {
            $errors['password'] = "Password must be at least {$minPasswordLength} characters long.";
        } elseif (
            !preg_match('/[A-Z]/', $password) ||
            !preg_match('/[a-z]/', $password) ||
            !preg_match('/[0-9]/', $password) ||
            !preg_match('/[^A-Za-z0-9]/', $password)
        ) {
            $errors['password'] = 'Password must include at least one uppercase letter, one lowercase letter, one number, and one special character.';
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Validation failed for resetting password.', $errors);
        }

        return [
            'token' => $token,
            'password' => $password,
        ];
    }
}

