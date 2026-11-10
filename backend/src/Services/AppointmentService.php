<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Logger;
use App\Repositories\AppointmentRepository;
use App\Repositories\AuditLogRepository;
use App\Repositories\DentistRepository;
use App\Repositories\PatientRepository;
use App\Repositories\ServiceRepository;
use App\Repositories\UserRepository;
use App\Validators\AppointmentValidator;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use Throwable;

/**
 * Appointment Service
 * Authoritative business logic for appointment creation, transactional booking with
 * dentist row-locking, status lifecycle transitions, and atomic rescheduling.
 */
class AppointmentService
{
    private Database $database;
    private AppointmentRepository $appointmentRepo;
    private PatientRepository $patientRepo;
    private DentistRepository $dentistRepo;
    private ServiceRepository $serviceRepo;
    private UserRepository $userRepo;
    private AvailabilityService $availabilityService;
    private AuditLogRepository $auditRepo;
    private EmailService $emailService;
    private NotificationService $notificationService;
    private Logger $logger;
    private DateTimeZone $timezone;

    public function __construct(
        ?AppointmentRepository $appointmentRepo = null,
        ?PatientRepository $patientRepo = null,
        ?DentistRepository $dentistRepo = null,
        ?ServiceRepository $serviceRepo = null,
        ?UserRepository $userRepo = null,
        ?AvailabilityService $availabilityService = null,
        ?AuditLogRepository $auditRepo = null,
        ?EmailService $emailService = null,
        ?Logger $logger = null,
        ?Database $database = null,
        ?NotificationService $notificationService = null
    ) {
        $this->database = $database ?? Database::getInstance();
        $this->appointmentRepo = $appointmentRepo ?? new AppointmentRepository($this->database);
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
        $this->emailService = $emailService ?? new EmailService($this->database);
        $this->logger = $logger ?? Logger::getInstance();
        $this->notificationService = $notificationService ?? new NotificationService(
            new \App\Repositories\NotificationRepository($this->database),
            $this->logger
        );
        $this->timezone = $this->availabilityService->getTimezone();
    }

