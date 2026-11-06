<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Database;
use App\Core\HttpException;
use App\Repositories\AppointmentRepository;
use App\Repositories\DentistRepository;
use App\Repositories\DentistScheduleRepository;
use App\Repositories\PatientRepository;
use App\Repositories\ServiceRepository;
use App\Repositories\UserRepository;
use App\Services\AppointmentService;
use App\Services\AvailabilityService;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Concurrency Test Suite for Double-Booking Prevention & Concurrency Safety
 * Simulates concurrent transactional requests using distinct database connections.
 */
class AppointmentConcurrencyTest extends TestCase
{
    private string $tempDbFile;
    private ?PDO $pdo1 = null;
    private ?PDO $pdo2 = null;
    private AppointmentService $serviceConn1;
    private AppointmentService $serviceConn2;
    private DateTimeZone $tz;

    protected function setUp(): void
    {
        $this->tz = new DateTimeZone('Asia/Manila');
        $this->tempDbFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'tc_concurrency_' . uniqid() . '.sqlite';

        // Initialize schema using Connection 1
        $this->pdo1 = new PDO('sqlite:' . $this->tempDbFile);
        $this->pdo1->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo1->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        $this->setupSchemaAndPolyfills($this->pdo1);

        // Connection 2 to the exact same database file
        $this->pdo2 = new PDO('sqlite:' . $this->tempDbFile);
        $this->pdo2->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo2->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        $this->setupSchemaAndPolyfills($this->pdo2);

        // Build Database wrappers
        $dbMock1 = $this->createStub(Database::class);
        $dbMock1->method('getConnection')->willReturn($this->pdo1);

        $dbMock2 = $this->createStub(Database::class);
        $dbMock2->method('getConnection')->willReturn($this->pdo2);

        $this->serviceConn1 = $this->createServiceWithDb($dbMock1);
        $this->serviceConn2 = $this->createServiceWithDb($dbMock2);

        $this->seedTestData($this->pdo1);
    }

    protected function tearDown(): void
    {
        $this->pdo1 = null;
        $this->pdo2 = null;
        if (file_exists($this->tempDbFile)) {
            @unlink($this->tempDbFile);
        }
    }

