<?php

declare(strict_types=1);

namespace Tests\Fixtures;

/**
 * Test Data Factory Helper
 */
class TestDataFactory
{
    public static function createValidUserPayload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'email' => 'maria.santos@example.com',
            'password' => 'Password123!',
            'role' => 'patient',
        ], $overrides);
    }

    public static function createValidAppointmentPayload(array $overrides = []): array
    {
        return array_merge([
            'dentist_id' => 1,
            'service_id' => 1,
            'appointment_date' => date('Y-m-d', strtotime('+3 days')),
            'start_time' => '09:00:00',
            'notes' => 'Regular dental checkup',
        ], $overrides);
    }
}