    /**
     * Book a new appointment inside a protected MySQL transaction with dentist row-locking.
     *
     * @param int $userId Authenticated user ID
     * @param array<string, mixed> $input Raw request data
     * @param DateTimeImmutable|null $currentTime Simulated time for testing
     * @return array<string, mixed> Persisted appointment resource
     * @throws HttpException
     */
    public function bookAppointment(int $userId, array $input, ?DateTimeImmutable $currentTime = null): array
    {
        // 1. Authenticated Patient Identity Resolution
        $patient = $this->patientRepo->findByUserId($userId);
        if (!$patient) {
            throw HttpException::forbidden(
                'A complete patient profile is required before booking appointments.',
                'PATIENT_PROFILE_REQUIRED'
            );
        }

        // 2. Validate Input Payload
        $validated = AppointmentValidator::validateBooking($input);
        $dentistId = $validated['dentist_id'];
        $serviceId = $validated['service_id'];

        $pdo = $this->database->getConnection();
        $pdo->beginTransaction();

        try {
            // 3. Acquire Row Lock on Dentist Anchor
            $dentist = $this->appointmentRepo->lockDentist($dentistId, $pdo);
            if (!$dentist) {
                throw HttpException::notFound('Dentist profile not found.');
            }
            if ((int) $dentist['is_active'] !== 1) {
                throw HttpException::unprocessableEntity(
                    'Dentist is currently inactive and cannot accept bookings.',
                    ['code' => 'DENTIST_INACTIVE']
                );
            }

            // 4. Retrieve Trusted Service Details
            $service = $this->serviceRepo->findById($serviceId);
            if (!$service) {
                throw HttpException::notFound('Dental service not found.');
            }
            if ((int) $service['is_active'] !== 1) {
                throw HttpException::unprocessableEntity(
                    'Service is currently inactive and cannot be booked.',
                    ['code' => 'SERVICE_INACTIVE']
                );
            }

            // 5. Calculate Authoritative Duration, Price, and Intervals
            $durationMinutes = (int) $service['duration_minutes'];
            $priceSnapshot = (float) $service['price'];

            $startAtDt = AppointmentValidator::parseDateTime($validated['start_at'], $this->timezone);
            if ($startAtDt === null) {
                throw HttpException::unprocessableEntity('Invalid start date and time format.');
            }

            $endAtDt = $startAtDt->modify("+{$durationMinutes} minutes");

            // 6. Validate Availability Engine Rules Inside the Transaction
            $isAvailable = $this->availabilityService->isSlotAvailable(
                $dentistId,
                $serviceId,
                $startAtDt,
                $currentTime
            );

            if (!$isAvailable) {
                throw HttpException::conflict(
                    'The requested appointment slot is not available or falls outside clinic/dentist operating hours.',
                    'SLOT_UNAVAILABLE'
                );
            }

            // 7. Recheck for Any Overlapping Blocking Appointments on Locked Connection
            // Buffer time is 10 minutes by default
            $blockingEndDt = $endAtDt->modify('+10 minutes');
            $overlaps = $this->appointmentRepo->findBlockingByDentistAndRange(
                $dentistId,
                $startAtDt->format('Y-m-d H:i:s'),
                $blockingEndDt->format('Y-m-d H:i:s'),
                null,
                $pdo
            );

            if (!empty($overlaps)) {
                throw HttpException::conflict(
                    'The selected appointment time slot has already been booked by another patient.',
                    'SLOT_CONFLICT'
                );
            }

            // 8. Insert Appointment Record
            $chair = $dentist['default_operatory_chair'] ?? 'Chair 1';
            $appointmentId = $this->appointmentRepo->create([
                'patient_id' => (int) $patient['id'],
                'dentist_id' => $dentistId,
                'service_id' => $serviceId,
                'start_at' => $startAtDt->format('Y-m-d H:i:s'),
                'end_at' => $endAtDt->format('Y-m-d H:i:s'),
                'duration_snapshot' => $durationMinutes,
                'price_snapshot' => $priceSnapshot,
                'status' => AppointmentValidator::STATUS_PENDING,
                'chief_complaint' => $validated['chief_complaint'],
                'operatory_chair' => $chair,
                'rescheduled_from_id' => $input['rescheduled_from_id'] ?? null,
            ], $pdo);

            // 9. Record Initial Status History
            $this->appointmentRepo->recordStatusHistory(
                $appointmentId,
                null,
                AppointmentValidator::STATUS_PENDING,
                $userId,
                'Initial appointment request submitted',
                [
                    'duration_minutes' => $durationMinutes,
                    'price_snapshot' => $priceSnapshot,
                    'operatory_chair' => $chair,
                ],
                $pdo
            );

            // 10. Record Audit Event
            $this->auditRepo->record(
                'APPOINTMENT_REQUESTED',
                'appointment',
                $appointmentId,
                $userId,
                null,
                null,
                [
                    'patient_id' => $patient['id'],
                    'dentist_id' => $dentistId,
                    'service_id' => $serviceId,
                    'start_at' => $startAtDt->format('Y-m-d H:i:s'),
                ]
            );

            // 11. Commit Transaction
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($e instanceof HttpException) {
                throw $e;
            }
            $this->logger->error('Appointment creation transaction failed', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
            throw HttpException::badRequest('Failed to create appointment. Please try again.');
        }

        // 12. Post-Commit Asynchronous / Outbox Notification
        $persisted = $this->appointmentRepo->findById($appointmentId);
        if ($persisted) {
            $user = $this->userRepo->findById($userId);
            if ($user && !empty($user['email'])) {
                $this->emailService->sendAppointmentSubmittedEmail(
                    (string) $user['email'],
                    $patient['first_name'] . ' ' . $patient['last_name'],
                    [
                        'start_at' => $persisted['start_at'],
                        'service_name' => $persisted['service_name'],
                        'dentist_name' => $persisted['dentist_first_name'] . ' ' . $persisted['dentist_last_name'],
                        'operatory_chair' => $persisted['operatory_chair'],
                    ],
                    $userId
                );
            }

            // In-app Notification
            $this->notificationService->createNotification(
                $userId,
                'PATIENT',
                'APPOINTMENT_REQUESTED',
                'Appointment Request Submitted',
                "Your appointment request for {$persisted['service_name']} on {$persisted['start_at']} has been received.",
                'appointments',
                $appointmentId
            );
        }

        return $persisted ?? [];
    }

    /**
     * Administrative approval of a pending appointment.
     *
     * @param int $adminUserId
     * @param int $appointmentId
     * @return array<string, mixed>
     * @throws HttpException
     */
    public function confirmAppointment(int $adminUserId, int $appointmentId): array
    {
        $pdo = $this->database->getConnection();
        $pdo->beginTransaction();

        try {
            $appointment = $this->appointmentRepo->findByIdForUpdate($appointmentId, $pdo);
            if (!$appointment) {
                throw HttpException::notFound('Appointment not found.');
            }

            // Verify lifecycle state transition
            AppointmentValidator::validateStatusTransition(
                $appointment['status'],
                AppointmentValidator::STATUS_CONFIRMED
            );

            // Verify dentist is active
            $dentist = $this->dentistRepo->findById((int) $appointment['dentist_id']);
            if (!$dentist || (int) $dentist['is_active'] !== 1) {
                throw HttpException::conflict(
                    'Cannot confirm appointment because the assigned dentist is currently inactive.',
                    'DENTIST_INACTIVE'
                );
            }

            // Verify no other appointment was confirmed in this interval
            $blockingEndDt = (new DateTimeImmutable($appointment['end_at'], $this->timezone))->modify('+10 minutes');
            $overlaps = $this->appointmentRepo->findBlockingByDentistAndRange(
                (int) $appointment['dentist_id'],
                $appointment['start_at'],
                $blockingEndDt->format('Y-m-d H:i:s'),
                $appointmentId,
                $pdo
            );

            if (!empty($overlaps)) {
                throw HttpException::conflict(
                    'Cannot confirm appointment due to a scheduling conflict with another existing booking.',
                    'CONFIRM_OVERLAP_CONFLICT'
                );
            }

            // Update status
            $this->appointmentRepo->updateStatus(
                $appointmentId,
                AppointmentValidator::STATUS_CONFIRMED,
                $adminUserId,
                null,
                $pdo
            );

            // Record status history
            $this->appointmentRepo->recordStatusHistory(
                $appointmentId,
                $appointment['status'],
                AppointmentValidator::STATUS_CONFIRMED,
                $adminUserId,
                'Approved by clinic administration',
                null,
                $pdo
            );

            // Audit log
            $this->auditRepo->record(
                'APPOINTMENT_CONFIRMED',
                'appointment',
                $appointmentId,
                $adminUserId,
                null,
                null,
                ['previous_status' => $appointment['status']]
            );

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($e instanceof HttpException) {
                throw $e;
            }
            $this->logger->error('Appointment confirmation failed', [
                'appointment_id' => $appointmentId,
                'error' => $e->getMessage(),
            ]);
            throw HttpException::badRequest('Failed to confirm appointment.');
        }

        $updated = $this->appointmentRepo->findById($appointmentId);

        // Send confirmation email
        if ($updated && !empty($updated['patient_email'])) {
            $this->emailService->sendAppointmentConfirmedEmail(
                (string) $updated['patient_email'],
                $updated['patient_first_name'] . ' ' . $updated['patient_last_name'],
                [
                    'start_at' => $updated['start_at'],
                    'service_name' => $updated['service_name'],
                    'dentist_name' => $updated['dentist_first_name'] . ' ' . $updated['dentist_last_name'],
                    'operatory_chair' => $updated['operatory_chair'],
                ],
                $adminUserId
            );
        }

        if ($updated && !empty($updated['patient_user_id'])) {
            $this->notificationService->createNotification(
                (int) $updated['patient_user_id'],
                'PATIENT',
                'APPOINTMENT_CONFIRMED',
                'Appointment Confirmed',
                "Your appointment for {$updated['service_name']} on {$updated['start_at']} has been confirmed.",
                'appointments',
                $appointmentId
            );
        }

        return $updated ?? [];
    }

    /**
     * Administrative rejection of a pending appointment.
     *
     * @param int $adminUserId
     * @param int $appointmentId
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     * @throws HttpException
     */
    public function rejectAppointment(int $adminUserId, int $appointmentId, array $input): array
    {
        $validated = AppointmentValidator::validateRejection($input);

        $pdo = $this->database->getConnection();
        $pdo->beginTransaction();

        try {
            $appointment = $this->appointmentRepo->findByIdForUpdate($appointmentId, $pdo);
            if (!$appointment) {
                throw HttpException::notFound('Appointment not found.');
            }

            AppointmentValidator::validateStatusTransition(
                $appointment['status'],
                AppointmentValidator::STATUS_REJECTED
            );

            $this->appointmentRepo->updateStatus(
                $appointmentId,
                AppointmentValidator::STATUS_REJECTED,
                $adminUserId,
                $validated['reason'],
                $pdo
            );

            $this->appointmentRepo->recordStatusHistory(
                $appointmentId,
                $appointment['status'],
                AppointmentValidator::STATUS_REJECTED,
                $adminUserId,
                $validated['reason'],
                null,
                $pdo
            );

            $this->auditRepo->record(
                'APPOINTMENT_REJECTED',
                'appointment',
                $appointmentId,
                $adminUserId,
                null,
                null,
                ['reason' => $validated['reason']]
            );

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($e instanceof HttpException) {
                throw $e;
            }
            $this->logger->error('Appointment rejection failed', [
                'appointment_id' => $appointmentId,
                'error' => $e->getMessage(),
            ]);
            throw HttpException::badRequest('Failed to reject appointment.');
        }

        $updated = $this->appointmentRepo->findById($appointmentId);

        if ($updated && !empty($updated['patient_email'])) {
            $this->emailService->sendAppointmentRejectedEmail(
                (string) $updated['patient_email'],
                $updated['patient_first_name'] . ' ' . $updated['patient_last_name'],
                [
                    'start_at' => $updated['start_at'],
                    'service_name' => $updated['service_name'],
                ],
                $validated['reason'],
                $adminUserId
            );
        }

        if ($updated && !empty($updated['patient_user_id'])) {
            $this->notificationService->createNotification(
                (int) $updated['patient_user_id'],
                'PATIENT',
                'APPOINTMENT_REJECTED',
                'Appointment Request Declined',
                "Your appointment request for {$updated['service_name']} could not be approved.",
                'appointments',
                $appointmentId
            );
        }

        return $updated ?? [];
    }

    /**
     * Cancel an appointment (Patient self-cancellation or Admin cancellation).
     *
     * @param int $userId
     * @param string $userRole
     * @param int $appointmentId
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     * @throws HttpException
     */
    public function cancelAppointment(int $userId, string $userRole, int $appointmentId, array $input): array
    {
        $validated = AppointmentValidator::validateCancellation($input);

        $pdo = $this->database->getConnection();
        $pdo->beginTransaction();

        try {
            $appointment = $this->appointmentRepo->findByIdForUpdate($appointmentId, $pdo);
            if (!$appointment) {
                throw HttpException::notFound('Appointment not found.');
            }

            // Ownership check for patients
            if (strtoupper($userRole) === 'PATIENT') {
                $patient = $this->patientRepo->findByUserId($userId);
                if (!$patient || (int) $appointment['patient_id'] !== (int) $patient['id']) {
                    throw HttpException::forbidden('You can only cancel your own appointments.');
                }
            }

            AppointmentValidator::validateStatusTransition(
                $appointment['status'],
                AppointmentValidator::STATUS_CANCELLED
            );

            $this->appointmentRepo->updateStatus(
                $appointmentId,
                AppointmentValidator::STATUS_CANCELLED,
                $userId,
                $validated['reason'],
                $pdo
            );

            $this->appointmentRepo->recordStatusHistory(
                $appointmentId,
                $appointment['status'],
                AppointmentValidator::STATUS_CANCELLED,
                $userId,
                $validated['reason'],
                null,
                $pdo
            );

            $this->auditRepo->record(
                'APPOINTMENT_CANCELLED',
                'appointment',
                $appointmentId,
                $userId,
                null,
                null,
                ['cancelled_by_role' => $userRole, 'reason' => $validated['reason']]
            );

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($e instanceof HttpException) {
                throw $e;
            }
            $this->logger->error('Appointment cancellation failed', [
                'appointment_id' => $appointmentId,
                'error' => $e->getMessage(),
            ]);
            throw HttpException::badRequest('Failed to cancel appointment.');
        }

        $updated = $this->appointmentRepo->findById($appointmentId);

        if ($updated && !empty($updated['patient_email'])) {
            $this->emailService->sendAppointmentCancelledEmail(
                (string) $updated['patient_email'],
                $updated['patient_first_name'] . ' ' . $updated['patient_last_name'],
                [
                    'start_at' => $updated['start_at'],
                    'service_name' => $updated['service_name'],
                ],
                $validated['reason'],
                $userId
            );
        }

        if ($updated && !empty($updated['patient_user_id'])) {
            $this->notificationService->createNotification(
                (int) $updated['patient_user_id'],
                'PATIENT',
                'APPOINTMENT_CANCELLED',
                'Appointment Cancelled',
                "Your appointment for {$updated['service_name']} on {$updated['start_at']} has been cancelled.",
                'appointments',
                $appointmentId
            );
        }

        return $updated ?? [];
    }

    /**
     * Mark a confirmed appointment as completed.
     *
     * @param int $adminUserId
     * @param int $appointmentId
     * @return array<string, mixed>
     * @throws HttpException
     */
    public function completeAppointment(int $adminUserId, int $appointmentId): array
    {
        $pdo = $this->database->getConnection();
        $pdo->beginTransaction();

        try {
            $appointment = $this->appointmentRepo->findByIdForUpdate($appointmentId, $pdo);
            if (!$appointment) {
                throw HttpException::notFound('Appointment not found.');
            }

            AppointmentValidator::validateStatusTransition(
                $appointment['status'],
                AppointmentValidator::STATUS_COMPLETED
            );

            $this->appointmentRepo->updateStatus(
                $appointmentId,
                AppointmentValidator::STATUS_COMPLETED,
                $adminUserId,
                null,
                $pdo
            );

            $this->appointmentRepo->recordStatusHistory(
                $appointmentId,
                $appointment['status'],
                AppointmentValidator::STATUS_COMPLETED,
                $adminUserId,
                'Appointment visit marked as completed',
                null,
                $pdo
            );

            $this->auditRepo->record(
                'APPOINTMENT_COMPLETED',
                'appointment',
                $appointmentId,
                $adminUserId,
                null,
                null
            );

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($e instanceof HttpException) {
                throw $e;
            }
            $this->logger->error('Appointment completion failed', [
                'appointment_id' => $appointmentId,
                'error' => $e->getMessage(),
            ]);
            throw HttpException::badRequest('Failed to complete appointment.');
        }

        $updated = $this->appointmentRepo->findById($appointmentId);

        if ($updated && !empty($updated['patient_email'])) {
            $this->emailService->sendAppointmentCompletedEmail(
                (string) $updated['patient_email'],
                $updated['patient_first_name'] . ' ' . $updated['patient_last_name'],
                [
                    'service_name' => $updated['service_name'],
                ],
                $adminUserId
            );
        }

        if ($updated && !empty($updated['patient_user_id'])) {
            $this->notificationService->createNotification(
                (int) $updated['patient_user_id'],
                'PATIENT',
                'APPOINTMENT_COMPLETED',
                'Appointment Completed',
                "Your visit for {$updated['service_name']} on {$updated['start_at']} is complete. Thank you for visiting ToothCare Hub!",
                'appointments',
                $appointmentId
            );
        }

        return $updated ?? [];
    }

    /**
     * Reschedule an appointment using Option A (Atomic Cancel-and-Create with Relational Linkage).
     *
     * @param int $userId
     * @param string $userRole
     * @param int $appointmentId
     * @param array<string, mixed> $input
     * @param DateTimeImmutable|null $currentTime
     * @return array<string, mixed> The newly created appointment
     * @throws HttpException
     */
    public function rescheduleAppointment(
        int $userId,
        string $userRole,
        int $appointmentId,
        array $input,
        ?DateTimeImmutable $currentTime = null
    ): array {
        $validated = AppointmentValidator::validateReschedule($input);

        $pdo = $this->database->getConnection();
        $pdo->beginTransaction();

        try {
            $oldAppointment = $this->appointmentRepo->findByIdForUpdate($appointmentId, $pdo);
            if (!$oldAppointment) {
                throw HttpException::notFound('Original appointment not found.');
            }

            // Ownership check for patients
            if (strtoupper($userRole) === 'PATIENT') {
                $patient = $this->patientRepo->findByUserId($userId);
                if (!$patient || (int) $oldAppointment['patient_id'] !== (int) $patient['id']) {
                    throw HttpException::forbidden('You can only reschedule your own appointments.');
                }
            }

            // Can only reschedule PENDING or CONFIRMED appointments
            if (!in_array($oldAppointment['status'], [AppointmentValidator::STATUS_PENDING, AppointmentValidator::STATUS_CONFIRMED], true)) {
                throw HttpException::conflict(
                    "Cannot reschedule an appointment with status '{$oldAppointment['status']}'. Only PENDING or CONFIRMED appointments may be rescheduled.",
                    'RESCHEDULE_ILLEGAL_STATUS'
                );
            }

            // Target Dentist & Service
            $targetDentistId = $validated['dentist_id'] ?? (int) $oldAppointment['dentist_id'];
            $targetServiceId = $validated['service_id'] ?? (int) $oldAppointment['service_id'];

            // 1. Lock Target Dentist
            $dentist = $this->appointmentRepo->lockDentist($targetDentistId, $pdo);
            if (!$dentist || (int) $dentist['is_active'] !== 1) {
                throw HttpException::unprocessableEntity('Target dentist is inactive or not found.');
            }

            // 2. Validate Service
            $service = $this->serviceRepo->findById($targetServiceId);
            if (!$service || (int) $service['is_active'] !== 1) {
                throw HttpException::unprocessableEntity('Target dental service is inactive or not found.');
            }

            $durationMinutes = (int) $service['duration_minutes'];
            $priceSnapshot = (float) $service['price'];

            $startAtDt = AppointmentValidator::parseDateTime($validated['start_at'], $this->timezone);
            if ($startAtDt === null) {
                throw HttpException::unprocessableEntity('Invalid start date and time format.');
            }
            $endAtDt = $startAtDt->modify("+{$durationMinutes} minutes");

            // 3. Check Availability Engine Rules
            $isAvailable = $this->availabilityService->isSlotAvailable(
                $targetDentistId,
                $targetServiceId,
                $startAtDt,
                $currentTime
            );

            if (!$isAvailable) {
                throw HttpException::conflict(
                    'The new requested appointment slot is not available.',
                    'SLOT_UNAVAILABLE'
                );
            }

            // 4. Overlap Check (Excluding current appointment ID if same dentist)
            $blockingEndDt = $endAtDt->modify('+10 minutes');
            $overlaps = $this->appointmentRepo->findBlockingByDentistAndRange(
                $targetDentistId,
                $startAtDt->format('Y-m-d H:i:s'),
                $blockingEndDt->format('Y-m-d H:i:s'),
                $appointmentId,
                $pdo
            );

            if (!empty($overlaps)) {
                throw HttpException::conflict(
                    'The new requested time slot conflicts with an existing booking.',
                    'SLOT_CONFLICT'
                );
            }

            // 5. Cancel Old Appointment Atomically
            $cancelReason = "Rescheduled to new slot on {$startAtDt->format('Y-m-d H:i:s')}: {$validated['reason']}";
            $this->appointmentRepo->updateStatus(
                $appointmentId,
                AppointmentValidator::STATUS_CANCELLED,
                $userId,
                $cancelReason,
                $pdo
            );

            $this->appointmentRepo->recordStatusHistory(
                $appointmentId,
                $oldAppointment['status'],
                AppointmentValidator::STATUS_CANCELLED,
                $userId,
                $cancelReason,
                ['rescheduled_to_slot' => $startAtDt->format('Y-m-d H:i:s')],
                $pdo
            );

            // 6. Create New Appointment Linked via rescheduled_from_id
            $chair = $dentist['default_operatory_chair'] ?? 'Chair 1';
            $newAppointmentId = $this->appointmentRepo->create([
                'patient_id' => (int) $oldAppointment['patient_id'],
                'dentist_id' => $targetDentistId,
                'service_id' => $targetServiceId,
                'start_at' => $startAtDt->format('Y-m-d H:i:s'),
                'end_at' => $endAtDt->format('Y-m-d H:i:s'),
                'duration_snapshot' => $durationMinutes,
                'price_snapshot' => $priceSnapshot,
                'status' => AppointmentValidator::STATUS_PENDING,
                'chief_complaint' => $oldAppointment['chief_complaint'],
                'operatory_chair' => $chair,
                'rescheduled_from_id' => $appointmentId,
            ], $pdo);

            $this->appointmentRepo->recordStatusHistory(
                $newAppointmentId,
                null,
                AppointmentValidator::STATUS_PENDING,
                $userId,
                "Rescheduled from appointment #{$appointmentId}",
                ['rescheduled_from_id' => $appointmentId],
                $pdo
            );

            $this->auditRepo->record(
                'APPOINTMENT_RESCHEDULED',
                'appointment',
                $newAppointmentId,
                $userId,
                null,
                null,
                ['rescheduled_from_id' => $appointmentId]
            );

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($e instanceof HttpException) {
                throw $e;
            }
            $this->logger->error('Appointment rescheduling failed', [
                'appointment_id' => $appointmentId,
                'error' => $e->getMessage(),
            ]);
            throw HttpException::badRequest('Failed to reschedule appointment.');
        }

        $rescheduled = $this->appointmentRepo->findById($newAppointmentId);
        if ($rescheduled && !empty($rescheduled['patient_user_id'])) {
            $this->notificationService->createNotification(
                (int) $rescheduled['patient_user_id'],
                'PATIENT',
                'APPOINTMENT_RESCHEDULED',
                'Appointment Rescheduled',
                "Your appointment has been rescheduled to {$rescheduled['start_at']}.",
                'appointments',
                $newAppointmentId
            );
        }

        return $rescheduled ?? [];
    }

    /**
     * Get single appointment with status history, enforcing patient ownership.
     *
     * @param int $userId
     * @param string $userRole
     * @param int $appointmentId
     * @return array<string, mixed>
     * @throws HttpException
     */
    public function getAppointment(int $userId, string $userRole, int $appointmentId): array
    {
        $appointment = $this->appointmentRepo->findById($appointmentId);
        if (!$appointment) {
            throw HttpException::notFound('Appointment not found.');
        }

        if (strtoupper($userRole) === 'PATIENT') {
            $patient = $this->patientRepo->findByUserId($userId);
            if (!$patient || (int) $appointment['patient_id'] !== (int) $patient['id']) {
                throw HttpException::notFound('Appointment not found.');
            }
        }

        $history = $this->appointmentRepo->getStatusHistory($appointmentId);
        $appointment['status_history'] = $history;

        return $appointment;
    }

    /**
     * List appointments for the authenticated patient.
     *
     * @param int $userId
     * @param array<string, mixed> $params
     * @return array<string, mixed>
     * @throws HttpException
     */
    public function listPatientAppointments(int $userId, array $params): array
    {
        $patient = $this->patientRepo->findByUserId($userId);
        if (!$patient) {
            return [
                'items' => [],
                'total' => 0,
                'page' => 1,
                'per_page' => 20,
                'total_pages' => 0,
            ];
        }

        $status = isset($params['status']) ? (string) $params['status'] : null;
        $from = isset($params['from']) ? (string) $params['from'] : null;
        $to = isset($params['to']) ? (string) $params['to'] : null;
        $page = isset($params['page']) ? max(1, (int) $params['page']) : 1;
        $perPage = isset($params['per_page']) ? max(1, min(100, (int) $params['per_page'])) : 20;

        return $this->appointmentRepo->findByPatient(
            (int) $patient['id'],
            $status,
            $from,
            $to,
            $page,
            $perPage
        );
    }

    /**
     * List appointments for administrators with filters and pagination.
     *
     * @param array<string, mixed> $filters
     * @param int $page
     * @param int $perPage
     * @return array<string, mixed>
     */
    public function listAdminAppointments(array $filters = [], int $page = 1, int $perPage = 20): array
    {
        return $this->appointmentRepo->findAllFiltered($filters, $page, $perPage);
    }

    /**
     * List appointments assigned to the authenticated dentist.
     *
     * @param int $userId
     * @param array<string, mixed> $params
     * @return array<string, mixed>
     */
    public function listDentistAppointments(int $userId, array $params = []): array
    {
        $dentist = $this->dentistRepo->findByUserId($userId);
        if (!$dentist) {
            return [
                'items' => [],
                'meta' => [
                    'total' => 0,
                    'page' => 1,
                    'per_page' => 20,
                    'last_page' => 1,
                ],
            ];
        }

        $from = isset($params['from']) && is_string($params['from']) ? $params['from'] : null;
        $to = isset($params['to']) && is_string($params['to']) ? $params['to'] : null;
        $status = isset($params['status']) && is_string($params['status']) ? strtoupper($params['status']) : null;
        $search = isset($params['search']) && is_string($params['search']) ? $params['search'] : null;

        $items = $this->appointmentRepo->findByDentist((int) $dentist['id'], $from, $to, $status, $search);

        $page = isset($params['page']) ? max(1, (int) $params['page']) : 1;
        $perPage = isset($params['per_page']) ? max(1, min(100, (int) $params['per_page'])) : 20;
        $total = count($items);
        $offset = ($page - 1) * $perPage;
        $pagedItems = array_slice($items, $offset, $perPage);
        $totalPages = $total > 0 ? (int) ceil($total / $perPage) : 1;

        return [
            'items' => $pagedItems,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'last_page' => $totalPages,
            ],
        ];
    }

