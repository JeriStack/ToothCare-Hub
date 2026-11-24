<?php

declare(strict_types=1);

namespace App\Services\Notifications;

use App\Core\Database;
use App\Core\Logger;
use App\Repositories\NotificationRepository;
use App\Services\NotificationService;
use App\Services\Realtime\RealtimeOutboxService;
use PDO;
use Throwable;

/**
 * Centralized Role-Aware Notification & Real-Time Event Dispatcher.
 *
 * Single source of truth for:
 * - Server-side recipient resolution across ADMIN, RECEPTIONIST, DENTIST, and PATIENT
 * - DRBAC permission filtering for operational staff recipients
 * - Atomic persistence into `notifications` + `realtime_outbox` inside caller transactions
 * - Strict exclusion of clinical notes, diagnoses, passwords, and sensitive PII from payloads
 */
class UnifiedNotificationDispatcher
{
    private Database $database;
    private NotificationService $notificationService;
    private RealtimeOutboxService $realtimeOutbox;
    private Logger $logger;

    public function __construct(
        ?Database $database = null,
        ?NotificationService $notificationService = null,
        ?RealtimeOutboxService $realtimeOutbox = null,
        ?Logger $logger = null
    ) {
        $this->database = $database ?? Database::getInstance();
        $this->logger = $logger ?? Logger::getInstance();
        $this->notificationService = $notificationService ?? new NotificationService(
            new NotificationRepository($this->database),
            $this->logger
        );
        $this->realtimeOutbox = $realtimeOutbox ?? new RealtimeOutboxService(
            null,
            null,
            null,
            $this->logger,
            $this->database
        );
    }

