<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\HttpException;
use App\Validators\ServiceValidator;
use PHPUnit\Framework\TestCase;

/**
 * Unit Test Suite for ServiceValidator
 * Verifies dental procedure name bounds, price constraints, and allowed duration slots.
 */
class ServiceValidatorTest extends TestCase
{
    public function testValidServiceDataPassesValidation(): void
    {
        $input = [
            'name' => 'Routine Oral Prophylaxis',
            'price' => '1200.50',
            'duration_minutes' => 45,
            'category' => 'Preventive',
            'description' => 'Comprehensive teeth cleaning and polishing.',
            'is_active' => 1,
        ];

        $validated = ServiceValidator::validate($input);

        $this->assertSame('Routine Oral Prophylaxis', $validated['name']);
        $this->assertSame('1200.50', $validated['price']);
        $this->assertSame(45, $validated['duration_minutes']);
        $this->assertSame('Preventive', $validated['category']);
        $this->assertSame(1, $validated['is_active']);
    }

    public function testRejectsMissingRequiredFieldsOnCreate(): void
    {
        try {
            ServiceValidator::validate([]);
            $this->fail('Expected HttpException 422 for empty service input');
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
            $details = $e->getDetails();
            $this->assertArrayHasKey('name', $details);
            $this->assertArrayHasKey('price', $details);
            $this->assertArrayHasKey('duration_minutes', $details);
        }
    }

    public function testRejectsNegativePrice(): void
    {
        try {
            ServiceValidator::validate([
                'name' => 'Fluoride Treatment',
                'price' => -50.00,
                'duration_minutes' => 30,
            ]);
            $this->fail('Expected HttpException 422 for negative price');
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
            $this->assertArrayHasKey('price', $e->getDetails());
            $this->assertSame('Price cannot be negative.', $e->getDetails()['price']);
        }
    }

    public function testRejectsNonNumericPrice(): void
    {
        try {
            ServiceValidator::validate([
                'name' => 'Fluoride Treatment',
                'price' => 'Free',
                'duration_minutes' => 30,
            ]);
            $this->fail('Expected HttpException 422 for string price');
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
            $this->assertArrayHasKey('price', $e->getDetails());
        }
    }

    public function testRejectsInvalidDurationMinutes(): void
    {
        $invalidDurations = [0, 10, 25, 50, 75, 180];

        foreach ($invalidDurations as $duration) {
            try {
                ServiceValidator::validate([
                    'name' => 'Deep Root Planing',
                    'price' => 2500,
                    'duration_minutes' => $duration,
                ]);
                $this->fail("Duration {$duration} should have been rejected");
            } catch (HttpException $e) {
                $this->assertSame(422, $e->getStatusCode());
                $this->assertArrayHasKey('duration_minutes', $e->getDetails());
            }
        }
    }

    public function testAcceptsAllAllowedDurations(): void
    {
        $allowed = [15, 30, 45, 60, 90, 120];

        foreach ($allowed as $duration) {
            $result = ServiceValidator::validate([
                'name' => 'Dental Procedure',
                'price' => 1000,
                'duration_minutes' => $duration,
            ]);
            $this->assertSame($duration, $result['duration_minutes']);
        }
    }

    public function testRejectsShortOrLongServiceName(): void
    {
        // 1 character (too short)
        try {
            ServiceValidator::validate([
                'name' => 'X',
                'price' => 500,
                'duration_minutes' => 30,
            ]);
            $this->fail('Single-character service name should fail');
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
            $this->assertArrayHasKey('name', $e->getDetails());
        }

        // > 150 characters (too long)
        try {
            ServiceValidator::validate([
                'name' => str_repeat('A', 151),
                'price' => 500,
                'duration_minutes' => 30,
            ]);
            $this->fail('151-character service name should fail');
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
            $this->assertArrayHasKey('name', $e->getDetails());
        }
    }

    public function testUpdateAllowsPartialFields(): void
    {
        $partial = [
            'price' => 1500.00,
        ];

        $validated = ServiceValidator::validate($partial, isUpdate: true);

        $this->assertArrayHasKey('price', $validated);
        $this->assertSame('1500.00', $validated['price']);
        $this->assertArrayNotHasKey('name', $validated);
        $this->assertArrayNotHasKey('duration_minutes', $validated);
    }
}
