<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\Database;
use App\Core\HttpException;
use App\Repositories\AppointmentRepository;
use App\Repositories\AuditLogRepository;
use App\Repositories\DentistRepository;
use App\Repositories\PatientRepository;
use App\Repositories\TreatmentRecordRepository;
use App\Services\TreatmentRecordService;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

class TreatmentRecordServiceTest extends TestCase
{
    private Database $database;
    private TreatmentRecordService $service;
    private int $dentistAUserId;
    private int $dentistAId;
    private int $dentistBUserId;
    private int $dentistBId;
    private int $patientId;
    private int $confirmedAppointmentId;
    private int $pendingAppointmentId;

    protected function setUp(): void
    {
        $pdo = TestDb::create();
        $this->database = new Database();
        $this->database->setConnection($pdo);

        // Seed Dentist A
        $stmt = $pdo->prepare('INSERT INTO users (email, password_hash, role, is_active) VALUES (?, "hash", "DENTIST", 1)');
        $stmt->execute(['dr.santos@toothcare.local']);
        $this->dentistAUserId = (int) $pdo->lastInsertId();

        $stmt = $pdo->prepare('INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone, default_operatory_chair, is_active) VALUES (?, "Maria", "Santos", "General & Cosmetic Dentistry", "PRC-0042189", "09171112222", "Chair 1", 1)');
        $stmt->execute([$this->dentistAUserId]);
        $this->dentistAId = (int) $pdo->lastInsertId();

        // Seed Dentist B
        $stmt = $pdo->prepare('INSERT INTO users (email, password_hash, role, is_active) VALUES (?, "hash", "DENTIST", 1)');
        $stmt->execute(['dr.reyes@toothcare.local']);
        $this->dentistBUserId = (int) $pdo->lastInsertId();

        $stmt = $pdo->prepare('INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone, default_operatory_chair, is_active) VALUES (?, "Roberto", "Reyes", "Orthodontics", "PRC-0051280", "09173334444", "Chair 2", 1)');
        $stmt->execute([$this->dentistBUserId]);
        $this->dentistBId = (int) $pdo->lastInsertId();

        // Seed Patient
        $stmt = $pdo->prepare('INSERT INTO users (email, password_hash, role, is_active) VALUES (?, "hash", "PATIENT", 1)');
        $stmt->execute(['juan@example.com']);
        $patientUserId = (int) $pdo->lastInsertId();

        $stmt = $pdo->prepare('INSERT INTO patients (user_id, first_name, last_name, date_of_birth, phone, medical_alerts) VALUES (?, "Juan", "Dela Cruz", "1990-01-01", "09171234567", "Penicillin allergy")');
        $stmt->execute([$patientUserId]);
        $this->patientId = (int) $pdo->lastInsertId();

        // Seed Service
        $stmt = $pdo->prepare('INSERT INTO services (name, description, duration_minutes, price, is_active) VALUES ("Dental Cleaning", "Prophylaxis", 45, 1500.00, 1)');
        $stmt->execute();
        $serviceId = (int) $pdo->lastInsertId();

        // Seed Confirmed Appointment assigned to Dentist A
        $stmt = $pdo->prepare('INSERT INTO appointments (patient_id, dentist_id, service_id, start_at, end_at, duration_snapshot, price_snapshot, status, operatory_chair) VALUES (?, ?, ?, "2026-11-15 10:00:00", "2026-11-15 10:45:00", 45, 1500.00, "CONFIRMED", "Chair 1")');
        $stmt->execute([$this->patientId, $this->dentistAId, $serviceId]);
        $this->confirmedAppointmentId = (int) $pdo->lastInsertId();

        // Seed Pending Appointment assigned to Dentist A
        $stmt = $pdo->prepare('INSERT INTO appointments (patient_id, dentist_id, service_id, start_at, end_at, duration_snapshot, price_snapshot, status, operatory_chair) VALUES (?, ?, ?, "2026-11-16 14:00:00", "2026-11-16 14:45:00", 45, 1500.00, "PENDING", "Chair 1")');
        $stmt->execute([$this->patientId, $this->dentistAId, $serviceId]);
        $this->pendingAppointmentId = (int) $pdo->lastInsertId();

        $treatmentRepo = new TreatmentRecordRepository($this->database);
        $appointmentRepo = new AppointmentRepository($this->database);
        $dentistRepo = new DentistRepository($this->database);
        $auditRepo = new AuditLogRepository($this->database);

        $this->service = new TreatmentRecordService(
            $treatmentRepo,
            $appointmentRepo,
            $dentistRepo,
            $auditRepo,
            $this->database
        );
    }

