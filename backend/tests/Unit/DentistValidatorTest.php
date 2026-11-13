<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\HttpException;
use App\Validators\DentistValidator;
use PHPUnit\Framework\TestCase;

/**
 * Unit Test Suite for DentistValidator
 * Validates dentist practitioner credentials, dental board license format, and operatory chair assignments.
 */
class DentistValidatorTest extends TestCase
{
    private function getValidDentistData(): array
    {
        return [
            'email' => 'dr.reyes@toothcare.local',
            'first_name' => 'Rafael',
            'last_name' => 'Reyes',
            'license_number' => 'PRC-DEN-098765',
            'specialization' => 'Orthodontics & Dentofacial Orthopedics',
            'phone' => '+639181112233',
            'default_operatory_chair' => 'Chair 2',
            'bio' => 'Experienced orthodontist with over 10 years of clinical practice.',
            'is_active' => 1,
        ];
    }

    public function testValidDentistCreateSucceedsAndGeneratesSecurePasswordWhenOmitted(): void
    {
        $input = $this->getValidDentistData();

        $validated = DentistValidator::validateCreate($input);

        $this->assertSame('dr.reyes@toothcare.local', $validated['email']);
        $this->assertSame('Rafael', $validated['first_name']);
        $this->assertSame('Reyes', $validated['last_name']);
        $this->assertSame('PRC-DEN-098765', $validated['license_number']);
        $this->assertSame('Orthodontics & Dentofacial Orthopedics', $validated['specialization']);
        $this->assertSame('+639181112233', $validated['phone']);
        $this->assertSame('Chair 2', $validated['default_operatory_chair']);
        $this->assertNotEmpty($validated['password']);
        $this->assertSame(1, $validated['is_active']);
    }

    public function testDentistCreateWithExplicitPasswordPassesComplexityValidation(): void
    {
        $input = $this->getValidDentistData();
        $input['password'] = 'StrongDentistPass123!';

        $validated = DentistValidator::validateCreate($input);

        $this->assertSame('StrongDentistPass123!', $validated['password']);
    }

    public function testDentistCreateRejectsWeakExplicitPassword(): void
    {
        $input = $this->getValidDentistData();
        $input['password'] = 'weakpassword';

        try {
            DentistValidator::validateCreate($input);
            $this->fail('Expected HttpException 422 for weak password');
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
            $this->assertArrayHasKey('password', $e->getDetails());
        }
    }

    public function testDentistCreateRejectsMissingMandatoryFields(): void
    {
        try {
            DentistValidator::validateCreate([]);
            $this->fail('Expected HttpException 422 for empty dentist payload');
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
            $details = $e->getDetails();
            $this->assertArrayHasKey('email', $details);
            $this->assertArrayHasKey('first_name', $details);
            $this->assertArrayHasKey('last_name', $details);
            $this->assertArrayHasKey('license_number', $details);
            $this->assertArrayHasKey('specialization', $details);
            $this->assertArrayHasKey('phone', $details);
        }
    }

    public function testDentistCreateRejectsInvalidEmailAndPhone(): void
    {
        $input = $this->getValidDentistData();
        $input['email'] = 'not-an-email';
        $input['phone'] = 'abc';

        try {
            DentistValidator::validateCreate($input);
            $this->fail('Expected HttpException 422 for invalid email and phone');
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
            $details = $e->getDetails();
            $this->assertArrayHasKey('email', $details);
            $this->assertArrayHasKey('phone', $details);
        }
    }

    public function testDentistUpdateValidatesPartialFields(): void
    {
        $partial = [
            'first_name' => 'Dr. Rafael',
            'default_operatory_chair' => 'Chair 3',
        ];

        $validated = DentistValidator::validateUpdate($partial);

        $this->assertSame('Dr. Rafael', $validated['first_name']);
        $this->assertSame('Chair 3', $validated['default_operatory_chair']);
        $this->assertArrayNotHasKey('last_name', $validated);
        $this->assertArrayNotHasKey('license_number', $validated);
    }
}
