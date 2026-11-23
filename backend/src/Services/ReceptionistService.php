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

        // 1. Operational Counts (index-friendly Asia/Manila day bounds)
        $todayStart = $todayDate . ' 00:00:00';
        $todayEnd = $todayDate . ' 23:59:59';
        $nowStr = $now->format('Y-m-d H:i:s');

        $countStmt = $pdo->prepare("
            SELECT
                COUNT(*) AS today_total,
                COALESCE(SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END), 0) AS confirmed_today,
                COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed_today,
                COALESCE(SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS cancelled_today
            FROM appointments
            WHERE start_at >= ? AND start_at <= ?
        ");
        $countStmt->execute([$todayStart, $todayEnd]);
        $apptCounts = $countStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        // Global pending, upcoming, and status distribution in one pass
        $globalStmt = $pdo->prepare("
            SELECT
                COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0) AS pending_total,
                COALESCE(SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END), 0) AS confirmed_total,
                COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed_total,
                COALESCE(SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS cancelled_total,
                COALESCE(SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END), 0) AS rejected_total,
                COALESCE(SUM(CASE WHEN status IN ('PENDING', 'CONFIRMED') AND start_at >= ? THEN 1 ELSE 0 END), 0) AS upcoming_total
            FROM appointments
        ");
        $globalStmt->execute([$nowStr]);
        $globalCounts = $globalStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $pendingCount = (int) ($globalCounts['pending_total'] ?? 0);
        $upcomingCount = (int) ($globalCounts['upcoming_total'] ?? 0);

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
                'upcoming_appointments' => $upcomingCount,
                'confirmed_today' => (int) ($apptCounts['confirmed_today'] ?? 0),
                'checked_in' => $attCounts['checked_in'] + $attCounts['waiting'] + $attCounts['in_consultation'],
                'waiting' => $attCounts['waiting'] + $attCounts['checked_in'],
                'in_consultation' => $attCounts['in_consultation'],
                'completed_today' => (int) ($apptCounts['completed_today'] ?? 0),
                'cancelled_today' => (int) ($apptCounts['cancelled_today'] ?? 0),
            ],
            'status_distribution' => [
                'PENDING' => (int) ($globalCounts['pending_total'] ?? 0),
                'CONFIRMED' => (int) ($globalCounts['confirmed_total'] ?? 0),
                'COMPLETED' => (int) ($globalCounts['completed_total'] ?? 0),
                'CANCELLED' => (int) ($globalCounts['cancelled_total'] ?? 0),
                'REJECTED' => (int) ($globalCounts['rejected_total'] ?? 0),
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
            WHERE a.start_at >= :today_start AND a.start_at <= :today_end
        ';

        $params = [
            ':today_start' => $todayDate . ' 00:00:00',
            ':today_end' => $todayDate . ' 23:59:59',
        ];

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

        try {
            $dispatcher = new \App\Services\Notifications\UnifiedNotificationDispatcher($this->database);
            $dispatcher->dispatchAppointmentEvent(
                \App\Services\Realtime\RealtimeOutboxService::EVENT_APPOINTMENT_UPDATED,
                $appt,
                'CHECKED_IN',
                $this->database->getConnection(),
                'RECEPTIONIST',
                $receptionistUserId,
                "Appointment #{$appointmentId} has been checked in at the front desk."
            );
            $dispatcher->dispatchPendingAfterCommit();
        } catch (Throwable) {
            // Never block patient check-in on realtime/notification failure
        }

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

        try {
            $dispatcher = new \App\Services\Notifications\UnifiedNotificationDispatcher($this->database);
            $dispatcher->dispatchAppointmentEvent(
                \App\Services\Realtime\RealtimeOutboxService::EVENT_APPOINTMENT_UPDATED,
                $appt,
                $upperStatus,
                $this->database->getConnection(),
                'RECEPTIONIST',
                $userId > 0 ? $userId : null,
                "Appointment #{$appointmentId} attendance updated to {$upperStatus}."
            );
            $dispatcher->dispatchPendingAfterCommit();
        } catch (Throwable) {
            // Never block attendance update on realtime/notification failure
        }

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

            try {
                $dispatcher = new \App\Services\Notifications\UnifiedNotificationDispatcher($this->database);
                $dispatcher->dispatchAccountEvent(
                    \App\Services\Realtime\RealtimeOutboxService::EVENT_ACCOUNT_CREATED,
                    $userId,
                    'PATIENT',
                    'New Walk-In Patient Registered',
                    "A new walk-in patient account (#{$userId}) was registered at the front desk.",
                    'created',
                    $receptionistUserId,
                    false,
                    $pdo
                );
            } catch (Throwable) {
                // Never break walk-in registration in minimal test schemas
            }

            $pdo->commit();

            try {
                (new \App\Services\Notifications\UnifiedNotificationDispatcher($this->database))
                    ->dispatchPendingAfterCommit();
            } catch (Throwable) {
                // Outage-resilient
            }

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

            // Persist in-app notifications and enqueue real-time outbox events atomically across all authorized roles
            try {
                $dispatcher = new \App\Services\Notifications\UnifiedNotificationDispatcher($this->database);
                $dispatcher->dispatchAppointmentEvent(
                    \App\Services\Realtime\RealtimeOutboxService::EVENT_APPOINTMENT_CONFIRMED,
                    [
                        'id' => $apptId,
                        'service_name' => (string) ($service['name'] ?? 'Dental Consultation'),
                        'start_at' => $startFormatted,
                        'patient_user_id' => !empty($patient['user_id']) ? (int) $patient['user_id'] : 0,
                        'dentist_user_id' => !empty($dentist['user_id']) ? (int) $dentist['user_id'] : 0,
                    ],
                    'CONFIRMED',
                    $pdo,
                    'RECEPTIONIST',
                    $receptionistUserId
                );
            } catch (Throwable) {
                // Never break front-desk booking in minimal test schemas lacking realtime tables
            }

            $pdo->commit();

            try {
                (new \App\Services\Notifications\UnifiedNotificationDispatcher($this->database))
                    ->dispatchPendingAfterCommit();
            } catch (Throwable) {
                // Outage-resilient: realtime-worker will retry
            }

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
