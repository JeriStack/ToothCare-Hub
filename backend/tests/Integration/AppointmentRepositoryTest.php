<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

class AppointmentRepositoryTest extends TestCase
{
    public function testAppointmentRepositoryPlannedForPhase9(): void
    {
        $this->markTestSkipped('AppointmentRepository database queries planned for Phase 9.');
    }
}