    /**
     * Get single appointment assigned to the authenticated dentist, with attached treatment record.
     *
     * @param int $userId
     * @param int $appointmentId
     * @return array<string, mixed>
     * @throws HttpException
     */
    public function getDentistAppointment(int $userId, int $appointmentId): array
    {
        $dentist = $this->dentistRepo->findByUserId($userId);
        if (!$dentist) {
            throw HttpException::forbidden('Account is not linked to an active dentist profile.');
        }

        $appointment = $this->appointmentRepo->findById($appointmentId);
        if (!$appointment) {
            throw HttpException::notFound("Appointment #{$appointmentId} was not found.");
        }

        if ((int) $appointment['dentist_id'] !== (int) $dentist['id']) {
            $this->auditRepo->record(
                'UNAUTHORIZED_APPOINTMENT_ACCESS_ATTEMPT',
                'appointment',
                $appointmentId,
                $userId,
                null,
                null,
                ['reason' => 'Dentist attempted to access another clinician\'s appointment']
            );
            throw HttpException::forbidden('You are not authorized to view appointments assigned to another practitioner.');
        }

        // Attach treatment record if it exists
        $treatmentRepo = new \App\Repositories\TreatmentRecordRepository($this->database);
        $appointment['treatment_record'] = $treatmentRepo->findByAppointmentId($appointmentId);

        return $appointment;
    }

