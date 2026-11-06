<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\HttpException;
use App\Repositories\AppointmentRepository;
use App\Services\AppointmentService;
use App\Validators\AppointmentValidator;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Unit Test Suite for Appointment Service
 * Tests transactional booking, double-booking prevention, status lifecycle transitions, and rescheduling.
 */
class AppointmentServiceTest extends TestCase
{
    private PDO $pdo;
    private AppointmentService $service;
    private AppointmentRepository $appointmentRepo;
    private DateTimeZone $tz;

    protected function setUp(): void
    {
        $this->pdo = TestDb::create();
        $this->service = new AppointmentService();
        $this->appointmentRepo = new AppointmentRepository();
        $this->tz = new DateTimeZone('Asia/Manila');

        // Seed users, patient, dentist, service, and shift
        $this->seedTestData();
    }

    private function seedTestData(): void
    {
        // 1. Patient User (ID 10) & Profile (ID 1)
        $this->pdo->exec('
            INSERT INTO users (id, email, password_hash, role, is_active)
            VALUES (10, "patient@test.com", "hash", "PATIENT", 1);
            INSERT INTO patients (id, user_id, first_name, last_name, date_of_birth, phone)
            VALUES (1, 10, "Juan", "Dela Cruz", "1990-01-01", "+639171112222");
        ');

        // 2. Second Patient User (ID 20) & Profile (ID 2)
        $this->pdo->exec('
            INSERT INTO users (id, email, password_hash, role, is_active)
            VALUES (20, "maria@test.com", "hash", "PATIENT", 1);
            INSERT INTO patients (id, user_id, first_name, last_name, date_of_birth, phone)
            VALUES (2, 20, "Maria", "Santos", "1992-05-15", "+639173334444");
        ');

        // 3. Admin User (ID 99)
        $this->pdo->exec('
            INSERT INTO users (id, email, password_hash, role, is_active)
            VALUES (99, "admin@test.com", "hash", "ADMIN", 1);
        ');

        // 4. Dentist User (ID 30) & Dentist Profile (ID 1)
        $this->pdo->exec('
            INSERT INTO users (id, email, password_hash, role, is_active)
            VALUES (30, "dentist@test.com", "hash", "DENTIST", 1);
            INSERT INTO dentists (id, user_id, license_number, first_name, last_name, specialization, phone, is_active)
            VALUES (1, 30, "PRC-12345", "Ana", "Reyes", "General Dentistry", "+639175556666", 1);
        ');

        // 5. Inactive Dentist (ID 2)
        $this->pdo->exec('
            INSERT INTO users (id, email, password_hash, role, is_active)
            VALUES (31, "inactive_dentist@test.com", "hash", "DENTIST", 1);
            INSERT INTO dentists (id, user_id, license_number, first_name, last_name, specialization, phone, is_active)
            VALUES (2, 31, "PRC-99999", "Inactive", "Doc", "General", "+639170000000", 0);
        ');

        // 6. Active Service (ID 1) - Cleaning, 30 min, 1500 PHP
        $this->pdo->exec('
            INSERT INTO services (id, name, price, duration_minutes, is_active)
            VALUES (1, "Teeth Cleaning", 1500.00, 30, 1);
        ');

        // 7. Inactive Service (ID 2)
        $this->pdo->exec('
            INSERT INTO services (id, name, price, duration_minutes, is_active)
            VALUES (2, "Inactive Service", 5000.00, 60, 0);
        ');

        // 8. Weekly shift for Dentist 1 on Mondays to Fridays (day 1 to 5) 09:00 to 17:00
        for ($d = 1; $d <= 5; $d++) {
            $this->pdo->exec("
                INSERT INTO dentist_schedules (dentist_id, day_of_week, start_time, end_time, operatory_chair, is_active)
                VALUES (1, {$d}, '09:00:00', '17:00:00', 'Chair 1', 1);
            ");
        }
    }

    public function testBookingFailsIfUserHasNoPatientProfile(): void
    {
        $this->expectException(HttpException::class);

        // User 99 is admin without patient profile
        $this->service->bookAppointment(99, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-20 09:00:00',
        ]);
    }

    public function testBookingFailsIfDentistIsInactive(): void
    {
        $this->expectException(HttpException::class);

        $this->service->bookAppointment(10, [
            'dentist_id' => 2, // Inactive dentist
            'service_id' => 1,
            'start_at' => '2026-11-20 09:00:00',
        ]);
    }

    public function testBookingFailsIfServiceIsInactive(): void
    {
        $this->expectException(HttpException::class);

        $this->service->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 2, // Inactive service
            'start_at' => '2026-11-20 09:00:00',
        ]);
    }

    public function testBookingFailsIfSlotIsOutsideOperatingHours(): void
    {
        // Sunday 2026-11-22 clinic is closed
        $simulatedNow = new DateTimeImmutable('2026-11-15 08:00:00', $this->tz);

        $this->expectException(HttpException::class);
        $this->service->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-22 10:00:00',
        ], $simulatedNow);
    }

    public function testBookingSucceedsAndCreatesAtomicRecords(): void
    {
        // Friday 2026-11-20 10:00:00 within shift
        $simulatedNow = new DateTimeImmutable('2026-11-15 08:00:00', $this->tz);

        $result = $this->service->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-20 10:00:00',
            'chief_complaint' => 'Routine scaling and tartar removal',
        ], $simulatedNow);

        $this->assertNotEmpty($result);
        $this->assertEquals(1, $result['patient_id']);
        $this->assertEquals(1, $result['dentist_id']);
        $this->assertEquals(1, $result['service_id']);
        $this->assertEquals('2026-11-20 10:00:00', $result['start_at']);
        $this->assertEquals('2026-11-20 10:30:00', $result['end_at']);
        $this->assertEquals(30, $result['duration_snapshot']);
        $this->assertEquals(1500.00, (float) $result['price_snapshot']);
        $this->assertEquals(AppointmentValidator::STATUS_PENDING, $result['status']);
        $this->assertEquals('Chair 1', $result['operatory_chair']);

        // Verify status history was created atomically
        $history = $this->appointmentRepo->getStatusHistory((int) $result['id']);
        $this->assertCount(1, $history);
        $this->assertNull($history[0]['old_status']);
        $this->assertEquals('PENDING', $history[0]['new_status']);
        $this->assertEquals(10, $history[0]['actor_user_id']);
    }

    public function testDoubleBookingForSameSlotIsPrevented(): void
    {
        $simulatedNow = new DateTimeImmutable('2026-11-15 08:00:00', $this->tz);

        // First patient books 10:00 to 10:30
        $this->service->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-20 10:00:00',
        ], $simulatedNow);

