<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Logger;
use App\Repositories\AppointmentRepository;
use App\Repositories\AttendanceRepository;
use App\Repositories\AuditLogRepository;
use App\Repositories\DentistRepository;
use App\Repositories\PatientRepository;
use App\Repositories\ServiceRepository;
use App\Repositories\UserRepository;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use Throwable;

/**
 * Receptionist Service
 * Front desk operations: daily schedules, arrival check-ins, waiting lists,
 * walk-in patient registration, and appointment triage management.
 */
class ReceptionistService
{
    private Database $database;
    private AppointmentRepository $appointmentRepo;
    private AttendanceRepository $attendanceRepo;
    private PatientRepository $patientRepo;
    private DentistRepository $dentistRepo;
    private ServiceRepository $serviceRepo;
    private UserRepository $userRepo;
    private AvailabilityService $availabilityService;
    private AuditLogRepository $auditRepo;
    private Logger $logger;
    private DateTimeZone $timezone;

    public function __construct(
        ?Database $database = null,
        ?AppointmentRepository $appointmentRepo = null,
        ?AttendanceRepository $attendanceRepo = null,
        ?PatientRepository $patientRepo = null,
        ?DentistRepository $dentistRepo = null,
        ?ServiceRepository $serviceRepo = null,
        ?UserRepository $userRepo = null,
        ?AvailabilityService $availabilityService = null,
        ?AuditLogRepository $auditRepo = null,
        ?Logger $logger = null
    ) {
        $this->database = $database ?? Database::getInstance();
        $this->appointmentRepo = $appointmentRepo ?? new AppointmentRepository($this->database);
        $this->attendanceRepo = $attendanceRepo ?? new AttendanceRepository($this->database);
        $this->patientRepo = $patientRepo ?? new PatientRepository($this->database);
        $this->dentistRepo = $dentistRepo ?? new DentistRepository($this->database);
        $this->serviceRepo = $serviceRepo ?? new ServiceRepository($this->database);
        $this->userRepo = $userRepo ?? new UserRepository($this->database);
        $this->availabilityService = $availabilityService ?? new AvailabilityService(
            $this->dentistRepo,
            $this->serviceRepo,
            null,
            null,
            null,
            $this->appointmentRepo,
            $this->database
        );
        $this->auditRepo = $auditRepo ?? new AuditLogRepository($this->database);
        $this->logger = $logger ?? Logger::getInstance();
        $this->timezone = new DateTimeZone('Asia/Manila');
    }

