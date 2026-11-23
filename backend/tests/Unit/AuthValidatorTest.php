<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\HttpException;
use App\Validators\AuthValidator;
use PHPUnit\Framework\TestCase;

/**
 * Unit Test Suite for Authentication Validator
 * Validates registration payloads, password complexity, login credentials, and reset tokens.
 */
class AuthValidatorTest extends TestCase
{
    private function getValidPatientData(): array
    {
        return [
            'email' => 'Patient.Test@example.com',
            'password' => 'StrongPassword123!',
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'phone' => '+639171234567',
            'date_of_birth' => '1995-04-12',
            'gender' => 'FEMALE',
            'address' => '123 Rizal Ave, Manila',
            'emergency_contact_name' => 'Juan Santos',
            'emergency_contact_phone' => '+639179876543',
            'medical_alerts' => 'Penicillin allergy',
        ];
    }

    public function testValidRegistrationNormalizesDataAndEnforcesPatientRole(): void
    {
        $raw = $this->getValidPatientData();
        // Malicious client tries to escalate privilege
        $raw['role'] = 'ADMIN';

        $validated = AuthValidator::validateRegister($raw);

        $this->assertSame('patient.test@example.com', $validated['email']);
        $this->assertSame('StrongPassword123!', $validated['password']);
        $this->assertSame('Maria', $validated['first_name']);
        $this->assertSame('Santos', $validated['last_name']);
        $this->assertSame('PATIENT', $validated['role']);
        $this->assertSame('FEMALE', $validated['gender']);
        $this->assertSame('1995-04-12', $validated['date_of_birth']);
    }

    public function testRegistrationRejectsMissingRequiredFields(): void
    {
        try {
            AuthValidator::validateRegister([]);
            $this->fail('Expected HttpException 422 was not thrown');
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
            $errors = $e->getDetails();
            $this->assertArrayHasKey('email', $errors);
            $this->assertArrayHasKey('password', $errors);
            $this->assertArrayHasKey('first_name', $errors);
            $this->assertArrayHasKey('last_name', $errors);
            $this->assertArrayHasKey('phone', $errors);
            $this->assertArrayHasKey('date_of_birth', $errors);
        }
    }

    public function testRegistrationDefaultsGenderToPreferNotToSayWhenOmitted(): void
    {
        $raw = $this->getValidPatientData();
        unset($raw['gender']);

        $validated = AuthValidator::validateRegister($raw);
        $this->assertSame('PREFER_NOT_TO_SAY', $validated['gender']);
    }

    public function testRegistrationRejectsNumbersInFirstOrLastName(): void
    {
        $data = $this->getValidPatientData();
        $data['first_name'] = 'Maria123';
        $data['last_name'] = 'Santos9';
        $data['emergency_contact_name'] = 'Juan 42 Santos';

        try {
            AuthValidator::validateRegister($data);
            $this->fail('Expected HttpException 422 for numeric characters in name fields');
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
            $errors = $e->getDetails();
            $this->assertSame('First name cannot contain numbers.', $errors['first_name'] ?? null);
            $this->assertSame('Last name cannot contain numbers.', $errors['last_name'] ?? null);
            $this->assertSame('Emergency contact name cannot contain numbers.', $errors['emergency_contact_name'] ?? null);
        }
    }

    public function testRegistrationRejectsLettersOrPunctuationOnlyInPhoneFields(): void
    {
        $data = $this->getValidPatientData();
        $data['phone'] = 'phone-abc-1234';
        $data['emergency_contact_phone'] = '-------';

        try {
            AuthValidator::validateRegister($data);
            $this->fail('Expected HttpException 422 for invalid phone fields');
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
            $errors = $e->getDetails();
            $this->assertSame('Phone number format is invalid.', $errors['phone'] ?? null);
            $this->assertSame('Emergency contact phone format is invalid.', $errors['emergency_contact_phone'] ?? null);
        }
    }

    public function testRegistrationNormalizesEmptyOptionalFieldsToNull(): void
    {
        $data = $this->getValidPatientData();
        $data['address'] = '   ';
        $data['emergency_contact_name'] = '';
        $data['emergency_contact_phone'] = '';
        $data['medical_alerts'] = '';

        $validated = AuthValidator::validateRegister($data);
        $this->assertNull($validated['address']);
        $this->assertNull($validated['emergency_contact_name']);
        $this->assertNull($validated['emergency_contact_phone']);
        $this->assertNull($validated['medical_alerts']);
    }