        // Second patient attempts booking same slot
        $this->expectException(HttpException::class);
        $this->service->bookAppointment(20, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-20 10:00:00',
        ], $simulatedNow);
    }

    public function testConfirmAppointmentSucceeds(): void
    {
        $simulatedNow = new DateTimeImmutable('2026-11-15 08:00:00', $this->tz);
        $appt = $this->service->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-20 11:00:00',
        ], $simulatedNow);

        $confirmed = $this->service->confirmAppointment(99, (int) $appt['id']);
        $this->assertEquals(AppointmentValidator::STATUS_CONFIRMED, $confirmed['status']);

        $history = $this->appointmentRepo->getStatusHistory((int) $appt['id']);
        $this->assertCount(2, $history);
        $this->assertEquals('PENDING', $history[1]['old_status']);
        $this->assertEquals('CONFIRMED', $history[1]['new_status']);
        $this->assertEquals(99, $history[1]['actor_user_id']);
    }

    public function testRejectAppointmentSucceedsWithReason(): void
    {
        $simulatedNow = new DateTimeImmutable('2026-11-15 08:00:00', $this->tz);
        $appt = $this->service->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-20 13:00:00',
        ], $simulatedNow);

        $rejected = $this->service->rejectAppointment(99, (int) $appt['id'], [
            'reason' => 'Emergency surgery scheduled',
        ]);

        $this->assertEquals(AppointmentValidator::STATUS_REJECTED, $rejected['status']);
        $history = $this->appointmentRepo->getStatusHistory((int) $appt['id']);
        $this->assertEquals('REJECTED', $history[1]['new_status']);
        $this->assertEquals('Emergency surgery scheduled', $history[1]['reason']);
    }

    public function testPatientCannotCancelAnotherPatientsAppointment(): void
    {
        $simulatedNow = new DateTimeImmutable('2026-11-15 08:00:00', $this->tz);
        $appt = $this->service->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-20 14:00:00',
        ], $simulatedNow);

        // User 20 tries to cancel User 10's appointment
        $this->expectException(HttpException::class);
        $this->service->cancelAppointment(20, 'PATIENT', (int) $appt['id'], [
            'reason' => 'Malicious cancel',
        ]);
    }

    public function testPatientCanCancelOwnAppointment(): void
    {
        $simulatedNow = new DateTimeImmutable('2026-11-15 08:00:00', $this->tz);
        $appt = $this->service->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-20 15:00:00',
        ], $simulatedNow);

        $cancelled = $this->service->cancelAppointment(10, 'PATIENT', (int) $appt['id'], [
            'reason' => 'Schedule conflict',
        ]);

        $this->assertEquals(AppointmentValidator::STATUS_CANCELLED, $cancelled['status']);
    }

    public function testCompleteAppointmentRequiresConfirmedStatus(): void
    {
        $simulatedNow = new DateTimeImmutable('2026-11-15 08:00:00', $this->tz);
        $appt = $this->service->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-20 16:00:00',
        ], $simulatedNow);

        // Cannot complete PENDING directly
        $this->expectException(HttpException::class);
        $this->service->completeAppointment(99, (int) $appt['id']);
    }

    public function testCompleteAppointmentSucceedsAfterConfirmation(): void
    {
        $simulatedNow = new DateTimeImmutable('2026-11-15 08:00:00', $this->tz);
        $appt = $this->service->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-20 16:00:00',
        ], $simulatedNow);

        $this->service->confirmAppointment(99, (int) $appt['id']);
        $completed = $this->service->completeAppointment(99, (int) $appt['id']);

        $this->assertEquals(AppointmentValidator::STATUS_COMPLETED, $completed['status']);
    }

    public function testRescheduleAtomicallyCancelsOldAndCreatesNew(): void
    {
        $simulatedNow = new DateTimeImmutable('2026-11-15 08:00:00', $this->tz);
        $oldAppt = $this->service->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-20 09:30:00',
        ], $simulatedNow);

        $newAppt = $this->service->rescheduleAppointment(10, 'PATIENT', (int) $oldAppt['id'], [
            'start_at' => '2026-11-20 11:30:00',
            'reason' => 'Need later morning time',
        ], $simulatedNow);

        $this->assertNotEquals($oldAppt['id'], $newAppt['id']);
        $this->assertEquals($oldAppt['id'], $newAppt['rescheduled_from_id']);
        $this->assertEquals('2026-11-20 11:30:00', $newAppt['start_at']);
        $this->assertEquals('PENDING', $newAppt['status']);

        // Check original was cancelled
        $updatedOld = $this->appointmentRepo->findById((int) $oldAppt['id']);
        $this->assertEquals('CANCELLED', $updatedOld['status']);
    }
}