    /**
     * Get front desk overview summary with Asia/Manila clock, operational KPIs,
     * today's appointments, waiting list, and review queue.
     *
     * @return array<string, mixed>
     */
    public function getDashboardSummary(): array
    {
        $now = new DateTimeImmutable('now', $this->timezone);
        $todayDate = $now->format('Y-m-d');
        $clinicTimeStr = $now->format('l, F j, Y, g:i A \P\S\T');

        $pdo = $this->database->getConnection();

        // 1. Operational Counts
        $countStmt = $pdo->prepare('
            SELECT 
                COUNT(*) AS today_total,
                SUM(CASE WHEN status = "CONFIRMED" THEN 1 ELSE 0 END) AS confirmed_today,
                SUM(CASE WHEN status = "COMPLETED" THEN 1 ELSE 0 END) AS completed_today,
                SUM(CASE WHEN status = "CANCELLED" THEN 1 ELSE 0 END) AS cancelled_today
            FROM appointments
            WHERE DATE(start_at) = ?
        ');
        $countStmt->execute([$todayDate]);
        $apptCounts = $countStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        // Global pending review count
        $pendingStmt = $pdo->query('SELECT COUNT(*) as total FROM appointments WHERE status = "PENDING"');
        $pendingCount = (int) ($pendingStmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0);

        // Attendance counts for today
        $attCounts = $this->attendanceRepo->getTodayCounts($todayDate);

        // 2. Today’s Schedule List
        $todaySchedule = $this->getTodaySchedule();

        // 3. Waiting List
        $waitingList = $this->attendanceRepo->getWaitingQueue($todayDate);

        // 4. Pending Reviews
        $pendingStmt = $pdo->prepare('
            SELECT a.id, a.start_at, a.end_at, a.duration_snapshot, a.price_snapshot, a.chief_complaint, a.status, a.created_at,
                   p.first_name AS patient_first_name, p.last_name AS patient_last_name, p.phone AS patient_phone,
                   d.first_name AS dentist_first_name, d.last_name AS dentist_last_name,
                   s.name AS service_name
            FROM appointments a
            JOIN patients p ON p.id = a.patient_id
            JOIN dentists d ON d.id = a.dentist_id
            JOIN services s ON s.id = a.service_id
            WHERE a.status = "PENDING"
            ORDER BY a.created_at ASC
            LIMIT 5
        ');
        $pendingStmt->execute();
        $pendingReviews = $pendingStmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'clinic_date' => $todayDate,
            'clinic_time' => $clinicTimeStr,
            'counts' => [
                'today_total' => (int) ($apptCounts['today_total'] ?? 0),
                'pending_requests' => $pendingCount,
                'confirmed_today' => (int) ($apptCounts['confirmed_today'] ?? 0),
                'checked_in' => $attCounts['checked_in'] + $attCounts['waiting'] + $attCounts['in_consultation'],
                'waiting' => $attCounts['waiting'] + $attCounts['checked_in'],
                'in_consultation' => $attCounts['in_consultation'],
                'completed_today' => (int) ($apptCounts['completed_today'] ?? 0),
                'cancelled_today' => (int) ($apptCounts['cancelled_today'] ?? 0),
            ],
            'today_schedule' => $todaySchedule,
            'waiting_list' => $waitingList,
            'pending_review' => $pendingReviews,
        ];
    }

    /**
     * Retrieve today's schedule with filters
     *
     * @param array<string, mixed> $filters
     * @return array<int, array<string, mixed>>
     */
    public function getTodaySchedule(array $filters = []): array
    {
        $now = new DateTimeImmutable('now', $this->timezone);
        $todayDate = $now->format('Y-m-d');

        $pdo = $this->database->getConnection();

        $sql = '
            SELECT a.id, a.patient_id, a.dentist_id, a.service_id, a.start_at, a.end_at,
                   a.duration_snapshot, a.price_snapshot, a.status AS appointment_status,
                   a.chief_complaint, a.operatory_chair,
                   p.first_name AS patient_first_name, p.last_name AS patient_last_name,
                   p.phone AS patient_phone, p.medical_alerts AS patient_medical_alerts,
                   d.first_name AS dentist_first_name, d.last_name AS dentist_last_name,
                   s.name AS service_name, s.category AS service_category,
                   COALESCE(att.status, "NOT_ARRIVED") AS attendance_status,
                   att.checked_in_at, att.consultation_started_at, att.consultation_ended_at,
                   att.notes AS attendance_notes
            FROM appointments a
            JOIN patients p ON p.id = a.patient_id
            JOIN dentists d ON d.id = a.dentist_id
            JOIN services s ON s.id = a.service_id
            LEFT JOIN appointment_attendances att ON att.appointment_id = a.id
            WHERE DATE(a.start_at) = :today
        ';

        $params = [':today' => $todayDate];

        if (!empty($filters['dentist_id'])) {
            $sql .= ' AND a.dentist_id = :dentist_id';
            $params[':dentist_id'] = (int) $filters['dentist_id'];
        }

        if (!empty($filters['appointment_status'])) {
            $sql .= ' AND a.status = :appointment_status';
            $params[':appointment_status'] = strtoupper(trim((string) $filters['appointment_status']));
        }

        if (!empty($filters['attendance_status'])) {
            $attStatus = strtoupper(trim((string) $filters['attendance_status']));
            if ($attStatus === 'NOT_ARRIVED') {
                $sql .= ' AND (att.status IS NULL OR att.status = "NOT_ARRIVED")';
            } else {
                $sql .= ' AND att.status = :attendance_status';
                $params[':attendance_status'] = $attStatus;
            }
        }

        if (!empty($filters['search'])) {
            $term = '%' . trim((string) $filters['search']) . '%';
            $sql .= ' AND (p.first_name LIKE :term1 OR p.last_name LIKE :term2 OR p.phone LIKE :term3 OR a.id = :term_id)';
            $params[':term1'] = $term;
            $params[':term2'] = $term;
            $params[':term3'] = $term;
            $params[':term_id'] = (int) $filters['search'];
        }

        $sql .= ' ORDER BY a.start_at ASC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) {
            if (!empty($row['checked_in_at'])) {
                $row['waiting_minutes'] = max(0, (int) floor((time() - strtotime((string) $row['checked_in_at'])) / 60));
            } else {
                $row['waiting_minutes'] = null;
            }
        }
        unset($row);

        return $rows;
    }

