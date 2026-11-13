<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Logger;
use App\Repositories\AppointmentRepository;
use App\Repositories\AuditLogRepository;
use App\Repositories\DentistRepository;
use App\Repositories\TreatmentRecordRepository;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use Throwable;

/**
 * Treatment Record Service
 * Authoring, updating within 24h compliance window, clinical ownership validation, and audit logging.
 */
class TreatmentRecordService
{
    private TreatmentRecordRepository $treatmentRepo;
    private AppointmentRepository $appointmentRepo;
    private DentistRepository $dentistRepo;
    private AuditLogRepository $auditRepo;
    private Database $database;
    private Logger $logger;

    public function __construct(
        ?TreatmentRecordRepository $treatmentRepo = null,
        ?AppointmentRepository $appointmentRepo = null,
        ?DentistRepository $dentistRepo = null,
        ?AuditLogRepository $auditRepo = null,
        ?Database $database = null,
        ?Logger $logger = null
    ) {
        $this->database = $database ?? Database::getInstance();
        $this->treatmentRepo = $treatmentRepo ?? new TreatmentRecordRepository($this->database);
        $this->appointmentRepo = $appointmentRepo ?? new AppointmentRepository($this->database);
        $this->dentistRepo = $dentistRepo ?? new DentistRepository($this->database);
        $this->auditRepo = $auditRepo ?? new AuditLogRepository($this->database);
        $this->logger = $logger ?? Logger::getInstance();
    }

    /**
     * Create a treatment record for an eligible, assigned appointment.
     *
     * @param int $userId Authenticated user ID
     * @param string $userRole Authenticated user role ('DENTIST' or 'ADMIN')
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     * @throws HttpException
     */
    public function createRecord(int $userId, string $userRole, array $data): array
    {
        $appointmentId = (int) ($data['appointment_id'] ?? 0);
        if ($appointmentId <= 0) {
            throw HttpException::badRequest('Valid appointment_id is required.');
        }

        $appointment = $this->appointmentRepo->findById($appointmentId);
        if (!$appointment) {
            throw HttpException::notFound('Appointment #' . $appointmentId . ' was not found.');
        }

        // Ownership enforcement for DENTIST role
        $dentist = null;
        if (strtoupper($userRole) === 'DENTIST') {
            $dentist = $this->dentistRepo->findByUserId($userId);
            if (!$dentist) {
                throw HttpException::forbidden('Your account is not linked to a licensed dentist profile.');
            }
            if ((int) $appointment['dentist_id'] !== (int) $dentist['id']) {
                $this->auditRepo->record(
                    'UNAUTHORIZED_TREATMENT_RECORD_ATTEMPT',
                    'appointment',
                    $appointmentId,
                    $userId,
                    null,
                    null,
                    ['reason' => 'Dentist attempted to author record for another clinician\'s appointment']
                );
                throw HttpException::forbidden('You can only author treatment records for appointments assigned to you.');
            }
        } else {
            // Admin role: resolve dentist from the appointment
            $dentist = $this->dentistRepo->findById((int) $appointment['dentist_id']);
            if (!$dentist) {
                throw HttpException::badRequest('Assigned dentist for this appointment no longer exists.');
            }
        }

        // Status eligibility check: appointment must be CONFIRMED or COMPLETED
        $validStatuses = ['CONFIRMED', 'COMPLETED'];
        if (!in_array(strtoupper((string) $appointment['status']), $validStatuses, true)) {
            throw HttpException::conflict(
                "Treatment records can only be created for confirmed or completed appointments. Current status: {$appointment['status']}."
            );
        }

        // Uniqueness check: only 1 treatment record per appointment
        $existing = $this->treatmentRepo->findByAppointmentId($appointmentId);
        if ($existing !== null) {
            throw HttpException::conflict("A treatment record already exists for appointment #{$appointmentId}.");
        }

        // Validation
        $validated = $this->validateRecordInput($data);

        $pdo = $this->database->getConnection();
        $pdo->beginTransaction();

        try {
            $recordId = $this->treatmentRepo->create([
                'appointment_id' => $appointmentId,
                'dentist_id' => (int) $dentist['id'],
                'patient_id' => (int) $appointment['patient_id'],
                'teeth_treated' => $validated['teeth_treated'],
                'diagnosis' => $validated['diagnosis'],
                'procedure_notes' => $validated['procedure_notes'],
                'prescription_notes' => $validated['prescription_notes'],
                'home_care_advice' => $validated['home_care_advice'],
            ], $pdo);

            $this->auditRepo->record(
                'TREATMENT_RECORD_CREATED',
                'treatment_record',
                $recordId,
                $userId,
                null,
                null,
                [
                    'appointment_id' => $appointmentId,
                    'patient_id' => (int) $appointment['patient_id'],
                    'dentist_id' => (int) $dentist['id'],
                ]
            );

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($e instanceof HttpException) {
                throw $e;
            }
            $this->logger->error('Treatment record creation error: ' . $e->getMessage(), [
                'appointment_id' => $appointmentId,
            ]);
            throw HttpException::badRequest('Failed to persist treatment record. Please review inputs.');
        }

        $created = $this->treatmentRepo->findById($recordId);
        return $created ?? ['id' => $recordId];
    }