    private function setupSchemaAndPolyfills(PDO $pdo): void
    {
        if ($pdo instanceof \Pdo\Sqlite) {
            $pdo->createFunction('NOW', fn() => date('Y-m-d H:i:s'));
            $pdo->createFunction('UNIX_TIMESTAMP', fn(?string $d = null) => $d ? strtotime($d) : time());
            $pdo->createFunction('FROM_UNIXTIME', fn($ts) => date('Y-m-d H:i:s', (int) $ts));
        } elseif (method_exists($pdo, 'sqliteCreateFunction')) {
            @$pdo->sqliteCreateFunction('NOW', fn() => date('Y-m-d H:i:s'));
            @$pdo->sqliteCreateFunction('UNIX_TIMESTAMP', fn(?string $d = null) => $d ? strtotime($d) : time());
            @$pdo->sqliteCreateFunction('FROM_UNIXTIME', fn($ts) => date('Y-m-d H:i:s', (int) $ts));
        }

        $pdo->exec('
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT "PATIENT",
                is_active INTEGER NOT NULL DEFAULT 1,
                email_verified INTEGER NOT NULL DEFAULT 0,
                email_verified_at TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                date_of_birth TEXT NOT NULL,
                phone TEXT NOT NULL,
                gender TEXT NOT NULL DEFAULT "PREFER_NOT_TO_SAY",
                address TEXT NULL,
                emergency_contact_name TEXT NULL,
                emergency_contact_phone TEXT NULL,
                medical_alerts TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS dentists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                license_number TEXT NOT NULL UNIQUE,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                specialization TEXT NOT NULL,
                phone TEXT NOT NULL,
                default_operatory_chair TEXT NOT NULL DEFAULT "Chair 1",
                bio TEXT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS services (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                category TEXT NOT NULL DEFAULT "General",
                description TEXT NULL,
                price REAL NOT NULL,
                duration_minutes INTEGER NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS dentist_schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dentist_id INTEGER NOT NULL,
                day_of_week INTEGER NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                operatory_chair TEXT NOT NULL DEFAULT "Chair 1",
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS clinic_operating_hours (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                day_of_week INTEGER NOT NULL,
                opening_time TEXT NOT NULL DEFAULT "08:00:00",
                closing_time TEXT NOT NULL DEFAULT "17:00:00",
                is_closed INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS clinic_closures (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                start_at TEXT NOT NULL,
                end_at TEXT NOT NULL,
                closure_type TEXT NOT NULL DEFAULT "HOLIDAY",
                notes TEXT NULL,
                created_by_user_id INTEGER NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS dentist_time_off (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dentist_id INTEGER NOT NULL,
                start_at TEXT NOT NULL,
                end_at TEXT NOT NULL,
                reason TEXT NOT NULL,
                approved_by_user_id INTEGER NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                dentist_id INTEGER NOT NULL,
                service_id INTEGER NOT NULL,
                start_at TEXT NOT NULL,
                end_at TEXT NOT NULL,
                duration_snapshot INTEGER NOT NULL,
                price_snapshot REAL NOT NULL,
                status TEXT NOT NULL DEFAULT "PENDING",
                chief_complaint TEXT NULL,
                operatory_chair TEXT NOT NULL DEFAULT "Chair 1",
                rescheduled_from_id INTEGER NULL,
                cancellation_reason TEXT NULL,
                cancelled_by_user_id INTEGER NULL,
                cancelled_at TEXT NULL,
                reviewed_by_user_id INTEGER NULL,
                reviewed_at TEXT NULL,
                completed_at TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS appointment_status_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                appointment_id INTEGER NOT NULL,
                old_status TEXT NULL,
                new_status TEXT NOT NULL,
                actor_user_id INTEGER NULL,
                reason TEXT NULL,
                metadata TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                actor_user_id INTEGER NULL,
                action TEXT NOT NULL,
                target_type TEXT NOT NULL,
                target_id INTEGER NULL,
                ip_address TEXT NULL,
                user_agent TEXT NULL,
                sanitized_payload TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS email_outbox (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NULL,
                recipient_email TEXT NOT NULL,
                recipient_name TEXT NOT NULL,
                subject TEXT NOT NULL,
                body_html TEXT NOT NULL,
                body_text TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT "PENDING",
                attempts INTEGER NOT NULL DEFAULT 0,
                max_attempts INTEGER NOT NULL DEFAULT 5,
                last_error TEXT NULL,
                next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                sent_at TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            INSERT INTO clinic_operating_hours (day_of_week, opening_time, closing_time, is_closed) VALUES
            (1, "08:00:00", "17:00:00", 0),
            (2, "08:00:00", "17:00:00", 0),
            (3, "08:00:00", "17:00:00", 0),
            (4, "08:00:00", "17:00:00", 0),
            (5, "08:00:00", "17:00:00", 0),
            (6, "08:00:00", "12:00:00", 0),
            (7, "08:00:00", "17:00:00", 1);
        ');
    }

    private function createServiceWithDb(Database $db): AppointmentService
    {
        $appRepo = new AppointmentRepository($db);
        $patientRepo = new PatientRepository($db);
        $dentistRepo = new DentistRepository($db);
        $serviceRepo = new ServiceRepository($db);
        $userRepo = new UserRepository($db);

        $availService = new AvailabilityService(
            $dentistRepo,
            $serviceRepo,
            null,
            null,
            null,
            $appRepo,
            $db
        );

        return new AppointmentService(
            $appRepo,
            $patientRepo,
            $dentistRepo,
            $serviceRepo,
            $userRepo,
            $availService,
            null,
            null,
            null,
            $db
        );
    }

    private function seedTestData(PDO $pdo): void
    {
        // Patient 1 (User 10)
        $pdo->exec('
            INSERT INTO users (id, email, password_hash, role) VALUES (10, "p1@test.com", "h", "PATIENT");
            INSERT INTO patients (id, user_id, first_name, last_name, date_of_birth, phone) VALUES (1, 10, "P1", "Test", "1990-01-01", "09171");
        ');

        // Patient 2 (User 20)
        $pdo->exec('
            INSERT INTO users (id, email, password_hash, role) VALUES (20, "p2@test.com", "h", "PATIENT");
            INSERT INTO patients (id, user_id, first_name, last_name, date_of_birth, phone) VALUES (2, 20, "P2", "Test", "1992-01-01", "09172");
        ');

        // Dentist 1 (ID 1)
        $pdo->exec('
            INSERT INTO users (id, email, password_hash, role) VALUES (30, "d1@test.com", "h", "DENTIST");
            INSERT INTO dentists (id, user_id, license_number, first_name, last_name, specialization, phone, is_active)
            VALUES (1, 30, "PRC-1", "Doc", "One", "General", "09173", 1);
        ');

        // Dentist 2 (ID 2)
        $pdo->exec('
            INSERT INTO users (id, email, password_hash, role) VALUES (31, "d2@test.com", "h", "DENTIST");
            INSERT INTO dentists (id, user_id, license_number, first_name, last_name, specialization, phone, is_active)
            VALUES (2, 31, "PRC-2", "Doc", "Two", "Orthodontics", "09174", 1);
        ');

        // Service 1: 30 minutes
        $pdo->exec('
            INSERT INTO services (id, name, price, duration_minutes, is_active) VALUES (1, "Quick Clean", 1000, 30, 1);
        ');

        // Service 2: 60 minutes
        $pdo->exec('
            INSERT INTO services (id, name, price, duration_minutes, is_active) VALUES (2, "Deep Root Canal", 5000, 60, 1);
        ');

        // Weekly shifts for Dentist 1 & Dentist 2 on Day 1 (Monday) 08:00 - 17:00
        $pdo->exec('
            INSERT INTO dentist_schedules (dentist_id, day_of_week, start_time, end_time, operatory_chair, is_active)
            VALUES (1, 1, "08:00:00", "17:00:00", "Chair 1", 1);
            INSERT INTO dentist_schedules (dentist_id, day_of_week, start_time, end_time, operatory_chair, is_active)
            VALUES (2, 1, "08:00:00", "17:00:00", "Chair 2", 1);
        ');
    }

    public function testConcurrentOverlappingRequestsOnlyOneSucceeds(): void
    {
        // Monday 2026-11-23 09:00:00
        $simulatedNow = new DateTimeImmutable('2026-11-15 08:00:00', $this->tz);

        // Connection 1: Patient 1 books 09:00:00
        $appt1 = $this->serviceConn1->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-23 09:00:00',
        ], $simulatedNow);

        $this->assertNotEmpty($appt1);
        $this->assertSame('PENDING', $appt1['status']);

        // Connection 2: Patient 2 attempts booking same dentist & same time
        $conflictThrown = false;
        try {
            $this->serviceConn2->bookAppointment(20, [
                'dentist_id' => 1,
                'service_id' => 1,
                'start_at' => '2026-11-23 09:00:00',
            ], $simulatedNow);
        } catch (HttpException $e) {
            $this->assertSame(409, $e->getStatusCode());
            $conflictThrown = true;
        }

        $this->assertTrue($conflictThrown, 'Second overlapping booking request must throw 409 Conflict.');

        // Verify that exactly ONE appointment exists in the database
        $stmt = $this->pdo1->query('SELECT COUNT(*) FROM appointments');
        $totalAppointments = (int) $stmt->fetchColumn();
        $this->assertSame(1, $totalAppointments);

        // Verify that exactly ONE status history record exists
        $stmtHistory = $this->pdo1->query('SELECT COUNT(*) FROM appointment_status_history');
        $totalHistory = (int) $stmtHistory->fetchColumn();
        $this->assertSame(1, $totalHistory);
    }

    public function testConcurrentNonOverlappingAppointmentsForSameDentistBothSucceed(): void
    {
        $simulatedNow = new DateTimeImmutable('2026-11-15 08:00:00', $this->tz);

        // Conn 1: Patient 1 books 09:00 to 09:30 (+10m buffer = 09:40)
        $appt1 = $this->serviceConn1->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-23 09:00:00',
        ], $simulatedNow);

        // Conn 2: Patient 2 books 10:00 to 10:30 (Non-overlapping, safely after buffer)
        $appt2 = $this->serviceConn2->bookAppointment(20, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-23 10:00:00',
        ], $simulatedNow);

        $this->assertNotEmpty($appt1);
        $this->assertNotEmpty($appt2);
        $this->assertNotSame($appt1['id'], $appt2['id']);

        $stmt = $this->pdo1->query('SELECT COUNT(*) FROM appointments');
        $this->assertSame(2, (int) $stmt->fetchColumn());
    }

    public function testOverlappingAppointmentsForDifferentDentistsBothSucceed(): void
    {
        $simulatedNow = new DateTimeImmutable('2026-11-15 08:00:00', $this->tz);

        // Conn 1: Patient 1 books Dentist 1 at 09:00
        $appt1 = $this->serviceConn1->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-23 09:00:00',
        ], $simulatedNow);

        // Conn 2: Patient 2 books Dentist 2 at 09:00 (Same time, different dentist)
        $appt2 = $this->serviceConn2->bookAppointment(20, [
            'dentist_id' => 2,
            'service_id' => 1,
            'start_at' => '2026-11-23 09:00:00',
        ], $simulatedNow);

        $this->assertNotEmpty($appt1);
        $this->assertNotEmpty($appt2);
        $this->assertSame(1, (int) $appt1['dentist_id']);
        $this->assertSame(2, (int) $appt2['dentist_id']);

        $stmt = $this->pdo1->query('SELECT COUNT(*) FROM appointments');
        $this->assertSame(2, (int) $stmt->fetchColumn());
    }

    public function testBufferTimeConflictIsRejected(): void
    {
        $simulatedNow = new DateTimeImmutable('2026-11-15 08:00:00', $this->tz);

        // Service 1 is 30 mins: Patient 1 has 09:00 to 09:30
        $this->serviceConn1->bookAppointment(10, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-23 09:00:00',
        ], $simulatedNow);

        // Patient 2 attempts booking a 30m slot at 08:45:00
        // Service runs 08:45 to 09:15, with 10m buffer blocking until 09:25:00, overlapping 09:00:00
        $this->expectException(HttpException::class);
        $this->serviceConn2->bookAppointment(20, [
            'dentist_id' => 1,
            'service_id' => 1,
            'start_at' => '2026-11-23 08:45:00',
        ], $simulatedNow);
    }
}