    /**
     * Record patient check-in for an appointment
     *
     * @return array<string, mixed>
     */
    public function checkInPatient(int $appointmentId, int $receptionistUserId, ?string $notes = null): array
    {
        $appt = $this->appointmentRepo->findById($appointmentId);
        if ($appt === null) {
            throw HttpException::notFound("Appointment #{$appointmentId} not found.");
        }

        if ($appt['status'] !== 'CONFIRMED') {
            throw HttpException::badRequest(
                "Only confirmed appointments can be checked in. Current status: {$appt['status']}."
            );
        }

        // Verify arrival is on today's clinic date
        $now = new DateTimeImmutable('now', $this->timezone);
        $todayDate = $now->format('Y-m-d');
        $apptStart = new DateTimeImmutable((string) $appt['start_at'], $this->timezone);

        if ($apptStart->format('Y-m-d') !== $todayDate) {
            throw HttpException::badRequest(
                "Cannot check in appointment scheduled for {$apptStart->format('Y-m-d')}. Check-in is only permitted on the scheduled date ({$todayDate})."
            );
        }

        $attendance = $this->attendanceRepo->recordCheckIn($appointmentId, $receptionistUserId, $notes);

        $this->auditRepo->record(
            'RECEPTIONIST_PATIENT_CHECKIN',
            'appointments',
            $appointmentId,
            $receptionistUserId,
            null,
            null,
            [
                'patient_id' => $appt['patient_id'],
                'dentist_id' => $appt['dentist_id'],
                'appointment_time' => $appt['start_at'],
                'notes' => $notes,
            ]
        );

        return [
            'success' => true,
            'message' => "Patient {$appt['patient_first_name']} {$appt['patient_last_name']} successfully checked in.",
            'attendance' => $attendance,
            'appointment' => $this->appointmentRepo->findById($appointmentId),
        ];
    }

    /**
     * Update attendance state (e.g. WAITING -> IN_CONSULTATION -> FINISHED)
     *
     * @return array<string, mixed>
     */
    public function updateAttendance(int $appointmentId, string $status, ?string $notes = null, int $userId = 0): array
    {
        $validStatuses = ['NOT_ARRIVED', 'CHECKED_IN', 'WAITING', 'IN_CONSULTATION', 'FINISHED', 'NO_SHOW'];
        $upperStatus = strtoupper(trim($status));

        if (!in_array($upperStatus, $validStatuses, true)) {
            throw HttpException::badRequest("Invalid attendance status '{$status}'. Allowed: " . implode(', ', $validStatuses));
        }

        $appt = $this->appointmentRepo->findById($appointmentId);
        if ($appt === null) {
            throw HttpException::notFound("Appointment #{$appointmentId} not found.");
        }

        $attendance = $this->attendanceRepo->updateStatus($appointmentId, $upperStatus, $notes);

        $this->auditRepo->record(
            'RECEPTIONIST_ATTENDANCE_UPDATE',
            'appointments',
            $appointmentId,
            $userId > 0 ? $userId : null,
            null,
            null,
            [
                'new_status' => $upperStatus,
                'notes' => $notes,
            ]
        );

        return [
            'success' => true,
            'message' => "Attendance status updated to '{$upperStatus}'.",
            'attendance' => $attendance,
        ];
    }