    /**
     * Mark an assigned appointment as COMPLETED by the attending dentist.
     * Enforces clinical ownership, status transition, and optional treatment record attachment.
     *
     * @param int $userId Authenticated user ID
     * @param int $appointmentId
     * @param array<string, mixed>|null $treatmentRecordData
     * @return array<string, mixed>
     * @throws HttpException
     */
    public function completeDentistAppointment(int $userId, int $appointmentId, ?array $treatmentRecordData = null): array
    {
        $dentist = $this->dentistRepo->findByUserId($userId);
        if (!$dentist) {
            throw HttpException::forbidden('Your account is not linked to an active dentist profile.');
        }

        $pdo = $this->database->getConnection();
        $pdo->beginTransaction();

        try {
            $appointment = $this->appointmentRepo->findByIdForUpdate($appointmentId, $pdo);
            if (!$appointment) {
                throw HttpException::notFound('Appointment #' . $appointmentId . ' was not found.');
            }

            // Clinical ownership validation
            if ((int) $appointment['dentist_id'] !== (int) $dentist['id']) {
                $this->auditRepo->record(
                    'UNAUTHORIZED_APPOINTMENT_COMPLETION_ATTEMPT',
                    'appointment',
                    $appointmentId,
                    $userId,
                    null,
                    null,
                    ['reason' => 'Dentist attempted to complete an appointment assigned to another clinician']
                );
                throw HttpException::forbidden('You are only authorized to complete appointments assigned to your schedule.');
            }

            // Lifecycle status transition check: must be CONFIRMED
            AppointmentValidator::validateStatusTransition(
                $appointment['status'],
                AppointmentValidator::STATUS_COMPLETED
            );

            // Update status to COMPLETED
            $this->appointmentRepo->updateStatus(
                $appointmentId,
                AppointmentValidator::STATUS_COMPLETED,
                $userId,
                null,
                $pdo
            );

            $this->appointmentRepo->recordStatusHistory(
                $appointmentId,
                $appointment['status'],
                AppointmentValidator::STATUS_COMPLETED,
                $userId,
                'Appointment visit completed by attending dentist Dr. ' . $dentist['last_name'],
                null,
                $pdo
            );

            // If treatment documentation was provided in the completion payload, persist it
            if (!empty($treatmentRecordData) && !empty($treatmentRecordData['diagnosis']) && !empty($treatmentRecordData['procedure_notes'])) {
                $treatmentRepo = new \App\Repositories\TreatmentRecordRepository($this->database);
                $existing = $treatmentRepo->findByAppointmentId($appointmentId);
                if (!$existing) {
                    $treatmentRepo->create([
                        'appointment_id' => $appointmentId,
                        'dentist_id' => (int) $dentist['id'],
                        'patient_id' => (int) $appointment['patient_id'],
                        'teeth_treated' => $treatmentRecordData['teeth_treated'] ?? [],
                        'diagnosis' => $treatmentRecordData['diagnosis'],
                        'procedure_notes' => $treatmentRecordData['procedure_notes'],
                        'prescription_notes' => $treatmentRecordData['prescription_notes'] ?? null,
                        'home_care_advice' => $treatmentRecordData['home_care_advice'] ?? null,
                    ], $pdo);
                }
            }

            $this->auditRepo->record(
                'APPOINTMENT_COMPLETED',
                'appointment',
                $appointmentId,
                $userId,
                null,
                null,
                ['dentist_id' => (int) $dentist['id']]
            );

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($e instanceof HttpException) {
                throw $e;
            }
            $this->logger->error('Dentist appointment completion failed: ' . $e->getMessage(), [
                'appointment_id' => $appointmentId,
                'dentist_id' => $dentist['id'] ?? null,
            ]);
            throw HttpException::badRequest('Failed to complete appointment.');
        }

        $updated = $this->appointmentRepo->findById($appointmentId);

        if ($updated) {
            if (!empty($updated['patient_user_id'])) {
                $this->notificationService->createNotification(
                    (int) $updated['patient_user_id'],
                    'PATIENT',
                    'APPOINTMENT_COMPLETED',
                    'Appointment Completed',
                    "Your visit for {$updated['service_name']} on {$updated['start_at']} is complete. Thank you for visiting ToothCare Hub!",
                    'appointments',
                    $appointmentId
                );
            }

            if (!empty($updated['patient_email'])) {
                $this->emailService->sendAppointmentCompletedEmail(
                    (string) $updated['patient_email'],
                    $updated['patient_first_name'] . ' ' . $updated['patient_last_name'],
                    [
                        'service_name' => $updated['service_name'],
                        'start_at' => $updated['start_at'],
                    ],
                    $userId
                );
            }
        }

        return $updated ?? [];
    }