    /**
     * Persist notifications and enqueue real-time outbox events for appointment lifecycle transitions
     * INSIDE the caller's active PDO transaction.
     *
     * @param string $eventType One of RealtimeOutboxService::ALLOWED_EVENTS
     * @param array<string, mixed> $appointment
     */
    public function dispatchAppointmentEvent(
        string $eventType,
        array $appointment,
        string $status,
        PDO $pdo,
        ?string $actorRole = null,
        ?int $actorUserId = null,
        ?string $customSummary = null
    ): void {
        $appointmentId = (int) ($appointment['id'] ?? 0);
        if ($appointmentId <= 0) {
            return;
        }

        $serviceName = (string) ($appointment['service_name'] ?? 'Dental Consultation');
        $startAt = (string) ($appointment['start_at'] ?? '');
        $patientUserId = !empty($appointment['patient_user_id']) ? (int) $appointment['patient_user_id'] : 0;
        $dentistUserId = !empty($appointment['dentist_user_id']) ? (int) $appointment['dentist_user_id'] : 0;
        $upperActorRole = $actorRole !== null ? strtoupper($actorRole) : null;
        $upperStatus = strtoupper($status);

        /** @var list<array{user_id: int, role: string, type: string, title: string, message: string, persist?: bool}> $targets */
        $targets = [];

        if ($eventType === RealtimeOutboxService::EVENT_APPOINTMENT_REQUESTED) {
            if ($patientUserId > 0) {
                $targets[] = [
                    'user_id' => $patientUserId,
                    'role' => 'PATIENT',
                    'type' => 'APPOINTMENT_REQUESTED',
                    'title' => 'Appointment Request Submitted',
                    'message' => "Your appointment request for {$serviceName} on {$startAt} has been received.",
                ];
            }
            if ($dentistUserId > 0) {
                $targets[] = [
                    'user_id' => $dentistUserId,
                    'role' => 'DENTIST',
                    'type' => 'APPOINTMENT_REQUESTED',
                    'title' => 'New Appointment Request',
                    'message' => "A new appointment request for {$serviceName} on {$startAt} has been assigned.",
                ];
            }
            foreach ($this->findAuthorizedStaffRecipients($pdo, ['RECEPTIONIST', 'ADMIN'], 'appointments.view') as $staff) {
                $targets[] = [
                    'user_id' => $staff['id'],
                    'role' => $staff['role'],
                    'type' => 'APPOINTMENT_REQUESTED',
                    'title' => 'New Appointment Pending Review',
                    'message' => "Appointment request #{$appointmentId} ({$serviceName}) for {$startAt} requires front-desk review.",
                ];
            }
        } elseif ($eventType === RealtimeOutboxService::EVENT_APPOINTMENT_RESCHEDULED) {
            if ($patientUserId > 0) {
                $targets[] = [
                    'user_id' => $patientUserId,
                    'role' => 'PATIENT',
                    'type' => 'APPOINTMENT_RESCHEDULED',
                    'title' => 'Appointment Rescheduled',
                    'message' => "Your appointment for {$serviceName} has been rescheduled to {$startAt}.",
                ];
            }
            if ($dentistUserId > 0) {
                $targets[] = [
                    'user_id' => $dentistUserId,
                    'role' => 'DENTIST',
                    'type' => 'APPOINTMENT_RESCHEDULED',
                    'title' => 'Assigned Appointment Rescheduled',
                    'message' => "Appointment #{$appointmentId} ({$serviceName}) has been rescheduled to {$startAt}.",
                ];
            }
            foreach ($this->findAuthorizedStaffRecipients($pdo, ['RECEPTIONIST', 'ADMIN'], 'appointments.view') as $staff) {
                $targets[] = [
                    'user_id' => $staff['id'],
                    'role' => $staff['role'],
                    'type' => 'APPOINTMENT_RESCHEDULED',
                    'title' => 'Appointment Rescheduled',
                    'message' => "Appointment #{$appointmentId} ({$serviceName}) was rescheduled to {$startAt}.",
                ];
            }
        } elseif ($eventType === RealtimeOutboxService::EVENT_APPOINTMENT_CONFIRMED) {
            if ($patientUserId > 0) {
                $targets[] = [
                    'user_id' => $patientUserId,
                    'role' => 'PATIENT',
                    'type' => 'APPOINTMENT_CONFIRMED',
                    'title' => 'Appointment Confirmed',
                    'message' => "Your appointment for {$serviceName} on {$startAt} has been confirmed.",
                ];
            }
            if ($dentistUserId > 0) {
                $targets[] = [
                    'user_id' => $dentistUserId,
                    'role' => 'DENTIST',
                    'type' => 'APPOINTMENT_CONFIRMED',
                    'title' => 'Appointment Confirmed',
                    'message' => "Appointment #{$appointmentId} ({$serviceName}) on {$startAt} has been confirmed.",
                ];
            }
            foreach ($this->findAuthorizedStaffRecipients($pdo, ['RECEPTIONIST', 'ADMIN'], 'appointments.view') as $staff) {
                $isActor = $actorUserId !== null && $staff['id'] === $actorUserId;
                $targets[] = [
                    'user_id' => $staff['id'],
                    'role' => $staff['role'],
                    'type' => 'APPOINTMENT_CONFIRMED',
                    'title' => 'Appointment Confirmed',
                    'message' => "Appointment #{$appointmentId} ({$serviceName}) on {$startAt} was confirmed.",
                    'persist' => !$isActor,
                ];
            }
        } elseif ($eventType === RealtimeOutboxService::EVENT_APPOINTMENT_REJECTED) {
            $reasonSuffix = ($customSummary !== null && trim($customSummary) !== '')
                ? ' Reason: ' . trim($customSummary)
                : '';
            if ($patientUserId > 0) {
                $targets[] = [
                    'user_id' => $patientUserId,
                    'role' => 'PATIENT',
                    'type' => 'APPOINTMENT_REJECTED',
                    'title' => 'Appointment Request Declined',
                    'message' => "Your appointment request for {$serviceName} on {$startAt} could not be approved.{$reasonSuffix}",
                ];
            }
            if ($dentistUserId > 0) {
                $targets[] = [
                    'user_id' => $dentistUserId,
                    'role' => 'DENTIST',
                    'type' => 'APPOINTMENT_REJECTED',
                    'title' => 'Appointment Request Declined',
                    'message' => "Pending appointment request #{$appointmentId} ({$serviceName}) on {$startAt} was declined.",
                ];
            }
            foreach ($this->findAuthorizedStaffRecipients($pdo, ['RECEPTIONIST', 'ADMIN'], 'appointments.view') as $staff) {
                $isActor = $actorUserId !== null && $staff['id'] === $actorUserId;
                $targets[] = [
                    'user_id' => $staff['id'],
                    'role' => $staff['role'],
                    'type' => 'APPOINTMENT_REJECTED',
                    'title' => 'Appointment Declined',
                    'message' => "Appointment request #{$appointmentId} ({$serviceName}) was declined.",
                    'persist' => !$isActor,
                ];
            }
        } elseif ($eventType === RealtimeOutboxService::EVENT_APPOINTMENT_CANCELLED) {
            if ($patientUserId > 0) {
                $targets[] = [
                    'user_id' => $patientUserId,
                    'role' => 'PATIENT',
                    'type' => 'APPOINTMENT_CANCELLED',
                    'title' => 'Appointment Cancelled',
                    'message' => "Your appointment for {$serviceName} on {$startAt} has been cancelled.",
                ];
            }
            if ($dentistUserId > 0) {
                $targets[] = [
                    'user_id' => $dentistUserId,
                    'role' => 'DENTIST',
                    'type' => 'APPOINTMENT_CANCELLED',
                    'title' => 'Appointment Cancelled',
                    'message' => "Appointment #{$appointmentId} ({$serviceName}) on {$startAt} was cancelled.",
                ];
            }
            $cancelSourceLabel = $upperActorRole === 'PATIENT' ? 'by the patient' : 'by clinic staff';
            foreach ($this->findAuthorizedStaffRecipients($pdo, ['RECEPTIONIST', 'ADMIN'], 'appointments.view') as $staff) {
                $isActor = $actorUserId !== null && $staff['id'] === $actorUserId;
                $targets[] = [
                    'user_id' => $staff['id'],
                    'role' => $staff['role'],
                    'type' => 'APPOINTMENT_CANCELLED',
                    'title' => $upperActorRole === 'PATIENT' ? 'Patient Cancelled Appointment' : 'Appointment Cancelled',
                    'message' => "Appointment #{$appointmentId} ({$serviceName}) on {$startAt} was cancelled {$cancelSourceLabel}.",
                    'persist' => !$isActor,
                ];
            }
        } elseif (
            $eventType === RealtimeOutboxService::EVENT_APPOINTMENT_UPDATED ||
            $eventType === RealtimeOutboxService::EVENT_NOTIFICATION_CREATED
        ) {
            $isCompleted = $upperStatus === 'COMPLETED';
            $notifType = $isCompleted ? 'APPOINTMENT_COMPLETED' : 'APPOINTMENT_UPDATED';
            $patientTitle = $isCompleted ? 'Appointment Completed' : 'Appointment Status Updated';
            $patientMsg = $customSummary ?? ($isCompleted
                ? "Your visit for {$serviceName} on {$startAt} is complete. Thank you for visiting ToothCare Hub!"
                : "Your appointment for {$serviceName} on {$startAt} has been updated ({$upperStatus}).");

            if ($patientUserId > 0) {
                $targets[] = [
                    'user_id' => $patientUserId,
                    'role' => 'PATIENT',
                    'type' => $notifType,
                    'title' => $patientTitle,
                    'message' => $patientMsg,
                ];
            }
            if ($dentistUserId > 0) {
                $isActor = $actorUserId !== null && $dentistUserId === $actorUserId;
                $targets[] = [
                    'user_id' => $dentistUserId,
                    'role' => 'DENTIST',
                    'type' => $notifType,
                    'title' => $isCompleted ? 'Appointment Completed' : 'Patient Visit Status Updated',
                    'message' => $customSummary ?? "Appointment #{$appointmentId} ({$serviceName}) status changed to {$upperStatus}.",
                    'persist' => !$isActor,
                ];
            }
            foreach ($this->findAuthorizedStaffRecipients($pdo, ['RECEPTIONIST', 'ADMIN'], 'appointments.view') as $staff) {
                $isActor = $actorUserId !== null && $staff['id'] === $actorUserId;
                $targets[] = [
                    'user_id' => $staff['id'],
                    'role' => $staff['role'],
                    'type' => $notifType,
                    'title' => $isCompleted ? 'Appointment Completed' : 'Appointment Status Updated',
                    'message' => $customSummary ?? "Appointment #{$appointmentId} ({$serviceName}) updated to {$upperStatus}.",
                    'persist' => !$isActor,
                ];
            }
        }

        $this->persistAndEnqueueTargets(
            $eventType,
            $targets,
            'appointments',
            $appointmentId,
            [
                'appointmentId' => $appointmentId,
                'entityType' => 'appointments',
                'entityId' => $appointmentId,
                'status' => strtolower($status),
            ],
            $pdo
        );
    }