    /**
     * Register a new walk-in / front-desk patient
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function registerPatient(array $data, int $receptionistUserId): array
    {
        $firstName = trim((string) ($data['first_name'] ?? ''));
        $lastName = trim((string) ($data['last_name'] ?? ''));
        $phone = trim((string) ($data['phone'] ?? ''));
        $email = trim((string) ($data['email'] ?? ''));
        $dob = trim((string) ($data['date_of_birth'] ?? ''));
        $gender = strtoupper(trim((string) ($data['gender'] ?? 'PREFER_NOT_TO_SAY')));
        $address = trim((string) ($data['address'] ?? ''));
        $emergencyName = trim((string) ($data['emergency_contact_name'] ?? ''));
        $emergencyPhone = trim((string) ($data['emergency_contact_phone'] ?? ''));
        $medicalAlerts = trim((string) ($data['medical_alerts'] ?? ''));

        if ($firstName === '' || $lastName === '' || $phone === '') {
            throw HttpException::badRequest('First name, last name, and contact phone are required.');
        }

        if ($dob !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dob)) {
            throw HttpException::badRequest('Date of birth must follow YYYY-MM-DD format.');
        }

        // Generate synthetic patient email if not provided for walk-in
        if ($email === '') {
            $email = 'walkin.' . strtolower($firstName) . '.' . strtolower($lastName) . '.' . substr(preg_replace('/\D/', '', $phone), -4) . '@toothcare.local';
        }

        $pdo = $this->database->getConnection();
        $pdo->beginTransaction();

        try {
            // Check existing user by email
            $existingUser = $this->userRepo->findByEmail($email);
            if ($existingUser !== null) {
                $userId = (int) $existingUser['id'];
                $existingPatient = $this->patientRepo->findByUserId($userId);
                if ($existingPatient !== null) {
                    $pdo->rollBack();
                    throw HttpException::conflict("A patient record with email '{$email}' already exists (#{$existingPatient['id']}).");
                }
            } else {
                // Create user account
                $tempPassword = bin2hex(random_bytes(6)) . 'A1!';
                $passwordHash = password_hash($tempPassword, PASSWORD_DEFAULT);
                $userId = $this->userRepo->create($email, $passwordHash, 'PATIENT', 1, 1, $firstName, $lastName);
            }

            // Create patient profile
            $patientId = $this->patientRepo->create([
                'user_id' => $userId,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'phone' => $phone,
                'date_of_birth' => $dob ?: '1990-01-01',
                'gender' => $gender,
                'address' => $address ?: null,
                'emergency_contact_name' => $emergencyName ?: null,
                'emergency_contact_phone' => $emergencyPhone ?: null,
                'medical_alerts' => $medicalAlerts ?: null,
            ]);

            $pdo->commit();

            $this->auditRepo->record(
                'RECEPTIONIST_PATIENT_REGISTER',
                'patients',
                $patientId,
                $receptionistUserId,
                null,
                null,
                ['first_name' => $firstName, 'last_name' => $lastName, 'phone' => $phone]
            );

            return [
                'message' => "Patient {$firstName} {$lastName} registered successfully.",
                'patient' => $this->patientRepo->findById($patientId),
            ];
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Front desk direct appointment booking
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function createAppointment(array $data, int $receptionistUserId): array
    {
        $patientId = (int) ($data['patient_id'] ?? 0);
        $dentistId = (int) ($data['dentist_id'] ?? 0);
        $serviceId = (int) ($data['service_id'] ?? 0);
        $startAtStr = trim((string) ($data['start_at'] ?? ''));
        $chiefComplaint = trim((string) ($data['chief_complaint'] ?? ''));

        if ($patientId <= 0 || $dentistId <= 0 || $serviceId <= 0 || $startAtStr === '') {
            throw HttpException::badRequest('Patient ID, Dentist ID, Service ID, and start_at are required.');
        }

        $patient = $this->patientRepo->findById($patientId);
        if ($patient === null) {
            throw HttpException::notFound("Patient #{$patientId} not found.");
        }

        $dentist = $this->dentistRepo->findById($dentistId);
        if ($dentist === null || (int) $dentist['is_active'] !== 1) {
            throw HttpException::badRequest("Assigned dentist #{$dentistId} is either inactive or not found.");
        }

        $service = $this->serviceRepo->findById($serviceId);
        if ($service === null || (int) $service['is_active'] !== 1) {
            throw HttpException::badRequest("Requested service #{$serviceId} is either inactive or not found.");
        }

        $duration = (int) ($service['duration_minutes'] ?? 30);
        $price = (float) ($service['price'] ?? 0);
        $chair = $dentist['default_operatory_chair'] ?? 'Operatory Chair 1';

        $startAt = new DateTimeImmutable($startAtStr, $this->timezone);
        $endAt = $startAt->modify("+{$duration} minutes");

        $startFormatted = $startAt->format('Y-m-d H:i:s');
        $endFormatted = $endAt->format('Y-m-d H:i:s');

        // Check availability
        $conflicts = $this->appointmentRepo->findOverlappingAppointments(
            $dentistId,
            $startFormatted,
            $endFormatted
        );

        if (!empty($conflicts)) {
            throw HttpException::conflict("Dr. {$dentist['last_name']} already has an appointment scheduled during this time slot.");
        }

        $pdo = $this->database->getConnection();
        $pdo->beginTransaction();

        try {
            $stmt = $pdo->prepare('
                INSERT INTO appointments (
                    patient_id, dentist_id, service_id, start_at, end_at, duration_snapshot,
                    price_snapshot, status, chief_complaint, operatory_chair, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, "CONFIRMED", ?, ?, NOW(), NOW()
                )
            ');

            $stmt->execute([
                $patientId,
                $dentistId,
                $serviceId,
                $startFormatted,
                $endFormatted,
                $duration,
                $price,
                $chiefComplaint ?: 'Front-desk confirmed consultation',
                $chair,
            ]);

            $apptId = (int) $pdo->lastInsertId();

            // Record initial attendance row
            $this->attendanceRepo->updateStatus($apptId, 'NOT_ARRIVED', 'Created at front desk');

            // Record status history
            $histStmt = $pdo->prepare('
                INSERT INTO appointment_status_history (
                    appointment_id, from_status, to_status, reason, changed_by_user_id, created_at
                ) VALUES (?, NULL, "CONFIRMED", "Booked directly by front desk staff", ?, NOW())
            ');
            $histStmt->execute([$apptId, $receptionistUserId]);

            $pdo->commit();

            $this->auditRepo->record(
                'RECEPTIONIST_APPOINTMENT_CREATE',
                'appointments',
                $apptId,
                $receptionistUserId,
                null,
                null,
                [
                    'patient_id' => $patientId,
                    'dentist_id' => $dentistId,
                    'start_at' => $startFormatted,
                ]
            );

            return [
                'message' => "Appointment #{$apptId} successfully booked and confirmed.",
                'appointment' => $this->appointmentRepo->findById($apptId),
            ];
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }
}
