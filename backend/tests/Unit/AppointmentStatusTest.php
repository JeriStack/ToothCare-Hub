<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\HttpException;
use App\Validators\AppointmentValidator;
use PHPUnit\Framework\TestCase;

/**
 * Unit Test Suite for Appointment Lifecycle Status Transitions & Validation
 */
class AppointmentStatusTest extends TestCase
{
    public function testAllRequiredStatusesExist(): void
    {
        $expected = ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'];
        $this->assertEquals($expected, AppointmentValidator::VALID_STATUSES);
    }

    public function testAllowedTransitionsFromPending(): void
    {
        // PENDING -> CONFIRMED
        AppointmentValidator::validateStatusTransition('PENDING', 'CONFIRMED');
        // PENDING -> REJECTED
        AppointmentValidator::validateStatusTransition('PENDING', 'REJECTED');
        // PENDING -> CANCELLED
        AppointmentValidator::validateStatusTransition('PENDING', 'CANCELLED');

        $this->assertTrue(true);
    }

    public function testAllowedTransitionsFromConfirmed(): void
    {
        // CONFIRMED -> COMPLETED
        AppointmentValidator::validateStatusTransition('CONFIRMED', 'COMPLETED');
        // CONFIRMED -> CANCELLED
        AppointmentValidator::validateStatusTransition('CONFIRMED', 'CANCELLED');

        $this->assertTrue(true);
    }

    public function testTerminalStatusesCannotTransition(): void
    {
        $terminalStatuses = ['REJECTED', 'CANCELLED', 'COMPLETED'];
        $targets = ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'];

        foreach ($terminalStatuses as $terminal) {
            foreach ($targets as $target) {
                try {
                    AppointmentValidator::validateStatusTransition($terminal, $target);
                    $this->fail("Terminal status {$terminal} should not be allowed to transition to {$target}");
                } catch (HttpException $e) {
                    $this->assertContains($e->getStatusCode(), [409, 422]);
                }
            }
        }
    }

    public function testPendingCannotDirectlyBecomeCompleted(): void
    {
        $this->expectException(HttpException::class);
        AppointmentValidator::validateStatusTransition('PENDING', 'COMPLETED');
    }

    public function testTransitionToSameStatusThrowsConflict(): void
    {
        try {
            AppointmentValidator::validateStatusTransition('PENDING', 'PENDING');
            $this->fail('Transition to same status should throw conflict.');
        } catch (HttpException $e) {
            $this->assertEquals(409, $e->getStatusCode());
            $this->assertEquals('STATUS_UNCHANGED', $e->getErrorCode());
        }
    }

    public function testInvalidStatusStringThrowsException(): void
    {
        $this->expectException(HttpException::class);
        AppointmentValidator::validateStatusTransition('PENDING', 'NON_EXISTENT_STATUS');
    }

    public function testValidateBookingRequiresDentistAndService(): void
    {
        $this->expectException(HttpException::class);
        AppointmentValidator::validateBooking([
            'start_at' => '2026-11-20 09:00:00',
        ]);
    }

    public function testValidateBookingRequiresValidDate(): void
    {
        $this->expectException(HttpException::class);
        AppointmentValidator::validateBooking([
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => 'not-a-valid-date',
        ]);
    }

    public function testValidateBookingSanitizesChiefComplaint(): void
    {
        $validated = AppointmentValidator::validateBooking([
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-20 09:00:00',
            'chief_complaint' => '<script>alert("xss")</script>Severe molar ache & pain',
        ]);

        $this->assertEquals(1, $validated['dentist_id']);
        $this->assertEquals(1, $validated['service_id']);
        $this->assertStringNotContainsString('<script>', $validated['chief_complaint']);
        $this->assertStringContainsString('Severe molar ache', $validated['chief_complaint']);
    }

    public function testValidateCancellationTrimsReason(): void
    {
        $validated = AppointmentValidator::validateCancellation([
            'reason' => '   Family emergency   ',
        ]);
        $this->assertEquals('Family emergency', $validated['reason']);
    }

    public function testValidateRejectionReason(): void
    {
        $validated = AppointmentValidator::validateRejection([
            'reason' => 'Dentist on emergency surgery',
        ]);
        $this->assertEquals('Dentist on emergency surgery', $validated['reason']);
    }
}
