<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\HttpException;
use App\Repositories\DentistRepository;
use App\Repositories\UserRepository;
use App\Validators\DentistValidator;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

class DentistManagementTest extends TestCase
{
    private DentistRepository $dentistRepository;
    private UserRepository $userRepository;

    protected function setUp(): void
    {
        TestDb::create();
        $this->dentistRepository = new DentistRepository();
        $this->userRepository = new UserRepository();
    }

    public function testValidatorAcceptsValidDentistCreation(): void
    {
        $input = [
            'first_name' => 'Roberto',
            'last_name' => 'Reyes',
            'email' => 'dr.reyes@toothcare.com',
            'password' => 'ToothCare!2026',
            'license_number' => 'PRC-DEN-001234',
            'specialization' => 'Orthodontics',
            'phone' => '+639171234567',
            'default_operatory_chair' => 'Chair 2',
            'bio' => 'Certified orthodontist with 10 years experience.',
            'is_active' => 1,
        ];

        $validated = DentistValidator::validateCreate($input);

        $this->assertSame('Roberto', $validated['first_name']);
        $this->assertSame('Reyes', $validated['last_name']);
        $this->assertSame('dr.reyes@toothcare.com', $validated['email']);
        $this->assertSame('PRC-DEN-001234', $validated['license_number']);
        $this->assertSame('Orthodontics', $validated['specialization']);
        $this->assertSame('Chair 2', $validated['default_operatory_chair']);
    }

    public function testValidatorRejectsWeakPassword(): void
    {
        $input = [
            'first_name' => 'Elena',
            'last_name' => 'Gomez',
            'email' => 'dr.gomez@toothcare.com',
            'password' => 'short', // < 8 characters
            'license_number' => 'PRC-DEN-005678',
            'phone' => '+639179998888',
        ];

        $this->expectException(HttpException::class);
        $this->expectExceptionCode(422);

        try {
            DentistValidator::validateCreate($input);
        } catch (HttpException $e) {
            $this->assertArrayHasKey('password', $e->getDetails());
            throw $e;
        }
    }

    public function testValidatorRejectsInvalidEmail(): void
    {
        $input = [
            'first_name' => 'Elena',
            'last_name' => 'Gomez',
            'email' => 'not-an-email',
            'password' => 'SecurePass123!',
            'license_number' => 'PRC-DEN-005678',
            'phone' => '+639179998888',
        ];

        $this->expectException(HttpException::class);
        $this->expectExceptionCode(422);

        try {
            DentistValidator::validateCreate($input);
        } catch (HttpException $e) {
            $this->assertArrayHasKey('email', $e->getDetails());
            throw $e;
        }
    }

    public function testDentistRepositoryCrudAndSynchronization(): void
    {
        // 1. Create Dentist with user account
        $userId = $this->userRepository->create(
            'dr.santos@toothcare.com',
            password_hash('Password123!', PASSWORD_BCRYPT),
            'DENTIST',
            1,
            1
        );

        $dentistId = $this->dentistRepository->create([
            'user_id' => $userId,
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'license_number' => 'PRC-DEN-009999',
            'specialization' => 'General Dentistry',
            'phone' => '+639171112222',
            'default_operatory_chair' => 'Chair 1',
            'bio' => 'General practitioner.',
            'is_active' => 1,
        ]);

        $this->assertGreaterThan(0, $dentistId);

        // 2. Query Dentist profile joined with user account
        $dentist = $this->dentistRepository->findById($dentistId);
        $this->assertNotNull($dentist);
        $this->assertSame('Maria', $dentist['first_name']);
        $this->assertSame('Santos', $dentist['last_name']);
        $this->assertSame('dr.santos@toothcare.com', $dentist['email']);
        $this->assertSame('DENTIST', $dentist['role']);
        $this->assertSame(1, (int) $dentist['is_active']);

        // 3. Find by License Number
        $byLicense = $this->dentistRepository->findByLicenseNumber('PRC-DEN-009999');
        $this->assertNotNull($byLicense);
        $this->assertSame($dentistId, (int) $byLicense['id']);

        // 4. Update Profile
        $updated = $this->dentistRepository->update($dentistId, [
            'specialization' => 'Cosmetic Dentistry',
            'default_operatory_chair' => 'Chair 3',
        ]);
        $this->assertTrue($updated);

        $fresh = $this->dentistRepository->findById($dentistId);
        $this->assertSame('Cosmetic Dentistry', $fresh['specialization']);
        $this->assertSame('Chair 3', $fresh['default_operatory_chair']);

        // 5. Status Deactivation Synchronization (Both dentist and linked user account become 0)
        $deactivated = $this->dentistRepository->updateStatus($dentistId, 0);
        $this->assertTrue($deactivated);

        $freshDentist = $this->dentistRepository->findById($dentistId);
        $this->assertSame(0, (int) $freshDentist['is_active']);

        $linkedUser = $this->userRepository->findById($userId);
        $this->assertSame(0, (int) $linkedUser['is_active']);

        // 6. Public Listing excludes inactive
        $activePublic = $this->dentistRepository->listActive();
        $this->assertEmpty($activePublic);

        // 7. Re-activation
        $this->dentistRepository->updateStatus($dentistId, 1);
        $freshDentistActive = $this->dentistRepository->findById($dentistId);
        $this->assertSame(1, (int) $freshDentistActive['is_active']);
        $linkedUserActive = $this->userRepository->findById($userId);
        $this->assertSame(1, (int) $linkedUserActive['is_active']);

        $activePublicAfter = $this->dentistRepository->listActive();
        $this->assertCount(1, $activePublicAfter);
    }
}