    public function testRegistrationAcceptsInternationalAndPunctuatedNames(): void
    {
        $data = $this->getValidPatientData();
        $data['first_name'] = 'José Niño';
        $data['last_name'] = "De la Cruz-O'Brien Jr.";

        $validated = AuthValidator::validateRegister($data);
        $this->assertSame('José Niño', $validated['first_name']);
        $this->assertSame("De la Cruz-O'Brien Jr.", $validated['last_name']);
    }

    public function testRegistrationRejectsInvalidEmailFormat(): void
    {
        $data = $this->getValidPatientData();
        $data['email'] = 'not-a-valid-email';

        try {
            AuthValidator::validateRegister($data);
            $this->fail('Expected HttpException 422 was not thrown');
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
            $this->assertArrayHasKey('email', $e->getDetails());
        }
    }

    public function testRegistrationRejectsWeakPasswords(): void
    {
        $weakPasswords = [
            'short1!',          // too short (<8)
            'alllowercase123!', // no uppercase
            'ALLUPPERCASE123!', // no lowercase
            'NoNumbersHere!',   // no digit
            'NoSpecialChar123', // no symbol
        ];

        foreach ($weakPasswords as $weakPw) {
            $data = $this->getValidPatientData();
            $data['password'] = $weakPw;

            try {
                AuthValidator::validateRegister($data);
                $this->fail("Password '{$weakPw}' should have been rejected");
            } catch (HttpException $e) {
                $this->assertSame(422, $e->getStatusCode());
                $this->assertArrayHasKey('password', $e->getDetails());
            }
        }
    }

    public function testRegistrationRejectsFutureBirthDate(): void
    {
        $data = $this->getValidPatientData();
        $data['date_of_birth'] = date('Y-m-d', strtotime('+1 year'));

        try {
            AuthValidator::validateRegister($data);
            $this->fail('Expected HttpException 422 for future date_of_birth');
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
            $this->assertArrayHasKey('date_of_birth', $e->getDetails());
        }
    }

    public function testRegistrationRejectsInvalidGender(): void
    {
        $data = $this->getValidPatientData();
        $data['gender'] = 'UNKNOWN_GENDER';

        try {
            AuthValidator::validateRegister($data);
            $this->fail('Expected HttpException 422 for invalid gender');
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
            $this->assertArrayHasKey('gender', $e->getDetails());
        }
    }

    public function testValidLoginSucceedsWithNormalizedEmail(): void
    {
        $result = AuthValidator::validateLogin([
            'email' => '  Patient.Juan@Example.COM  ',
            'password' => 'Password123!',
        ]);

        $this->assertSame('patient.juan@example.com', $result['email']);
        $this->assertSame('Password123!', $result['password']);
        $this->assertFalse($result['remember_me']);
    }

    public function testLoginParsesRememberMeBooleanFlag(): void
    {
        $truthy = AuthValidator::validateLogin([
            'email' => 'patient.juan@example.com',
            'password' => 'Password123!',
            'remember_me' => true,
        ]);
        $stringTruthy = AuthValidator::validateLogin([
            'email' => 'patient.juan@example.com',
            'password' => 'Password123!',
            'remember_me' => 'true',
        ]);
        $falsy = AuthValidator::validateLogin([
            'email' => 'patient.juan@example.com',
            'password' => 'Password123!',
            'remember_me' => 'false',
        ]);

        $this->assertTrue($truthy['remember_me']);
        $this->assertTrue($stringTruthy['remember_me']);
        $this->assertFalse($falsy['remember_me']);
    }

    public function testLoginRejectsMissingCredentials(): void
    {
        try {
            AuthValidator::validateLogin([]);
            $this->fail('Expected HttpException 422 for empty login payload');
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
            $errors = $e->getDetails();
            $this->assertArrayHasKey('email', $errors);
            $this->assertArrayHasKey('password', $errors);
        }
    }

    public function testForgotPasswordValidatesEmail(): void
    {
        $result = AuthValidator::validateForgotPassword(['email' => 'User@Toothcare.Local']);
        $this->assertSame('user@toothcare.local', $result['email']);

        $this->expectException(HttpException::class);
        AuthValidator::validateForgotPassword(['email' => 'invalid-email']);
    }

    public function testVerifyEmailValidatesTokenLength(): void
    {
        $token = bin2hex(random_bytes(16)); // 32 chars
        $result = AuthValidator::validateVerifyEmail(['token' => $token]);
        $this->assertSame($token, $result['token']);

        $this->expectException(HttpException::class);
        AuthValidator::validateVerifyEmail(['token' => 'short']);
    }
}