    /**
     * Update an existing treatment record within the 24-hour edit window.
     *
     * @param int $userId Authenticated user ID
     * @param string $userRole Authenticated user role
     * @param int $id Treatment record ID
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     * @throws HttpException
     */
    public function updateRecord(int $userId, string $userRole, int $id, array $data): array
    {
        $record = $this->treatmentRepo->findById($id);
        if (!$record) {
            throw HttpException::notFound("Treatment record #{$id} was not found.");
        }

        // Ownership enforcement for DENTIST
        if (strtoupper($userRole) === 'DENTIST') {
            $dentist = $this->dentistRepo->findByUserId($userId);
            if (!$dentist || (int) $record['dentist_id'] !== (int) $dentist['id']) {
                $this->auditRepo->record(
                    'UNAUTHORIZED_TREATMENT_UPDATE_ATTEMPT',
                    'treatment_record',
                    $id,
                    $userId,
                    null,
                    null,
                    ['reason' => 'Dentist attempted to update another practitioner\'s clinical record']
                );
                throw HttpException::forbidden('You are only authorized to edit your own authored treatment records.');
            }
        }

        // Lock enforcement: 24h compliance window
        if (!empty($record['is_locked'])) {
            throw HttpException::conflict(
                'This treatment record is permanently locked (24-hour edit window elapsed) and cannot be modified.',
                'RECORD_LOCKED'
            );
        }

        // Validate updated fields
        $validated = $this->validateRecordInput($data, true);

        $pdo = $this->database->getConnection();
        $pdo->beginTransaction();

        try {
            $this->treatmentRepo->update($id, $validated, $pdo);

            $this->auditRepo->record(
                'TREATMENT_RECORD_UPDATED',
                'treatment_record',
                $id,
                $userId,
                null,
                null,
                [
                    'appointment_id' => $record['appointment_id'],
                    'patient_id' => $record['patient_id'],
                ]
            );

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($e instanceof HttpException) {
                throw $e;
            }
            $this->logger->error('Treatment record update failed: ' . $e->getMessage(), ['id' => $id]);
            throw HttpException::badRequest('Failed to update clinical treatment record.');
        }

        return $this->treatmentRepo->findById($id) ?? [];
    }

    /**
     * Retrieve treatment record with ownership enforcement.
     *
     * @param int $userId Authenticated user ID
     * @param string $userRole Authenticated user role
     * @param int $id Treatment record ID
     * @return array<string, mixed>
     * @throws HttpException
     */
    public function getRecord(int $userId, string $userRole, int $id): array
    {
        $record = $this->treatmentRepo->findById($id);
        if (!$record) {
            throw HttpException::notFound("Treatment record #{$id} was not found.");
        }

        $this->enforceRecordAccess($userId, $userRole, $record);

        return $record;
    }

    /**
     * Retrieve treatment record for an appointment with ownership enforcement.
     *
     * @param int $userId Authenticated user ID
     * @param string $userRole Authenticated user role
     * @param int $appointmentId Appointment ID
     * @return array<string, mixed>|null
     * @throws HttpException
     */
    public function getRecordByAppointment(int $userId, string $userRole, int $appointmentId): ?array
    {
        $appointment = $this->appointmentRepo->findById($appointmentId);
        if (!$appointment) {
            throw HttpException::notFound("Appointment #{$appointmentId} was not found.");
        }

        // Ownership check on the appointment
        if (strtoupper($userRole) === 'DENTIST') {
            $dentist = $this->dentistRepo->findByUserId($userId);
            if (!$dentist || (int) $appointment['dentist_id'] !== (int) $dentist['id']) {
                throw HttpException::forbidden('You are not authorized to view clinical records for this appointment.');
            }
        } elseif (strtoupper($userRole) === 'PATIENT') {
            // Patient viewing their own appointment
            if ((int) ($appointment['patient_user_id'] ?? 0) !== $userId) {
                throw HttpException::forbidden('Access denied to clinical treatment records.');
            }
        }

        return $this->treatmentRepo->findByAppointmentId($appointmentId);
    }

    /**
     * List treatment records authored by the authenticated dentist.
     *
     * @return array{items: list<array<string, mixed>>, total: int, page: int, per_page: int, total_pages: int}
     * @throws HttpException
     */
    public function listDentistRecords(int $userId, string $userRole, int $page = 1, int $perPage = 20): array
    {
        if (strtoupper($userRole) === 'DENTIST') {
            $dentist = $this->dentistRepo->findByUserId($userId);
            if (!$dentist) {
                return ['items' => [], 'total' => 0, 'page' => 1, 'per_page' => $perPage, 'total_pages' => 1];
            }
            return $this->treatmentRepo->findByDentistId((int) $dentist['id'], $page, $perPage);
        }

        if (strtoupper($userRole) === 'ADMIN') {
            // Admin default view: all treatment records if queried or specific dentist
            return $this->treatmentRepo->findByDentistId(0, $page, $perPage);
        }

        throw HttpException::forbidden('Unauthorized access to clinical treatment records.');
    }

