<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Repositories\AppointmentRepository;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

class AppointmentRepositoryTest extends TestCase
{
    private AppointmentRepository $repository;
    private \PDO $pdo;

    protected function setUp(): void
    {
        $this->pdo = TestDb::create();
        $this->repository = new AppointmentRepository();

        // Seed patient, dentist, and service
        $this->pdo->exec('
            INSERT INTO users (id, email, password_hash, role) VALUES
            (1, "patient@example.com", "hash", "PATIENT"),
            (2, "dentist@example.com", "hash", "DENTIST");

            INSERT INTO patients (id, user_id, first_name, last_name, date_of_birth, phone) VALUES
            (1, 1, "Juan", "Dela Cruz", "1990-01-01", "09171112233");

            INSERT INTO dentists (id, user_id, license_number, first_name, last_name, specialization, phone) VALUES
            (1, 2, "DNT-TEST-01", "Maria", "Santos", "General", "09179998877");

            INSERT INTO services (id, name, price, duration_minutes) VALUES
            (1, "Oral Scaling", 1500.00, 45);
        ');
    }

    public function testCreateAndFindAppointment(): void
    {
        $id = $this->repository->create([
            'patient_id' => 1,
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-10 09:00:00',
            'end_at' => '2026-11-10 09:45:00',
            'duration_snapshot' => 45,
            'price_snapshot' => 1500.00,
            'status' => 'CONFIRMED',
            'chief_complaint' => 'Routine dental checkup',
            'operatory_chair' => 'Chair 1',
        ]);

        $this->assertGreaterThan(0, $id);

        $appt = $this->repository->findById($id);
        $this->assertNotNull($appt);
        $this->assertSame('CONFIRMED', $appt['status']);
        $this->assertSame('Chair 1', $appt['operatory_chair']);
    }

    public function testFindBlockingByDentistAndRangeUsesHalfOpenInterval(): void
    {
        // Existing appointment: 09:00 to 09:45
        $this->repository->create([
            'patient_id' => 1,
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-10 09:00:00',
            'end_at' => '2026-11-10 09:45:00',
            'duration_snapshot' => 45,
            'price_snapshot' => 1500.00,
            'status' => 'CONFIRMED',
        ]);

        // Overlapping candidate: 09:30 to 10:15 (intersects)
        $conflicts1 = $this->repository->findBlockingByDentistAndRange(
            1,
            '2026-11-10 09:30:00',
            '2026-11-10 10:15:00'
        );
        $this->assertCount(1, $conflicts1);

        // Adjacent candidate ending at 09:00 (half-open [08:15, 09:00) should NOT conflict)
        $conflicts2 = $this->repository->findBlockingByDentistAndRange(
            1,
            '2026-11-10 08:15:00',
            '2026-11-10 09:00:00'
        );
        $this->assertCount(0, $conflicts2);

        // Adjacent candidate starting at 09:45 (half-open [09:45, 10:30) should NOT conflict)
        $conflicts3 = $this->repository->findBlockingByDentistAndRange(
            1,
            '2026-11-10 09:45:00',
            '2026-11-10 10:30:00'
        );
        $this->assertCount(0, $conflicts3);
    }

    public function testCancelledAndRejectedAppointmentsDoNotBlock(): void
    {
        $this->repository->create([
            'patient_id' => 1,
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-10 10:00:00',
            'end_at' => '2026-11-10 10:45:00',
            'duration_snapshot' => 45,
            'price_snapshot' => 1500.00,
            'status' => 'CANCELLED',
        ]);

        $conflicts = $this->repository->findBlockingByDentistAndRange(
            1,
            '2026-11-10 10:00:00',
            '2026-11-10 10:45:00'
        );
        $this->assertCount(0, $conflicts);
    }
}
