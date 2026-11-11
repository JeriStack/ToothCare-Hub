<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\HttpException;
use App\Repositories\ServiceRepository;
use App\Validators\ServiceValidator;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

class ServiceManagementTest extends TestCase
{
    private ServiceRepository $serviceRepository;

    protected function setUp(): void
    {
        TestDb::create();
        $this->serviceRepository = new ServiceRepository();
    }

    public function testValidatorAcceptsValidServiceData(): void
    {
        $input = [
            'name' => 'Dental Cleaning (Prophylaxis)',
            'category' => 'General',
            'description' => 'Standard scaling and polishing.',
            'price' => '1500.50',
            'duration_minutes' => '45',
            'is_active' => 1,
        ];

        $validated = ServiceValidator::validate($input);

        $this->assertSame('Dental Cleaning (Prophylaxis)', $validated['name']);
        $this->assertEquals(1500.50, $validated['price']);
        $this->assertSame('1500.50', $validated['price']);
        $this->assertSame(45, $validated['duration_minutes']);
        $this->assertSame('General', $validated['category']);
        $this->assertSame(1, $validated['is_active']);
    }

    public function testValidatorRejectsNegativePrice(): void
    {
        $input = [
            'name' => 'Fluoride Treatment',
            'price' => -50.00,
            'duration_minutes' => 30,
        ];

        $this->expectException(HttpException::class);
        $this->expectExceptionCode(422);

        try {
            ServiceValidator::validate($input);
        } catch (HttpException $e) {
            $this->assertArrayHasKey('price', $e->getDetails());
            throw $e;
        }
    }

    public function testValidatorRejectsInvalidDurationMinutes(): void
    {
        $input = [
            'name' => 'Tooth Extraction',
            'price' => 1200.00,
            'duration_minutes' => 25, // Not in [15, 30, 45, 60, 90, 120]
        ];

        $this->expectException(HttpException::class);
        $this->expectExceptionCode(422);

        try {
            ServiceValidator::validate($input);
        } catch (HttpException $e) {
            $this->assertArrayHasKey('duration_minutes', $e->getDetails());
            throw $e;
        }
    }

    public function testValidatorEnforcesNameLength(): void
    {
        $input = [
            'name' => 'A', // Too short (< 2 chars)
            'price' => 500.00,
            'duration_minutes' => 30,
        ];

        $this->expectException(HttpException::class);
        $this->expectExceptionCode(422);

        try {
            ServiceValidator::validate($input);
        } catch (HttpException $e) {
            $this->assertArrayHasKey('name', $e->getDetails());
            throw $e;
        }
    }

    public function testServiceRepositoryCrudAndPagination(): void
    {
        // 1. Create Services
        $id1 = $this->serviceRepository->create([
            'name' => 'Composite Restoration',
            'category' => 'Restorative',
            'description' => 'Tooth colored filling',
            'price' => 2000.00,
            'duration_minutes' => 60,
            'is_active' => 1,
        ]);

        $id2 = $this->serviceRepository->create([
            'name' => 'Root Canal Therapy',
            'category' => 'Endodontics',
            'description' => 'Molar endodontic treatment',
            'price' => 8500.00,
            'duration_minutes' => 90,
            'is_active' => 1,
        ]);

        $this->assertGreaterThan(0, $id1);
        $this->assertGreaterThan(0, $id2);

        // 2. Fetch by ID and Name
        $service1 = $this->serviceRepository->findById($id1);
        $this->assertNotNull($service1);
        $this->assertSame('Composite Restoration', $service1['name']);

        $serviceByName = $this->serviceRepository->findByName('Root Canal Therapy');
        $this->assertNotNull($serviceByName);
        $this->assertSame($id2, (int) $serviceByName['id']);

        // 3. Update Service
        $updated = $this->serviceRepository->update($id1, [
            'price' => 2200.00,
            'description' => 'Updated filling description',
        ]);
        $this->assertTrue($updated);

        $fresh1 = $this->serviceRepository->findById($id1);
        $this->assertEquals(2200.00, $fresh1['price']);
        $this->assertSame('Updated filling description', $fresh1['description']);

        // 4. Soft Deactivation
        $deactivated = $this->serviceRepository->updateStatus($id1, 0);
        $this->assertTrue($deactivated);

        $freshDeactivated = $this->serviceRepository->findById($id1);
        $this->assertSame(0, (int) $freshDeactivated['is_active']);

        // 5. Public Listing excludes inactive
        $activeOnly = $this->serviceRepository->listActive();
        $this->assertCount(1, $activeOnly);
        $this->assertSame($id2, (int) $activeOnly[0]['id']);

        // 6. Admin Search & Pagination
        $listResult = $this->serviceRepository->list(
            ['search' => 'Root'],
            'price',
            'DESC',
            1,
            10
        );

        $this->assertCount(1, $listResult['items']);
        $this->assertSame('Root Canal Therapy', $listResult['items'][0]['name']);
        $this->assertSame(1, $listResult['pagination']['total']);
    }
}