    /**
     * Get real-time summary statistics and today's schedule for dentist dashboard.
     *
     * @param int $userId
     * @return array<string, mixed>
     */
    public function getDentistDashboardSummary(int $userId): array
    {
        $dentist = $this->dentistRepo->findByUserId($userId);
        if (!$dentist) {
            return [
                'today_count' => 0,
                'upcoming_count' => 0,
                'pending_count' => 0,
                'completed_count' => 0,
                'today_appointments' => [],
            ];
        }

        $dentistId = (int) $dentist['id'];
        $now = new DateTimeImmutable('now', $this->timezone);
        $todayStart = $now->format('Y-m-d 00:00:00');
        $todayEnd = $now->format('Y-m-d 23:59:59');

        $todayAppts = $this->appointmentRepo->findByDentist($dentistId, $todayStart, $todayEnd);
        $all = $this->appointmentRepo->findByDentist($dentistId);

        $upcomingCount = 0;
        $pendingCount = 0;
        $completedCount = 0;

        foreach ($all as $a) {
            $status = strtoupper((string) $a['status']);
            if ($status === 'CONFIRMED') {
                if ($a['start_at'] >= $now->format('Y-m-d H:i:s')) {
                    $upcomingCount++;
                }
            } elseif ($status === 'PENDING') {
                $pendingCount++;
            } elseif ($status === 'COMPLETED') {
                $completedCount++;
            }
        }

        return [
            'dentist' => [
                'id' => $dentistId,
                'first_name' => $dentist['first_name'],
                'last_name' => $dentist['last_name'],
                'specialization' => $dentist['specialization'],
                'license_number' => $dentist['license_number'],
                'chair' => $dentist['default_operatory_chair'],
            ],
            'today_count' => count($todayAppts),
            'upcoming_count' => $upcomingCount,
            'pending_count' => $pendingCount,
            'completed_count' => $completedCount,
            'today_appointments' => $todayAppts,
        ];
    }
}
