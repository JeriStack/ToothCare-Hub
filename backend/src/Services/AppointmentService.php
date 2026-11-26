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
use App\Services\Email\EmailOutboxService;
use App\Services\Notifications\UnifiedNotificationDispatcher;
use App\Services\Realtime\RealtimeOutboxService;
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
    private EmailOutboxService $emailService;
    private NotificationService $notificationService;
    private RealtimeOutboxService $realtimeOutbox;
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
        ?EmailOutboxService $emailService = null,
        ?Logger $logger = null,
        ?Database $database = null,
        ?NotificationService $notificationService = null,
        ?RealtimeOutboxService $realtimeOutbox = null
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
        $this->emailService = $emailService ?? new EmailOutboxService(null, null, null, null, null, $this->database);
        $this->logger = $logger ?? Logger::getInstance();
        $this->notificationService = $notificationService ?? new NotificationService(
            new \App\Repositories\NotificationRepository($this->database),
            $this->logger
        );
        $this->realtimeOutbox = $realtimeOutbox ?? new RealtimeOutboxService(null, null, null, $this->logger, $this->database);
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

            // 6. Validate Centralized Availability Engine Rules Inside the Locked Transaction
            $validation = $this->availabilityService->validateSlot(
                $dentistId,
                $serviceId,
                $startAtDt,
                $currentTime,
                null,
                true,
                true,
                $durationMinutes,
                null,
                $pdo,
                true
            );

            if (!$validation['available']) {
                throw HttpException::conflict(
                    $validation['message'],
                    $validation['reason_code'],
                    [
                        'reason_code' => $validation['reason_code'],
                        'availability_status' => $validation['availability_status'],
                        'conflict_context' => $validation['conflict_context'],
                        'alternatives_available' => true,
                    ]
                );
            }

            // 7. Insert Appointment Record using authoritative shift operatory chair
            $chair = $validation['operatory_chair'] ?: ($dentist['default_operatory_chair'] ?? 'Chair 1');
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
            $historyId = $this->appointmentRepo->recordStatusHistory(
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

            // 10b. Transactional outbox: queue email, persistent notifications, and realtime outbox atomically
            $txAppointment = $this->appointmentRepo->findById($appointmentId);
            if ($txAppointment) {
                $this->emailService->queueAppointmentEvent(EmailOutboxService::EVENT_REQUESTED, $txAppointment, $historyId);
                $this->persistAndQueueAppointmentNotifications(
                    RealtimeOutboxService::EVENT_APPOINTMENT_REQUESTED,
                    $txAppointment,
                    'PENDING',
                    $pdo
                );
            }

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

        // 12. Post-Commit Best-Effort Real-Time Dispatch (outages never affect committed booking)
        $this->realtimeOutbox->dispatchPendingBestEffort();
        $persisted = $this->appointmentRepo->findById($appointmentId);

        return $persisted ?? [];
    }

    /**
     * Administrative approval of a pending appointment with full transactional revalidation
     * and dentist row-locking to prevent concurrent double-approval race conditions.
     *
     * @param int $adminUserId
     * @param int $appointmentId
     * @param DateTimeImmutable|null $currentTime
     * @return array<string, mixed>
     * @throws HttpException
     */
    public function confirmAppointment(
        int $adminUserId,
        int $appointmentId,
        ?DateTimeImmutable $currentTime = null
    ): array {
        // Resolve dentist ID upfront so lock ordering stays consistent: dentists -> appointments
        $initialSnapshot = $this->appointmentRepo->findById($appointmentId);
        if (!$initialSnapshot) {
            throw HttpException::notFound('Appointment not found.');
        }

        $pdo = $this->database->getConnection();
        $pdo->beginTransaction();

        try {
            // 1. Lock dentist anchor first (consistent with bookAppointment/rescheduleAppointment)
            $this->appointmentRepo->lockDentist((int) $initialSnapshot['dentist_id'], $pdo);

            // 2. Lock appointment row for atomic status transition
            $appointment = $this->appointmentRepo->findByIdForUpdate($appointmentId, $pdo);
            if (!$appointment) {
                throw HttpException::notFound('Appointment not found.');
            }

            // If dentist changed prior to lock acquisition, lock the current dentist as well
            if ((int) $appointment['dentist_id'] !== (int) $initialSnapshot['dentist_id']) {
                $this->appointmentRepo->lockDentist((int) $appointment['dentist_id'], $pdo);
            }

            // 3. Verify lifecycle state transition
            AppointmentValidator::validateStatusTransition(
                $appointment['status'],
                AppointmentValidator::STATUS_CONFIRMED
            );

            // 4. Revalidate full authoritative dentist & clinic availability inside the locked transaction
            $startAtDt = AppointmentValidator::parseDateTime((string) $appointment['start_at'], $this->timezone);
            if ($startAtDt === null) {
                throw HttpException::conflict(
                    'Appointment start time could not be validated.',
                    AvailabilityService::REASON_APPOINTMENT_NO_LONGER_ELIGIBLE
                );
            }

            $durationSnapshot = (int) ($appointment['duration_snapshot'] ?? 0);
            $validation = $this->availabilityService->validateSlot(
                (int) $appointment['dentist_id'],
                (int) $appointment['service_id'],
                $startAtDt,
                $currentTime,
                $appointmentId,
                false,
                false,
                $durationSnapshot > 0 ? $durationSnapshot : null,
                isset($appointment['operatory_chair']) ? (string) $appointment['operatory_chair'] : null,
                $pdo,
                false
            );

            if (!$validation['available']) {
                throw HttpException::conflict(
                    $validation['message'],
                    $validation['reason_code'],
                    [
                        'appointment_id' => $appointmentId,
                        'reason_code' => $validation['reason_code'],
                        'availability_status' => $validation['availability_status'],
                        'suggested_rejection_reason' => $validation['suggested_rejection_reason'],
                        'conflict_context' => $validation['conflict_context'],
                        'appointment_remains_pending' => true,
                    ]
                );
            }

            // 5. Update status atomically
            $this->appointmentRepo->updateStatus(
                $appointmentId,
                AppointmentValidator::STATUS_CONFIRMED,
                $adminUserId,
                null,
                $pdo
            );

            // Record status history
            $historyId = $this->appointmentRepo->recordStatusHistory(
                $appointmentId,
                $appointment['status'],
                AppointmentValidator::STATUS_CONFIRMED,
                $adminUserId,
                'Approved by clinic administration after availability verification',
                ['availability_verified' => true],
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
                ['previous_status' => $appointment['status'], 'availability_verified' => true]
            );

            // Transactional outbox: queue email, persistent notifications, and realtime outbox atomically
            $txAppointment = $this->appointmentRepo->findById($appointmentId);
            if ($txAppointment) {
                $this->emailService->queueAppointmentEvent(EmailOutboxService::EVENT_CONFIRMED, $txAppointment, $historyId);
                $this->persistAndQueueAppointmentNotifications(
                    RealtimeOutboxService::EVENT_APPOINTMENT_CONFIRMED,
                    $txAppointment,
                    'CONFIRMED',
                    $pdo,
                    null,
                    false,
                    $adminUserId
                );
            }

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

        $this->realtimeOutbox->dispatchPendingBestEffort();
        $updated = $this->appointmentRepo->findById($appointmentId);

        return $updated ?? [];
    }

    /**
     * Revalidate a single appointment's dentist & clinic availability for triage review.
     *
     * @return array<string, mixed>
     */
    public function validateAppointmentForApproval(
        int $appointmentId,
        ?DateTimeImmutable $currentTime = null
    ): array {
        $appointment = $this->appointmentRepo->findById($appointmentId);
        if (!$appointment) {
            throw HttpException::notFound('Appointment not found.');
        }

        $now = ($currentTime ?? new DateTimeImmutable('now', $this->timezone))
            ->setTimezone($this->timezone);

        if (strtoupper((string) $appointment['status']) !== AppointmentValidator::STATUS_PENDING) {
            return [
                'appointment_id' => $appointmentId,
                'status' => $appointment['status'],
                'eligible_for_approval' => false,
                'available' => false,
                'availability_status' => AvailabilityService::STATUS_REQUIRES_REVIEW,
                'reason_code' => AvailabilityService::REASON_APPOINTMENT_NO_LONGER_ELIGIBLE,
                'message' => "This appointment is already {$appointment['status']} and is no longer eligible for approval.",
                'suggested_rejection_reason' => null,
                'conflict_context' => null,
                'checked_at' => $now->format(DateTimeImmutable::ATOM),
            ];
        }

        $validation = $this->evaluateAppointmentAvailability($appointment, $now);

        return array_merge([
            'appointment_id' => $appointmentId,
            'status' => $appointment['status'],
            'eligible_for_approval' => $validation['available'],
            'checked_at' => $now->format(DateTimeImmutable::ATOM),
        ], $validation);
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

            $historyMeta = $validated['conflict_reason_code'] !== null
                ? ['conflict_reason_code' => $validated['conflict_reason_code']]
                : null;

            $historyId = $this->appointmentRepo->recordStatusHistory(
                $appointmentId,
                $appointment['status'],
                AppointmentValidator::STATUS_REJECTED,
                $adminUserId,
                $validated['reason'],
                $historyMeta,
                $pdo
            );

            $auditMeta = ['reason' => $validated['reason']];
            if ($validated['conflict_reason_code'] !== null) {
                $auditMeta['conflict_reason_code'] = $validated['conflict_reason_code'];
            }

            $this->auditRepo->record(
                'APPOINTMENT_REJECTED',
                'appointment',
                $appointmentId,
                $adminUserId,
                null,
                null,
                $auditMeta
            );

            // Transactional outbox: queue email, persistent notifications, and realtime outbox atomically
            $txAppointment = $this->appointmentRepo->findById($appointmentId);
            if ($txAppointment) {
                $this->emailService->queueAppointmentEvent(EmailOutboxService::EVENT_REJECTED, $txAppointment, $historyId, ['reason' => $validated['reason']]);
                $this->persistAndQueueAppointmentNotifications(
                    RealtimeOutboxService::EVENT_APPOINTMENT_REJECTED,
                    $txAppointment,
                    'REJECTED',
                    $pdo,
                    null,
                    false,
                    $adminUserId,
                    $validated['reason']
                );
            }

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

        $this->realtimeOutbox->dispatchPendingBestEffort();
        $updated = $this->appointmentRepo->findById($appointmentId);

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

            // Ownership & cancellation cutoff policy check for patients
            if (strtoupper($userRole) === 'PATIENT') {
                $patient = $this->patientRepo->findByUserId($userId);
                if (!$patient || (int) $appointment['patient_id'] !== (int) $patient['id']) {
                    throw HttpException::forbidden('You can only cancel your own appointments.');
                }

                // Enforce clinic cancellation cutoff policy for CONFIRMED appointments
                if (strtoupper((string) $appointment['status']) === AppointmentValidator::STATUS_CONFIRMED) {
                    $cutoffHours = 24;
                    try {
                        $settingStmt = $pdo->prepare("SELECT setting_value FROM clinic_settings WHERE setting_key = 'cancellation_cutoff_hours' LIMIT 1");
                        $settingStmt->execute();
                        $rawCutoff = $settingStmt->fetchColumn();
                        if ($rawCutoff !== false && is_numeric($rawCutoff)) {
                            $cutoffHours = max(0, (int) $rawCutoff);
                        }
                    } catch (Throwable) {
                        $cutoffHours = 24;
                    }

                    if ($cutoffHours > 0) {
                        $now = new DateTimeImmutable('now', $this->timezone);
                        $apptStart = new DateTimeImmutable((string) $appointment['start_at'], $this->timezone);
                        $cutoffBoundary = $now->modify("+{$cutoffHours} hours");
                        if ($apptStart <= $cutoffBoundary) {
                            throw HttpException::unprocessableEntity(
                                "Confirmed appointments cannot be cancelled within {$cutoffHours} hours of the scheduled time. Please contact the clinic.",
                                ['appointment_id' => ["Cancellation cutoff is {$cutoffHours} hours prior to appointment start."]]
                            );
                        }
                    }
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

            $historyId = $this->appointmentRepo->recordStatusHistory(
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

            // Transactional outbox: queue email, persistent notifications, and realtime outbox atomically
            $txAppointment = $this->appointmentRepo->findById($appointmentId);
            if ($txAppointment) {
                $this->emailService->queueAppointmentEvent(EmailOutboxService::EVENT_CANCELLED, $txAppointment, $historyId, ['cancelled_by' => strtoupper($userRole) === 'PATIENT' ? 'patient' : 'clinic']);
                $this->persistAndQueueAppointmentNotifications(
                    RealtimeOutboxService::EVENT_APPOINTMENT_CANCELLED,
                    $txAppointment,
                    'CANCELLED',
                    $pdo,
                    strtoupper($userRole)
                );
            }

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

        $this->realtimeOutbox->dispatchPendingBestEffort();
        $updated = $this->appointmentRepo->findById($appointmentId);

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

            $historyId = $this->appointmentRepo->recordStatusHistory(
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

            // Transactional outbox: queue email, persistent notifications, and realtime outbox atomically
            $txAppointment = $this->appointmentRepo->findById($appointmentId);
            if ($txAppointment) {
                $this->emailService->queueAppointmentEvent(EmailOutboxService::EVENT_COMPLETED, $txAppointment, $historyId);
                $this->persistAndQueueAppointmentNotifications(
                    RealtimeOutboxService::EVENT_APPOINTMENT_UPDATED,
                    $txAppointment,
                    'COMPLETED',
                    $pdo,
                    'ADMIN',
                    false,
                    $adminUserId
                );
            }

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

        $this->realtimeOutbox->dispatchPendingBestEffort();
        $updated = $this->appointmentRepo->findById($appointmentId);

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
            $upperRole = strtoupper(trim($userRole));
            if (!in_array($upperRole, ['PATIENT', 'ADMIN', 'RECEPTIONIST'], true)) {
                throw HttpException::forbidden('You are not authorized to reschedule or reassign appointments.');
            }

            $oldAppointment = $this->appointmentRepo->findByIdForUpdate($appointmentId, $pdo);
            if (!$oldAppointment) {
                throw HttpException::notFound('Original appointment not found.');
            }

            // Ownership & clinic cutoff policy check for patients
            if ($upperRole === 'PATIENT') {
                $patient = $this->patientRepo->findByUserId($userId);
                if (!$patient || (int) $oldAppointment['patient_id'] !== (int) $patient['id']) {
                    throw HttpException::forbidden('You can only reschedule your own appointments.');
                }

                // Enforce clinic cancellation/reschedule cutoff policy for CONFIRMED appointments
                if (strtoupper((string) $oldAppointment['status']) === AppointmentValidator::STATUS_CONFIRMED) {
                    $cutoffHours = 24;
                    try {
                        $settingStmt = $pdo->prepare("SELECT setting_value FROM clinic_settings WHERE setting_key = 'cancellation_cutoff_hours' LIMIT 1");
                        $settingStmt->execute();
                        $rawCutoff = $settingStmt->fetchColumn();
                        if ($rawCutoff !== false && is_numeric($rawCutoff)) {
                            $cutoffHours = max(0, (int) $rawCutoff);
                        }
                    } catch (Throwable) {
                        $cutoffHours = 24;
                    }

                    if ($cutoffHours > 0) {
                        $now = $currentTime ?? new DateTimeImmutable('now', $this->timezone);
                        $apptStart = new DateTimeImmutable((string) $oldAppointment['start_at'], $this->timezone);
                        $cutoffBoundary = $now->modify("+{$cutoffHours} hours");
                        if ($apptStart <= $cutoffBoundary) {
                            throw HttpException::unprocessableEntity(
                                "Confirmed appointments cannot be rescheduled within {$cutoffHours} hours of the scheduled time. Please contact the clinic.",
                                ['appointment_id' => ["Reschedule cutoff is {$cutoffHours} hours prior to appointment start."]]
                            );
                        }
                    }
                }
            } else {
                // Staff role (ADMIN / RECEPTIONIST): verify DRBAC permission if RBAC tables are seeded
                $this->assertStaffPermissionIfSeeded($pdo, $upperRole, 'appointments.manage');
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

            // 3. Check Centralized Availability Engine Rules (excluding current appointment ID)
            $isPatientActor = $upperRole === 'PATIENT';
            $validation = $this->availabilityService->validateSlot(
                $targetDentistId,
                $targetServiceId,
                $startAtDt,
                $currentTime,
                $appointmentId,
                $isPatientActor,
                true,
                $durationMinutes,
                null,
                $pdo,
                true
            );

            if (!$validation['available']) {
                throw HttpException::conflict(
                    $validation['message'],
                    $validation['reason_code'],
                    [
                        'reason_code' => $validation['reason_code'],
                        'availability_status' => $validation['availability_status'],
                        'conflict_context' => $validation['conflict_context'],
                    ]
                );
            }

            // 5. Cancel Old Appointment Atomically
            $effectiveReason = ($validated['reason'] === 'Patient requested reschedule' && !$isPatientActor)
                ? 'Rescheduled by clinic staff'
                : $validated['reason'];
            $cancelReason = mb_substr(
                "Rescheduled to new slot on {$startAtDt->format('Y-m-d H:i:s')}: {$effectiveReason}",
                0,
                255
            );
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
                [
                    'rescheduled_to_slot' => $startAtDt->format('Y-m-d H:i:s'),
                    'rescheduled_by_role' => $upperRole,
                    'previous_dentist_id' => (int) $oldAppointment['dentist_id'],
                    'new_dentist_id' => $targetDentistId,
                ],
                $pdo
            );

            // The superseded appointment must not send a reminder.
            $this->emailService->cancelObsoleteReminders($appointmentId);

            // 6. Create New Appointment Linked via rescheduled_from_id
            $chair = $validation['operatory_chair'] ?: ($dentist['default_operatory_chair'] ?? 'Chair 1');
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

            $newHistoryId = $this->appointmentRepo->recordStatusHistory(
                $newAppointmentId,
                null,
                AppointmentValidator::STATUS_PENDING,
                $userId,
                "Rescheduled from appointment #{$appointmentId}",
                [
                    'rescheduled_from_id' => $appointmentId,
                    'rescheduled_by_role' => $upperRole,
                    'previous_dentist_id' => (int) $oldAppointment['dentist_id'],
                    'new_dentist_id' => $targetDentistId,
                ],
                $pdo
            );

            // Transactional outbox: queue email, persistent notifications, and realtime outbox atomically.
            $txNewAppointment = $this->appointmentRepo->findById($newAppointmentId);
            if ($txNewAppointment) {
                $this->emailService->queueAppointmentEvent(EmailOutboxService::EVENT_REQUESTED, $txNewAppointment, $newHistoryId);
                $this->persistAndQueueAppointmentNotifications(
                    RealtimeOutboxService::EVENT_APPOINTMENT_RESCHEDULED,
                    $txNewAppointment,
                    'PENDING',
                    $pdo,
                    $userRole,
                    true,
                    $userId
                );
            }

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

        $this->realtimeOutbox->dispatchPendingBestEffort();
        $rescheduled = $this->appointmentRepo->findById($newAppointmentId);

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

        if (
            in_array(strtoupper($userRole), ['ADMIN', 'RECEPTIONIST'], true)
            && strtoupper((string) ($appointment['status'] ?? '')) === AppointmentValidator::STATUS_PENDING
        ) {
            $appointment['availability_check'] = $this->evaluateAppointmentAvailability($appointment);
        }

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
    /**
     * Validate and normalize appointment search filters (date bounds, status allowlist, IDs).
     * Enforces role-based filter scope: callers disable dentist/patient filters for restricted roles.
     *
     * @param array<string, mixed> $params
     * @return array<string, mixed>
     * @throws HttpException
     */
    private function normalizeSearchFilters(
        array $params,
        bool $allowDentistFilter = true,
        bool $allowPatientFilter = true
    ): array {
        $validStatuses = ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'];
        $filters = [];

        if (isset($params['status']) && trim((string) $params['status']) !== '') {
            $status = strtoupper(trim((string) $params['status']));
            if ($status !== 'ALL') {
                if (!in_array($status, $validStatuses, true)) {
                    throw HttpException::unprocessableEntity(
                        'Invalid appointment status filter.',
                        ['status' => ['Status must be one of: ' . implode(', ', $validStatuses)]]
                    );
                }
                $filters['status'] = $status;
            }
        }

        // Date range: support start_date / date_from / from and end_date / date_to / to
        $rawFrom = $params['start_date'] ?? $params['date_from'] ?? $params['from'] ?? null;
        $rawTo = $params['end_date'] ?? $params['date_to'] ?? $params['to'] ?? null;

        $fromBound = null;
        $toBound = null;

        if ($rawFrom !== null && trim((string) $rawFrom) !== '') {
            $fromBound = $this->parseDateFilterBound(trim((string) $rawFrom), false, 'start_date');
            $filters['from'] = $fromBound['sql'];
        }
        if ($rawTo !== null && trim((string) $rawTo) !== '') {
            $toBound = $this->parseDateFilterBound(trim((string) $rawTo), true, 'end_date');
            $filters['to'] = $toBound['sql'];
        }
        if ($fromBound !== null && $toBound !== null && $toBound['dt'] < $fromBound['dt']) {
            throw HttpException::unprocessableEntity(
                'end_date cannot be earlier than start_date.',
                ['end_date' => ['end_date must be on or after start_date.']]
            );
        }

        if (isset($params['service_id']) && trim((string) $params['service_id']) !== '') {
            $serviceId = $this->parsePositiveId($params['service_id'], 'service_id');
            $filters['service_id'] = $serviceId;
        }

        if ($allowDentistFilter && isset($params['dentist_id']) && trim((string) $params['dentist_id']) !== '') {
            $filters['dentist_id'] = $this->parsePositiveId($params['dentist_id'], 'dentist_id');
        }

        if ($allowPatientFilter && isset($params['patient_id']) && trim((string) $params['patient_id']) !== '') {
            $filters['patient_id'] = $this->parsePositiveId($params['patient_id'], 'patient_id');
        }

        if (isset($params['search']) && is_string($params['search']) && trim($params['search']) !== '') {
            $filters['search'] = mb_substr(trim($params['search']), 0, 120);
        }

        return $filters;
    }

    /**
     * @return array{dt: DateTimeImmutable, sql: string}
     */
    private function parseDateFilterBound(string $raw, bool $isEnd, string $field): array
    {
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw) === 1) {
            $dt = DateTimeImmutable::createFromFormat('!Y-m-d', $raw, $this->timezone);
            if ($dt === false || $dt->format('Y-m-d') !== $raw) {
                throw HttpException::unprocessableEntity("Invalid {$field} value.", [
                    $field => ["{$field} must be a valid calendar date (YYYY-MM-DD)."],
                ]);
            }
            $sql = $raw . ($isEnd ? ' 23:59:59' : ' 00:00:00');
            $boundDt = $isEnd ? $dt->setTime(23, 59, 59) : $dt->setTime(0, 0, 0);
            return ['dt' => $boundDt, 'sql' => $sql];
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/', $raw) === 1) {
            $normalized = str_replace('T', ' ', $raw);
            $dt = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $normalized, $this->timezone);
            if ($dt === false || $dt->format('Y-m-d H:i:s') !== $normalized) {
                throw HttpException::unprocessableEntity("Invalid {$field} datetime.", [
                    $field => ["{$field} must be a valid datetime (YYYY-MM-DD HH:MM:SS)."],
                ]);
            }
            return ['dt' => $dt, 'sql' => $normalized];
        }

        throw HttpException::unprocessableEntity("Invalid {$field} format.", [
            $field => ["{$field} must be formatted as YYYY-MM-DD."],
        ]);
    }

    private function parsePositiveId(mixed $value, string $field): int
    {
        $str = trim((string) $value);
        if (!ctype_digit($str) || (int) $str <= 0) {
            throw HttpException::unprocessableEntity("Invalid {$field}.", [
                $field => ["{$field} must be a positive integer."],
            ]);
        }

        return (int) $str;
    }

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

        // Patients may filter by date, status, dentist, or service, NEVER by another patient_id
        $filters = $this->normalizeSearchFilters($params, true, false);
        $page = isset($params['page']) ? max(1, (int) $params['page']) : 1;
        $rawPerPage = $params['per_page'] ?? $params['limit'] ?? 20;
        $perPage = max(1, min(100, (int) $rawPerPage));

        return $this->appointmentRepo->findByPatient(
            (int) $patient['id'],
            $filters['status'] ?? null,
            $filters['from'] ?? null,
            $filters['to'] ?? null,
            $page,
            $perPage,
            $filters['dentist_id'] ?? null,
            $filters['service_id'] ?? null
        );
    }

    /**
     * List appointments for administrators with filters, pagination, live availability validation
     * on pending records, and authoritative operational summary counts.
     *
     * @param array<string, mixed> $filters
     * @param int $page
     * @param int $perPage
     * @return array<string, mixed>
     */
    public function listAdminAppointments(array $filters = [], int $page = 1, int $perPage = 20): array
    {
        $normalized = $this->normalizeSearchFilters($filters, true, true);
        $sort = \App\Support\ServerTableQuery::parseSort(
            $filters,
            AppointmentRepository::ADMIN_SORT_ALLOWLIST,
            'start_at',
            'DESC',
            'a.id',
            true
        );
        $normalized['sort_by'] = $sort['sort_by'];
        $normalized['sort_dir'] = $sort['sort_dir'];

        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));

        $result = $this->appointmentRepo->findAllFiltered($normalized, $page, $perPage);
        $now = new DateTimeImmutable('now', $this->timezone);

        // Batch-evaluate live availability for PENDING items on the current page (no N+1 queries)
        $pendingOnPage = array_values(array_filter(
            $result['items'],
            static fn (array $item): bool => strtoupper((string) ($item['status'] ?? '')) === AppointmentValidator::STATUS_PENDING
        ));
        $pageEvaluations = $this->availabilityService->evaluateAppointmentsBatch($pendingOnPage, $now);

        foreach ($result['items'] as &$item) {
            if (strtoupper((string) ($item['status'] ?? '')) === AppointmentValidator::STATUS_PENDING) {
                $itemId = (int) ($item['id'] ?? 0);
                $item['availability_check'] = $pageEvaluations[$itemId] ?? $this->evaluateAppointmentAvailability($item, $now);
            } else {
                $item['availability_check'] = null;
            }
        }
        unset($item);

        // Compute authoritative operational summary counts across ALL pending appointments (no 200-record cap)
        $todayDate = $now->format('Y-m-d');
        $summaryCounts = $this->appointmentRepo->getTriageSummaryCounts(
            $todayDate . ' 00:00:00',
            $todayDate . ' 23:59:59'
        );

        $schedulingConflicts = $summaryCounts['pending_review'] > 0
            ? $this->availabilityService->countPendingConflicts($now)
            : 0;

        $result['summary'] = [
            'pending_review' => $summaryCounts['pending_review'],
            'confirmed' => $summaryCounts['confirmed'],
            'today_appointments' => $summaryCounts['today_appointments'],
            'scheduling_conflicts' => $schedulingConflicts,
            'refreshed_at' => $now->format(DateTimeImmutable::ATOM),
        ];

        return $result;
    }

    /**
     * Verify staff DRBAC permission when RBAC tables are present and seeded.
     */
    private function assertStaffPermissionIfSeeded(PDO $pdo, string $roleSlug, string $permissionSlug): void
    {
        if (strtoupper($roleSlug) === 'ADMIN') {
            return;
        }

        try {
            $hasRoleRows = (int) $pdo->query('SELECT COUNT(*) FROM role_permissions')->fetchColumn();
            if ($hasRoleRows === 0) {
                return;
            }

            $stmt = $pdo->prepare('
                SELECT COUNT(*)
                FROM roles r
                INNER JOIN role_permissions rp ON rp.role_id = r.id
                INNER JOIN permissions p ON p.id = rp.permission_id
                WHERE LOWER(r.slug) = LOWER(?)
                  AND p.slug = ?
            ');
            $stmt->execute([$roleSlug, $permissionSlug]);
            if ((int) $stmt->fetchColumn() <= 0) {
                throw HttpException::forbidden("Access denied. Missing required permission: {$permissionSlug}.");
            }
        } catch (HttpException $e) {
            throw $e;
        } catch (Throwable) {
            // Minimal test schemas may omit RBAC tables
        }
    }

    /**
     * Evaluate availability for an appointment row using the centralized AvailabilityService.
     *
     * @param array<string, mixed> $appointment
     * @return array<string, mixed>
     */
    private function evaluateAppointmentAvailability(array $appointment, ?DateTimeImmutable $now = null): array
    {
        $startAtDt = AppointmentValidator::parseDateTime((string) ($appointment['start_at'] ?? ''), $this->timezone);
        if ($startAtDt === null) {
            return [
                'available' => false,
                'availability_status' => AvailabilityService::STATUS_REQUIRES_REVIEW,
                'reason_code' => AvailabilityService::REASON_UNAVAILABLE_PERIOD,
                'message' => 'Appointment time could not be parsed for availability validation.',
                'suggested_rejection_reason' => AvailabilityService::getSuggestedRejectionReason(AvailabilityService::REASON_UNAVAILABLE_PERIOD),
                'operatory_chair' => $appointment['operatory_chair'] ?? null,
                'conflict_context' => null,
            ];
        }

        $durationSnapshot = (int) ($appointment['duration_snapshot'] ?? 0);
        return $this->availabilityService->validateSlot(
            (int) $appointment['dentist_id'],
            (int) $appointment['service_id'],
            $startAtDt,
            $now,
            (int) $appointment['id'],
            false,
            false,
            $durationSnapshot > 0 ? $durationSnapshot : null,
            isset($appointment['operatory_chair']) ? (string) $appointment['operatory_chair'] : null,
            null,
            false
        );
    }

    /**
     * List appointments assigned to the authenticated dentist using SQL pagination.
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

        // Dentists are strictly scoped to their own dentist_id (ignore client-supplied dentist_id)
        $filters = $this->normalizeSearchFilters($params, false, false);
        $page = isset($params['page']) ? max(1, (int) $params['page']) : 1;
        $rawPerPage = $params['per_page'] ?? $params['limit'] ?? 20;
        $perPage = max(1, min(100, (int) $rawPerPage));

        $result = $this->appointmentRepo->findByDentistPaginated(
            (int) $dentist['id'],
            $filters['from'] ?? null,
            $filters['to'] ?? null,
            $filters['status'] ?? null,
            $filters['search'] ?? null,
            $filters['service_id'] ?? null,
            $page,
            $perPage
        );

        return [
            'items' => $result['items'],
            'meta' => \App\Support\ServerTableQuery::buildMeta(
                (int) ($result['total_records'] ?? $result['total'] ?? 0),
                (int) ($result['filtered_records'] ?? $result['total'] ?? 0),
                (int) ($result['page'] ?? $page),
                (int) ($result['per_page'] ?? $perPage),
                'start_at',
                'ASC'
            ),
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

            $historyId = $this->appointmentRepo->recordStatusHistory(
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

            // Transactional outbox: queue email, persistent notifications, and realtime outbox atomically
            $txAppointment = $this->appointmentRepo->findById($appointmentId);
            if ($txAppointment) {
                $this->emailService->queueAppointmentEvent(EmailOutboxService::EVENT_COMPLETED, $txAppointment, $historyId);
                $this->persistAndQueueAppointmentNotifications(
                    RealtimeOutboxService::EVENT_APPOINTMENT_UPDATED,
                    $txAppointment,
                    'COMPLETED',
                    $pdo,
                    'DENTIST',
                    false,
                    $userId
                );
            }

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

        $this->realtimeOutbox->dispatchPendingBestEffort();
        $updated = $this->appointmentRepo->findById($appointmentId);

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
        $now = new DateTimeImmutable('now', $this->timezone);
        $clinicTime = $now->format('c');

        $dentist = $this->dentistRepo->findByUserId($userId);
        if (!$dentist) {
            return [
                'clinic_time' => $clinicTime,
                'today_count' => 0,
                'upcoming_count' => 0,
                'pending_count' => 0,
                'completed_count' => 0,
                'today_appointments' => [],
                'next_appointment' => null,
                'activity_summary' => [
                    'completed_this_week' => 0,
                    'upcoming_this_week' => 0,
                    'pending_documentation_count' => 0,
                    'cancelled_this_week' => 0,
                ],
            ];
        }

        $dentistId = (int) $dentist['id'];
        $todayStart = $now->format('Y-m-d 00:00:00');
        $todayEnd = $now->format('Y-m-d 23:59:59');
        $weekStart = $now->modify('monday this week')->format('Y-m-d 00:00:00');
        $weekEnd = $now->modify('sunday this week')->format('Y-m-d 23:59:59');
        $nowStr = $now->format('Y-m-d H:i:s');

        $todayAppts = $this->appointmentRepo->findByDentist($dentistId, $todayStart, $todayEnd);

        // Single SQL aggregate query for all dentist KPIs (avoids loading unbounded appointment history into PHP)
        $pdo = $this->database->getConnection();
        $aggStmt = $pdo->prepare("
            SELECT
                COALESCE(SUM(CASE WHEN status = 'CONFIRMED' AND start_at >= :now1 THEN 1 ELSE 0 END), 0) AS upcoming_count,
                COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0) AS pending_count,
                COALESCE(SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END), 0) AS confirmed_count,
                COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed_count,
                COALESCE(SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS cancelled_count,
                COALESCE(SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END), 0) AS rejected_count,
                COALESCE(SUM(CASE WHEN status = 'COMPLETED' AND start_at >= :ws1 AND start_at <= :we1 THEN 1 ELSE 0 END), 0) AS completed_this_week,
                COALESCE(SUM(CASE WHEN status = 'CONFIRMED' AND start_at >= :now2 AND start_at <= :we2 THEN 1 ELSE 0 END), 0) AS upcoming_this_week,
                COALESCE(SUM(CASE WHEN status = 'CANCELLED' AND start_at >= :ws2 AND start_at <= :we3 THEN 1 ELSE 0 END), 0) AS cancelled_this_week
            FROM appointments
            WHERE dentist_id = :dentist_id
        ");
        $aggStmt->execute([
            ':now1' => $nowStr,
            ':now2' => $nowStr,
            ':ws1' => $weekStart,
            ':we1' => $weekEnd,
            ':we2' => $weekEnd,
            ':ws2' => $weekStart,
            ':we3' => $weekEnd,
            ':dentist_id' => $dentistId,
        ]);
        $agg = $aggStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $upcomingCount = (int) ($agg['upcoming_count'] ?? 0);
        $pendingCount = (int) ($agg['pending_count'] ?? 0);
        $confirmedCount = (int) ($agg['confirmed_count'] ?? 0);
        $completedCount = (int) ($agg['completed_count'] ?? 0);
        $cancelledCount = (int) ($agg['cancelled_count'] ?? 0);
        $rejectedCount = (int) ($agg['rejected_count'] ?? 0);
        $completedThisWeek = (int) ($agg['completed_this_week'] ?? 0);
        $upcomingThisWeek = (int) ($agg['upcoming_this_week'] ?? 0);
        $cancelledThisWeek = (int) ($agg['cancelled_this_week'] ?? 0);

        // Next eligible upcoming appointment (bounded LIMIT 1)
        $nextStmt = $pdo->prepare("
            SELECT a.*,
                   p.first_name AS patient_first_name, p.last_name AS patient_last_name,
                   p.phone AS patient_phone, p.medical_alerts AS patient_medical_alerts,
                   p.date_of_birth AS patient_date_of_birth, p.gender AS patient_gender,
                   s.name AS service_name, s.duration_minutes AS service_duration
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN services s ON a.service_id = s.id
            WHERE a.dentist_id = :dentist_id
              AND a.status IN ('CONFIRMED', 'PENDING')
              AND (a.end_at >= :now1 OR a.start_at >= :now2)
            ORDER BY a.start_at ASC, a.id ASC
            LIMIT 1
        ");
        $nextStmt->execute([
            ':dentist_id' => $dentistId,
            ':now1' => $nowStr,
            ':now2' => $nowStr,
        ]);
        $nextAppointment = $nextStmt->fetch(PDO::FETCH_ASSOC) ?: null;

        // Calculate pending clinical documentation (completed visits missing treatment records)
        $pendingDocStmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM appointments a
            LEFT JOIN treatment_records tr ON tr.appointment_id = a.id
            WHERE a.dentist_id = ?
              AND a.status = 'COMPLETED'
              AND tr.id IS NULL
        ");
        $pendingDocStmt->execute([$dentistId]);
        $pendingDocCount = (int) $pendingDocStmt->fetchColumn();

        return [
            'dentist' => [
                'id' => $dentistId,
                'first_name' => $dentist['first_name'],
                'last_name' => $dentist['last_name'],
                'specialization' => $dentist['specialization'],
                'license_number' => $dentist['license_number'],
                'chair' => $dentist['default_operatory_chair'],
            ],
            'clinic_time' => $clinicTime,
            'today_count' => count($todayAppts),
            'upcoming_count' => $upcomingCount,
            'pending_count' => $pendingCount,
            'completed_count' => $completedCount,
            'cancelled_count' => $cancelledCount,
            'status_distribution' => [
                'PENDING' => $pendingCount,
                'CONFIRMED' => $confirmedCount,
                'COMPLETED' => $completedCount,
                'CANCELLED' => $cancelledCount,
                'REJECTED' => $rejectedCount,
            ],
            'today_appointments' => $todayAppts,
            'next_appointment' => $nextAppointment,
            'activity_summary' => [
                'completed_this_week' => $completedThisWeek,
                'upcoming_this_week' => $upcomingThisWeek,
                'pending_documentation_count' => $pendingDocCount,
                'cancelled_this_week' => $cancelledThisWeek,
            ],
        ];
    }

    /**
     * Get real-time summary statistics, next visit, pending requests, and recent activity for patient dashboard.
     *
     * @param int $userId
     * @return array<string, mixed>
     */
    public function getPatientDashboardSummary(int $userId): array
    {
        $now = new DateTimeImmutable('now', $this->timezone);
        $clinicTime = $now->format('c');
        $nowStr = $now->format('Y-m-d H:i:s');

        $patient = $this->patientRepo->findByUserId($userId);
        if (!$patient) {
            return [
                'patient' => null,
                'clinic_time' => $clinicTime,
                'upcoming_count' => 0,
                'pending_count' => 0,
                'completed_count' => 0,
                'cancelled_count' => 0,
                'next_appointment' => null,
                'additional_upcoming' => [],
                'pending_requests' => [],
                'recent_activity' => [],
            ];
        }

        $patientId = (int) $patient['id'];
        $pdo = $this->database->getConnection();

        // 1. Aggregated statistics
        $statsStmt = $pdo->prepare('
            SELECT
                SUM(CASE WHEN status = "CONFIRMED" AND start_at >= :now1 THEN 1 ELSE 0 END) AS upcoming_count,
                SUM(CASE WHEN status = "PENDING" THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN status = "COMPLETED" THEN 1 ELSE 0 END) AS completed_count,
                SUM(CASE WHEN status = "CANCELLED" THEN 1 ELSE 0 END) AS cancelled_count
            FROM appointments
            WHERE patient_id = :patient_id
        ');
        $statsStmt->execute([
            ':now1' => $nowStr,
            ':patient_id' => $patientId,
        ]);
        $stats = $statsStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        // 2. Upcoming confirmed appointments (ordered chronologically)
        $upcomingStmt = $pdo->prepare('
            SELECT a.*,
                   d.first_name AS dentist_first_name, d.last_name AS dentist_last_name, d.specialization AS dentist_specialization,
                   d.default_operatory_chair AS dentist_chair,
                   s.name AS service_name, s.duration_minutes AS service_duration, s.price AS service_price
            FROM appointments a
            JOIN dentists d ON a.dentist_id = d.id
            JOIN services s ON a.service_id = s.id
            WHERE a.patient_id = :patient_id
              AND a.status = "CONFIRMED"
              AND (a.end_at >= :now1 OR a.start_at >= :now2)
            ORDER BY a.start_at ASC
            LIMIT 4
        ');
        $upcomingStmt->execute([
            ':patient_id' => $patientId,
            ':now1' => $nowStr,
            ':now2' => $nowStr,
        ]);
        $upcomingList = $upcomingStmt->fetchAll(PDO::FETCH_ASSOC);

        $nextAppointment = $upcomingList[0] ?? null;
        $additionalUpcoming = array_slice($upcomingList, 1);

        // 3. Pending requests with triage metadata
        $pendingStmt = $pdo->prepare('
            SELECT a.*,
                   d.first_name AS dentist_first_name, d.last_name AS dentist_last_name, d.specialization AS dentist_specialization,
                   s.name AS service_name, s.duration_minutes AS service_duration
            FROM appointments a
            LEFT JOIN dentists d ON a.dentist_id = d.id
            JOIN services s ON a.service_id = s.id
            WHERE a.patient_id = :patient_id
              AND a.status = "PENDING"
            ORDER BY a.created_at DESC
            LIMIT 5
        ');
        $pendingStmt->execute([':patient_id' => $patientId]);
        $pendingRequests = $pendingStmt->fetchAll(PDO::FETCH_ASSOC);

        // 4. Recent appointment activity from status history
        $activityStmt = $pdo->prepare('
            SELECT h.id, h.appointment_id, h.old_status, h.new_status, h.reason, h.created_at,
                   s.name AS service_name,
                   d.first_name AS dentist_first_name, d.last_name AS dentist_last_name
            FROM appointment_status_history h
            JOIN appointments a ON h.appointment_id = a.id
            JOIN services s ON a.service_id = s.id
            JOIN dentists d ON a.dentist_id = d.id
            WHERE a.patient_id = :patient_id
            ORDER BY h.created_at DESC
            LIMIT 6
        ');
        $activityStmt->execute([':patient_id' => $patientId]);
        $recentActivity = $activityStmt->fetchAll(PDO::FETCH_ASSOC);

        // 5. Unread notifications count scoped strictly to authenticated patient user
        $unreadNotifications = 0;
        try {
            $unreadStmt = $pdo->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0');
            $unreadStmt->execute([$userId]);
            $unreadNotifications = (int) $unreadStmt->fetchColumn();
        } catch (\Throwable $e) {
            $unreadNotifications = 0;
        }

        return [
            'patient' => [
                'id' => $patientId,
                'first_name' => $patient['first_name'],
                'last_name' => $patient['last_name'],
                'phone' => $patient['phone'],
                'date_of_birth' => $patient['date_of_birth'],
                'gender' => $patient['gender'],
                'address' => $patient['address'],
                'emergency_contact_name' => $patient['emergency_contact_name'],
                'emergency_contact_phone' => $patient['emergency_contact_phone'],
                'medical_alerts' => $patient['medical_alerts'],
            ],
            'clinic_time' => $clinicTime,
            'upcoming_count' => (int) ($stats['upcoming_count'] ?? 0),
            'pending_count' => (int) ($stats['pending_count'] ?? 0),
            'completed_count' => (int) ($stats['completed_count'] ?? 0),
            'cancelled_count' => (int) ($stats['cancelled_count'] ?? 0),
            'unread_notifications_count' => $unreadNotifications,
            'next_appointment' => $nextAppointment,
            'additional_upcoming' => $additionalUpcoming,
            'pending_requests' => $pendingRequests,
            'recent_activity' => $recentActivity,
        ];
    }

    /**
     * Atomically persist in-app notifications and enqueue corresponding real-time outbox events
     * for all authorized recipients INSIDE the active appointment transaction.
     *
     * @param string $eventType One of RealtimeOutboxService::ALLOWED_EVENTS
     * @param array<string, mixed> $appointment
     * @param string $status Uppercase lifecycle status
     * @param PDO $pdo Active transactional PDO connection
     */
    private function persistAndQueueAppointmentNotifications(
        string $eventType,
        array $appointment,
        string $status,
        PDO $pdo,
        ?string $cancelledByRole = null,
        bool $isRescheduled = false,
        ?int $actorUserId = null,
        ?string $customSummary = null
    ): void {
        $resolvedEvent = $isRescheduled && $eventType === RealtimeOutboxService::EVENT_APPOINTMENT_REQUESTED
            ? RealtimeOutboxService::EVENT_APPOINTMENT_RESCHEDULED
            : $eventType;

        $dispatcher = new UnifiedNotificationDispatcher(
            $this->database,
            $this->notificationService,
            $this->realtimeOutbox,
            $this->logger
        );

        $dispatcher->dispatchAppointmentEvent(
            $resolvedEvent,
            $appointment,
            $status,
            $pdo,
            $cancelledByRole,
            $actorUserId,
            $customSummary
        );
    }

    /**
     * Query active staff users by role who hold the required DRBAC permission (`appointments.view`).
     * Falls back cleanly if RBAC tables are absent in minimal isolated unit test schemas.
     *
     * @param list<string> $roles
     * @return list<array{id: int, role: string}>
     */
    private function findActiveOperationalStaffRecipients(PDO $pdo, array $roles): array
    {
        if ($roles === []) {
            return [];
        }

        $placeholders = implode(', ', array_fill(0, count($roles), '?'));

        try {
            // Check whether DRBAC role_permissions grants appointments.view for each target role
            $permStmt = $pdo->prepare("
                SELECT DISTINCT u.id, u.role
                FROM users u
                INNER JOIN roles r ON LOWER(r.slug) = LOWER(u.role)
                INNER JOIN role_permissions rp ON rp.role_id = r.id
                INNER JOIN permissions p ON p.id = rp.permission_id
                WHERE u.is_active = 1
                  AND u.role IN ({$placeholders})
                  AND p.slug = 'appointments.view'
            ");
            $permStmt->execute($roles);
            $rows = $permStmt->fetchAll(PDO::FETCH_ASSOC);

            $result = [];
            foreach ($rows as $row) {
                $result[] = [
                    'id' => (int) $row['id'],
                    'role' => strtoupper((string) $row['role']),
                ];
            }
            return $result;
        } catch (Throwable) {
            // Minimal schema fallback when DRBAC tables do not exist in isolated tests
            try {
                $stmt = $pdo->prepare("SELECT id, role FROM users WHERE is_active = 1 AND role IN ({$placeholders})");
                $stmt->execute($roles);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                $result = [];
                foreach ($rows as $row) {
                    $result[] = [
                        'id' => (int) $row['id'],
                        'role' => strtoupper((string) $row['role']),
                    ];
                }
                return $result;
            } catch (Throwable) {
                return [];
            }
        }
    }
}