    /**
     * Dispatch schedule/availability changes to the affected dentist and authorized operational staff.
     */
    public function dispatchScheduleUpdated(
        int $dentistId,
        int $entityId,
        string $actionSummary,
        string $status,
        ?int $actorUserId = null,
        ?PDO $pdo = null
    ): void {
        $conn = $pdo ?? $this->database->getConnection();
        $targets = [];

        $dentistUserId = $this->findDentistUserId($conn, $dentistId);
        if ($dentistUserId !== null && $dentistUserId > 0) {
            $isActor = $actorUserId !== null && $dentistUserId === $actorUserId;
            $targets[] = [
                'user_id' => $dentistUserId,
                'role' => 'DENTIST',
                'type' => 'SCHEDULE_UPDATED',
                'title' => 'Your Schedule Was Updated',
                'message' => $actionSummary,
                'persist' => !$isActor,
            ];
        }

        foreach ($this->findAuthorizedStaffRecipients($conn, ['RECEPTIONIST', 'ADMIN'], 'dentists.view') as $staff) {
            $isActor = $actorUserId !== null && $staff['id'] === $actorUserId;
            $targets[] = [
                'user_id' => $staff['id'],
                'role' => $staff['role'],
                'type' => 'SCHEDULE_UPDATED',
                'title' => 'Dentist Schedule Updated',
                'message' => $actionSummary,
                'persist' => !$isActor,
            ];
        }

        $this->persistAndEnqueueTargets(
            RealtimeOutboxService::EVENT_SCHEDULE_UPDATED,
            $targets,
            'schedules',
            $entityId > 0 ? $entityId : $dentistId,
            [
                'entityType' => 'schedules',
                'entityId' => $entityId > 0 ? $entityId : $dentistId,
                'status' => strtolower($status),
            ],
            $conn
        );
    }