    /**
     * Enforce role-based and ownership access to a specific treatment record.
     *
     * @param array<string, mixed> $record
     * @throws HttpException
     */
    private function enforceRecordAccess(int $userId, string $userRole, array $record): void
    {
        $role = strtoupper($userRole);
        if ($role === 'ADMIN') {
            return;
        }

        if ($role === 'DENTIST') {
            $dentist = $this->dentistRepo->findByUserId($userId);
            if (!$dentist || (int) $record['dentist_id'] !== (int) $dentist['id']) {
                $this->auditRepo->record(
                    'UNAUTHORIZED_TREATMENT_RECORD_VIEW_ATTEMPT',
                    'treatment_record',
                    (int) $record['id'],
                    $userId,
                    null,
                    null,
                    ['reason' => 'Dentist attempted to access another dentist\'s treatment record']
                );
                throw HttpException::forbidden('You are not authorized to view treatment records authored by another practitioner.');
            }
            return;
        }

        throw HttpException::forbidden('Unauthorized access to clinical treatment documentation.');
    }

    /**
     * Validate and sanitize clinical inputs.
     *
     * @param array<string, mixed> $data
     * @param bool $isUpdate
     * @return array<string, mixed>
     * @throws HttpException
     */
    private function validateRecordInput(array $data, bool $isUpdate = false): array
    {
        $errors = [];
        $sanitized = [];

        // 1. Diagnosis
        if (!$isUpdate || array_key_exists('diagnosis', $data)) {
            $diagnosis = trim((string) ($data['diagnosis'] ?? ''));
            if ($diagnosis === '') {
                $errors['diagnosis'] = 'Clinical diagnosis is required.';
            } elseif (mb_strlen($diagnosis) < 3) {
                $errors['diagnosis'] = 'Diagnosis must be at least 3 characters.';
            } elseif (mb_strlen($diagnosis) > 2000) {
                $errors['diagnosis'] = 'Diagnosis must not exceed 2000 characters.';
            }
            $sanitized['diagnosis'] = $diagnosis;
        }

        // 2. Procedure Notes
        if (!$isUpdate || array_key_exists('procedure_notes', $data)) {
            $notes = trim((string) ($data['procedure_notes'] ?? ''));
            if ($notes === '') {
                $errors['procedure_notes'] = 'Procedure and treatment notes are required.';
            } elseif (mb_strlen($notes) < 5) {
                $errors['procedure_notes'] = 'Procedure notes must be at least 5 characters.';
            } elseif (mb_strlen($notes) > 5000) {
                $errors['procedure_notes'] = 'Procedure notes must not exceed 5000 characters.';
            }
            $sanitized['procedure_notes'] = $notes;
        }

        // 3. Prescription Notes (optional)
        if (array_key_exists('prescription_notes', $data)) {
            $rx = trim((string) ($data['prescription_notes'] ?? ''));
            if (mb_strlen($rx) > 2000) {
                $errors['prescription_notes'] = 'Prescription notes must not exceed 2000 characters.';
            }
            $sanitized['prescription_notes'] = $rx !== '' ? $rx : null;
        } elseif (!$isUpdate) {
            $sanitized['prescription_notes'] = null;
        }

        // 4. Home Care Advice (optional)
        if (array_key_exists('home_care_advice', $data)) {
            $advice = trim((string) ($data['home_care_advice'] ?? ''));
            if (mb_strlen($advice) > 2000) {
                $errors['home_care_advice'] = 'Home care advice must not exceed 2000 characters.';
            }
            $sanitized['home_care_advice'] = $advice !== '' ? $advice : null;
        } elseif (!$isUpdate) {
            $sanitized['home_care_advice'] = null;
        }

        // 5. Teeth Treated (array of valid FDI two-digit notation numbers)
        if (array_key_exists('teeth_treated', $data)) {
            $teeth = $data['teeth_treated'];
            if ($teeth !== null && !is_array($teeth)) {
                $errors['teeth_treated'] = 'Teeth treated must be an array of FDI tooth numbers.';
            } elseif (is_array($teeth)) {
                $validTeeth = [];
                foreach ($teeth as $tooth) {
                    $t = (int) $tooth;
                    if ($t >= 11 && $t <= 85) {
                        $validTeeth[] = $t;
                    }
                }
                $sanitized['teeth_treated'] = array_values(array_unique($validTeeth));
            } else {
                $sanitized['teeth_treated'] = [];
            }
        } elseif (!$isUpdate) {
            $sanitized['teeth_treated'] = [];
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Validation failed for clinical documentation.', $errors);
        }

        return $sanitized;
    }
}