    public function testCreateTreatmentRecordSuccess(): void
    {
        $payload = [
            'appointment_id' => $this->confirmedAppointmentId,
            'diagnosis' => 'Generalized moderate gingivitis, mild supragingival calculus formation.',
            'procedure_notes' => 'Full-mouth ultrasonic scaling and polishing performed using prophylactic paste. No bleeding upon probing.',
            'prescription_notes' => 'Chlorhexidine 0.12% oral rinse 15ml BID x 7 days.',
            'home_care_advice' => 'Floss daily before bedtime, maintain soft-bristle toothbrushing twice daily.',
            'teeth_treated' => [11, 12, 21, 22, 31, 41],
        ];

        $record = $this->service->createRecord($this->dentistAUserId, 'DENTIST', $payload);

        $this->assertNotEmpty($record['id']);
        $this->assertSame($this->confirmedAppointmentId, (int) $record['appointment_id']);
        $this->assertSame($this->dentistAId, (int) $record['dentist_id']);
        $this->assertSame($this->patientId, (int) $record['patient_id']);
        $this->assertFalse($record['is_locked']);
        $this->assertContains(11, $record['teeth_treated']);
    }

    public function testCreateTreatmentRecordRejectsUnauthorizedDentist(): void
    {
        $payload = [
            'appointment_id' => $this->confirmedAppointmentId,
            'diagnosis' => 'Gingivitis',
            'procedure_notes' => 'Dental scaling completed.',
        ];

        // Dentist B attempts to author record for Dentist A's appointment
        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('You can only author treatment records for appointments assigned to you.');

        $this->service->createRecord($this->dentistBUserId, 'DENTIST', $payload);
    }

    public function testCreateTreatmentRecordRejectsPendingStatus(): void
    {
        $payload = [
            'appointment_id' => $this->pendingAppointmentId,
            'diagnosis' => 'Tooth cavity',
            'procedure_notes' => 'Dental filling',
        ];

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Treatment records can only be created for confirmed or completed appointments');

        $this->service->createRecord($this->dentistAUserId, 'DENTIST', $payload);
    }

    public function testCreateTreatmentRecordPreventsDuplicates(): void
    {
        $payload = [
            'appointment_id' => $this->confirmedAppointmentId,
            'diagnosis' => 'Gingivitis assessment',
            'procedure_notes' => 'Ultrasonic scaling procedure completed successfully.',
        ];

        // First creation succeeds
        $this->service->createRecord($this->dentistAUserId, 'DENTIST', $payload);

        // Second creation for same appointment must throw conflict
        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('A treatment record already exists for appointment #' . $this->confirmedAppointmentId);

        $this->service->createRecord($this->dentistAUserId, 'DENTIST', $payload);
    }

    public function testUpdateTreatmentRecordWithin24hWindow(): void
    {
        $payload = [
            'appointment_id' => $this->confirmedAppointmentId,
            'diagnosis' => 'Initial diagnosis',
            'procedure_notes' => 'Initial procedure notes',
        ];

        $created = $this->service->createRecord($this->dentistAUserId, 'DENTIST', $payload);
        $recordId = (int) $created['id'];

        $updatePayload = [
            'diagnosis' => 'Amended diagnosis with periodontal evaluation',
            'procedure_notes' => 'Updated procedure notes including fluoride varnish application',
        ];

        $updated = $this->service->updateRecord($this->dentistAUserId, 'DENTIST', $recordId, $updatePayload);

        $this->assertSame('Amended diagnosis with periodontal evaluation', $updated['diagnosis']);
        $this->assertSame('Updated procedure notes including fluoride varnish application', $updated['procedure_notes']);
    }

    public function testUpdateTreatmentRecordRejectsLockedRecord(): void
    {
        $payload = [
            'appointment_id' => $this->confirmedAppointmentId,
            'diagnosis' => 'Initial diagnosis',
            'procedure_notes' => 'Initial procedure notes',
        ];

        $created = $this->service->createRecord($this->dentistAUserId, 'DENTIST', $payload);
        $recordId = (int) $created['id'];

        // Force record into locked state (simulate 24 hours elapsed)
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('UPDATE treatment_records SET locked_at = "2020-01-01 00:00:00" WHERE id = ?');
        $stmt->execute([$recordId]);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('permanently locked');

        $this->service->updateRecord($this->dentistAUserId, 'DENTIST', $recordId, [
            'diagnosis' => 'Attempted edit after locked period',
        ]);
    }

    public function testUpdateTreatmentRecordRejectsOtherDentist(): void
    {
        $payload = [
            'appointment_id' => $this->confirmedAppointmentId,
            'diagnosis' => 'Initial diagnosis',
            'procedure_notes' => 'Initial procedure notes',
        ];

        $created = $this->service->createRecord($this->dentistAUserId, 'DENTIST', $payload);
        $recordId = (int) $created['id'];

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('You are only authorized to edit your own authored treatment records.');

        $this->service->updateRecord($this->dentistBUserId, 'DENTIST', $recordId, [
            'diagnosis' => 'Tampered diagnosis by Dentist B',
        ]);
    }
}