    /**
     * Dispatch dental service catalog changes to authorized Administrators and Receptionists.
     */
    public function dispatchServiceUpdated(
        int $serviceId,
        string $serviceName,
        string $status,
        ?int $actorUserId = null,
        ?PDO $pdo = null
    ): void {
        $conn = $pdo ?? $this->database->getConnection();
        $upperStatus = strtoupper($status);
        $title = match ($upperStatus) {
            'CREATED' => 'New Dental Service Added',
            'DEACTIVATED' => 'Dental Service Deactivated',
            'ACTIVATED' => 'Dental Service Activated',
            default => 'Dental Service Updated',
        };
        $message = match ($upperStatus) {
            'CREATED' => "Dental service \"{$serviceName}\" has been added to the clinic catalog.",
            'DEACTIVATED' => "Dental service \"{$serviceName}\" has been deactivated.",
            'ACTIVATED' => "Dental service \"{$serviceName}\" has been reactivated.",
            default => "Dental service \"{$serviceName}\" details were updated.",
        };

        $targets = [];
        foreach ($this->findAuthorizedStaffRecipients($conn, ['ADMIN', 'RECEPTIONIST'], 'services.view') as $staff) {
            $isActor = $actorUserId !== null && $staff['id'] === $actorUserId;
            $targets[] = [
                'user_id' => $staff['id'],
                'role' => $staff['role'],
                'type' => 'SERVICE_UPDATED',
                'title' => $title,
                'message' => $message,
                'persist' => !$isActor,
            ];
        }

        $this->persistAndEnqueueTargets(
            RealtimeOutboxService::EVENT_SERVICE_UPDATED,
            $targets,
            'services',
            $serviceId,
            [
                'entityType' => 'services',
                'entityId' => $serviceId,
                'status' => strtolower($status),
            ],
            $conn
        );
    }

    /**
     * Dispatch account creation or management events strictly to authorized Administrators
     * (and to the affected user on non-deactivating account updates).
     */
    public function dispatchAccountEvent(
        string $eventType,
        int $targetUserId,
        string $targetRole,
        string $title,
        string $message,
        string $status,
        ?int $actorUserId = null,
        bool $notifyTargetUser = false,
        ?PDO $pdo = null
    ): void {
        $conn = $pdo ?? $this->database->getConnection();
        $notifType = $eventType === RealtimeOutboxService::EVENT_ACCOUNT_CREATED ? 'ACCOUNT_CREATED' : 'ACCOUNT_UPDATED';
        $targets = [];

        foreach ($this->findAuthorizedStaffRecipients($conn, ['ADMIN'], 'users.view') as $admin) {
            $isActor = $actorUserId !== null && $admin['id'] === $actorUserId;
            $targets[] = [
                'user_id' => $admin['id'],
                'role' => $admin['role'],
                'type' => $notifType,
                'title' => $title,
                'message' => $message,
                'persist' => !$isActor,
            ];
        }

        if ($notifyTargetUser && $targetUserId > 0) {
            $targets[] = [
                'user_id' => $targetUserId,
                'role' => strtoupper($targetRole),
                'type' => $notifType,
                'title' => $title,
                'message' => $message,
                'persist' => true,
            ];
        }

        $this->persistAndEnqueueTargets(
            $eventType,
            $targets,
            'accounts',
            $targetUserId,
            [
                'entityType' => 'accounts',
                'entityId' => $targetUserId,
                'status' => strtolower($status),
            ],
            $conn
        );
    }

    /**
     * Best-effort post-commit dispatch to Socket.IO. Must NEVER be called inside an open DB transaction.
     */
    public function dispatchPendingAfterCommit(): void
    {
        try {
            $this->realtimeOutbox->dispatchPendingBestEffort();
        } catch (Throwable) {
            // Outage-resilient: realtime-worker will process queued events
        }
    }

    /**
     * @param list<array{user_id: int, role: string, type: string, title: string, message: string, persist?: bool}> $targets
     * @param array<string, mixed> $outboxMeta
     */
    private function persistAndEnqueueTargets(
        string $eventType,
        array $targets,
        string $referenceType,
        ?int $referenceId,
        array $outboxMeta,
        PDO $pdo
    ): void {
        $seenUsers = [];
        foreach ($targets as $target) {
            $uid = (int) $target['user_id'];
            if ($uid <= 0 || isset($seenUsers[$uid])) {
                continue;
            }
            $seenUsers[$uid] = true;

            $shouldPersist = !array_key_exists('persist', $target) || (bool) $target['persist'];
            $notificationId = null;

            if ($shouldPersist) {
                $createdId = $this->notificationService->createNotification(
                    $uid,
                    $target['role'],
                    $target['type'],
                    $target['title'],
                    $target['message'],
                    $referenceType,
                    $referenceId,
                    $pdo
                );
                if ($createdId > 0) {
                    $notificationId = $createdId;
                }
            }

            try {
                $this->realtimeOutbox->enqueue(
                    $eventType,
                    $uid,
                    $notificationId,
                    $outboxMeta,
                    $pdo
                );
            } catch (Throwable $e) {
                $this->logger->warning('Failed to enqueue realtime outbox event', [
                    'event_type' => $eventType,
                    'recipient_user_id' => $uid,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * Server-side DRBAC-aware lookup of active staff users permitted to receive an event.
     *
     * @param list<string> $roles
     * @return list<array{id: int, role: string}>
     */
    public function findAuthorizedStaffRecipients(PDO $pdo, array $roles, string $requiredPermission): array
    {
        if ($roles === []) {
            return [];
        }

        $placeholders = implode(', ', array_fill(0, count($roles), '?'));

        try {
            $permStmt = $pdo->prepare("
                SELECT DISTINCT u.id, u.role
                FROM users u
                INNER JOIN roles r ON LOWER(r.slug) = LOWER(u.role)
                INNER JOIN role_permissions rp ON rp.role_id = r.id
                INNER JOIN permissions p ON p.id = rp.permission_id
                WHERE u.is_active = 1
                  AND UPPER(u.role) IN ({$placeholders})
                  AND p.slug = ?
            ");
            $permStmt->execute(array_merge($roles, [$requiredPermission]));
            $rows = $permStmt->fetchAll(PDO::FETCH_ASSOC);

            if (!empty($rows)) {
                return array_map(static fn (array $r): array => [
                    'id' => (int) $r['id'],
                    'role' => strtoupper((string) $r['role']),
                ], $rows);
            }

            // Distinguish "RBAC explicitly revoked this permission" vs "RBAC tables unseeded"
            $hasRoleRows = (int) $pdo->query('SELECT COUNT(*) FROM role_permissions')->fetchColumn();
            if ($hasRoleRows > 0) {
                return [];
            }
        } catch (Throwable) {
            // Minimal test schemas may omit RBAC tables
        }

        try {
            $stmt = $pdo->prepare("
                SELECT id, role
                FROM users
                WHERE is_active = 1
                  AND UPPER(role) IN ({$placeholders})
            ");
            $stmt->execute($roles);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return array_map(static fn (array $r): array => [
                'id' => (int) $r['id'],
                'role' => strtoupper((string) $r['role']),
            ], $rows);
        } catch (Throwable) {
            return [];
        }
    }

    private function findDentistUserId(PDO $pdo, int $dentistId): ?int
    {
        if ($dentistId <= 0) {
            return null;
        }

        try {
            $stmt = $pdo->prepare('SELECT user_id FROM dentists WHERE id = ? LIMIT 1');
            $stmt->execute([$dentistId]);
            $uid = $stmt->fetchColumn();
            return $uid !== false && $uid !== null ? (int) $uid : null;
        } catch (Throwable) {
            return null;
        }
    }
}
