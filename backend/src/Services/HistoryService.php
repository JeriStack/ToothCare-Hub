<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\HttpException;
use App\Repositories\AppointmentRepository;
use App\Repositories\AuditLogRepository;
use App\Repositories\DentistRepository;
use App\Repositories\HistoryRepository;
use App\Repositories\PatientRepository;
use App\Repositories\UserRepository;
use App\Support\ServerTableQuery;
use DateTimeImmutable;
use DateTimeZone;

/**
 * History Records & Individual Record Timeline Service
 *
 * Distinct from forensic Audit Trail and Archive Management:
 * - Presents human-readable chronological account & business record lifecycles
 * - Computes structured Before -> After diffs while stripping passwords, tokens,
 *   and full clinical notes (Phase 3.4 & 3.5 privacy safeguards)
 * - Displays all timestamps consistently in Asia/Manila
 * - Enforces strict DRBAC & object-level ownership checks
 */
class HistoryService
{
    /** Clinical & secret fields excluded from general-purpose history detail payloads */
    private const REDACTED_HISTORY_FIELDS = [
        'password',
        'password_hash',
        'new_password',
        'current_password',
        'token',
        'token_hash',
        'csrf_token',
        'session_id',
        'secret',
        'api_key',
        'otp',
        'ticket',
        'ticket_hash',
        'websocket_ticket',
        'procedure_notes',
        'diagnosis',
        'prescription_notes',
        'home_care_advice',
        'clinical_notes',
        'medical_history',
    ];

    private const ALLOWED_CATEGORIES = ['PATIENT', 'STAFF', 'APPOINTMENT', 'SECURITY', 'ADMIN'];
    private const ALLOWED_ROLES = ['ADMIN', 'RECEPTIONIST', 'DENTIST', 'PATIENT', 'SYSTEM'];
    private const ALLOWED_RESULTS = ['SUCCESS', 'FAILED', 'DENIED', 'WARNING'];

    private HistoryRepository $historyRepo;
    private AuditLogRepository $auditRepo;
    private PatientRepository $patientRepo;
    private DentistRepository $dentistRepo;
    private UserRepository $userRepo;
    private AppointmentRepository $appointmentRepo;
    private DateTimeZone $manilaTz;

    public function __construct(?Database $database = null)
    {
        $db = $database ?? Database::getInstance();
        $this->historyRepo = new HistoryRepository($db);
        $this->auditRepo = new AuditLogRepository($db);
        $this->patientRepo = new PatientRepository($db);
        $this->dentistRepo = new DentistRepository($db);
        $this->userRepo = new UserRepository($db);
        $this->appointmentRepo = new AppointmentRepository($db);
        $this->manilaTz = new DateTimeZone('Asia/Manila');
    }

    /**
     * Resolve strict actor scope for History Records queries.
     *
     * @param array<string, mixed> $user
     * @return array{role: string, user_id: int, patient_id: ?int, dentist_id: ?int}
     */
    public function resolveActorScope(array $user): array
    {
        $role = strtoupper((string) ($user['role'] ?? 'PATIENT'));
        $userId = (int) ($user['id'] ?? 0);
        $patientId = null;
        $dentistId = null;

        if ($role === 'PATIENT' && $userId > 0) {
            $patient = $this->patientRepo->findByUserId($userId);
            $patientId = $patient ? (int) $patient['id'] : null;
        } elseif ($role === 'DENTIST' && $userId > 0) {
            $dentist = $this->dentistRepo->findByUserId($userId);
            $dentistId = $dentist ? (int) $dentist['id'] : null;
        }

        return [
            'role' => $role,
            'user_id' => $userId,
            'patient_id' => $patientId,
            'dentist_id' => $dentistId,
        ];
    }

    /**
     * Return database-calculated History Records dashboard KPIs.
     *
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    public function getSummary(array $user): array
    {
        $scope = $this->resolveActorScope($user);
        $counts = $this->historyRepo->summaryForActor($scope);

        return array_merge($counts, [
            'role' => $scope['role'],
            'timezone' => 'Asia/Manila',
        ]);
    }

    /**
     * List server-side paginated, searchable, filterable History Records.
     *
     * @param array<string, mixed> $user
     * @param array<string, mixed> $query
     * @return array{data: list<array<string, mixed>>, meta: array<string, mixed>}
     */
    public function listHistory(array $user, array $query): array
    {
        $scope = $this->resolveActorScope($user);
        $paging = ServerTableQuery::parsePagination($query, 10, 100);
        $sort = ServerTableQuery::parseSort(
            $query,
            HistoryRepository::SORT_ALLOWLIST,
            'created_at',
            'DESC',
            'al.id',
            true
        );

        $filters = [
            'sort_by' => $sort['sort_by'],
            'sort_dir' => $sort['sort_dir'],
        ];

        if (isset($query['actor_user_id']) && trim((string) $query['actor_user_id']) !== '') {
            $uid = (int) $query['actor_user_id'];
            if ($uid <= 0) {
                throw HttpException::unprocessableEntity('actor_user_id must be a positive integer.', [
                    'actor_user_id' => ['actor_user_id must be a positive integer.'],
                ]);
            }
            $filters['actor_user_id'] = $uid;
        }

        if (isset($query['actor_role']) && trim((string) $query['actor_role']) !== '') {
            $r = strtoupper(trim((string) $query['actor_role']));
            if (!in_array($r, self::ALLOWED_ROLES, true)) {
                throw HttpException::unprocessableEntity('Invalid actor_role filter.', [
                    'actor_role' => ['Allowed roles: ' . implode(', ', self::ALLOWED_ROLES)],
                ]);
            }
            $filters['actor_role'] = $r;
        }

        if (isset($query['category']) && trim((string) $query['category']) !== '') {
            $cat = strtoupper(trim((string) $query['category']));
            if (!in_array($cat, self::ALLOWED_CATEGORIES, true)) {
                throw HttpException::unprocessableEntity('Invalid category filter.', [
                    'category' => ['Allowed categories: ' . implode(', ', self::ALLOWED_CATEGORIES)],
                ]);
            }
            $filters['category'] = $cat;
        }

        if (isset($query['action']) && trim((string) $query['action']) !== '') {
            $filters['action'] = strtoupper(trim((string) $query['action']));
        }

        if (isset($query['module']) && trim((string) $query['module']) !== '') {
            $mod = strtolower(trim((string) $query['module']));
            if (!array_key_exists($mod, HistoryRepository::MODULE_TARGET_TYPES)) {
                throw HttpException::unprocessableEntity('Invalid module filter.', [
                    'module' => ['Allowed modules: ' . implode(', ', array_keys(HistoryRepository::MODULE_TARGET_TYPES))],
                ]);
            }
            $filters['module'] = $mod;
        }

        if (isset($query['result']) && trim((string) $query['result']) !== '') {
            $res = strtoupper(trim((string) $query['result']));
            if (!in_array($res, self::ALLOWED_RESULTS, true)) {
                throw HttpException::unprocessableEntity('Invalid result filter.', [
                    'result' => ['Allowed results: ' . implode(', ', self::ALLOWED_RESULTS)],
                ]);
            }
            $filters['result'] = $res;
        }

        if (isset($query['entity_type']) && trim((string) $query['entity_type']) !== '') {
            $filters['entity_type'] = strtolower(trim((string) $query['entity_type']));
        }
        if (isset($query['entity_id']) && trim((string) $query['entity_id']) !== '') {
            $eid = (int) $query['entity_id'];
            if ($eid <= 0) {
                throw HttpException::unprocessableEntity('entity_id must be a positive integer.', [
                    'entity_id' => ['entity_id must be a positive integer.'],
                ]);
            }
            $filters['entity_id'] = $eid;
        }
        if (isset($query['record_ref']) && trim((string) $query['record_ref']) !== '') {
            $ref = trim((string) $query['record_ref']);
            if (preg_match('/^([a-z_]+)[:#-](\d+)$/i', $ref, $m)) {
                $filters['entity_type'] = strtolower($m[1]);
                $filters['entity_id'] = (int) $m[2];
            } else {
                $filters['search'] = $ref;
            }
        }

        if (isset($query['search']) && trim((string) $query['search']) !== '') {
            $filters['search'] = trim((string) $query['search']);
        }

        $dateFrom = isset($query['date_from']) && trim((string) $query['date_from']) !== '' ? trim((string) $query['date_from']) : '';
        $dateTo = isset($query['date_to']) && trim((string) $query['date_to']) !== '' ? trim((string) $query['date_to']) : '';
        if ($dateFrom !== '') {
            $this->assertValidDate($dateFrom, 'date_from');
            $filters['date_from'] = $dateFrom;
        }
        if ($dateTo !== '') {
            $this->assertValidDate($dateTo, 'date_to');
            $filters['date_to'] = $dateTo;
        }
        if ($dateFrom !== '' && $dateTo !== '' && $dateTo < $dateFrom) {
            throw HttpException::unprocessableEntity('date_to cannot be earlier than date_from.', [
                'date_to' => ['date_to must be on or after date_from.'],
            ]);
        }

        $res = $this->historyRepo->listForActor($scope, $filters, $paging['page'], $paging['per_page']);
        $rows = array_map(
            fn (array $row): array => $this->presentHistoryEvent($row, $scope['role']),
            $res['data']
        );

        return [
            'data' => $rows,
            'meta' => $res['meta'],
        ];
    }

    /**
     * Inspect a single history event with structured previous/updated value comparison.
     *
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    public function getEventDetail(array $user, int $eventId): array
    {
        $scope = $this->resolveActorScope($user);
        $row = $this->historyRepo->findEventById($eventId);
        if ($row === null) {
            throw HttpException::notFound("History event #{$eventId} was not found.");
        }

        $this->assertCanInspectEvent($scope, $row);
        return $this->presentHistoryEvent($row, $scope['role'], true);
    }

    /**
     * Chronological Patient History Timeline (registration, profile, appointments, archive/restore).
     *
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    public function getPatientTimeline(array $user, int $patientId): array
    {
        $scope = $this->resolveActorScope($user);
        $patient = $this->patientRepo->findWithUserById($patientId);
        if ($patient === null) {
            throw HttpException::notFound("Patient #{$patientId} was not found.");
        }

        // Strict object-level authorization
        if ($scope['role'] === 'PATIENT' && $scope['patient_id'] !== $patientId) {
            throw HttpException::forbidden('Patients can only access their own account and appointment history.');
        }
        if ($scope['role'] === 'DENTIST') {
            if ($scope['dentist_id'] === null || !$this->historyRepo->dentistHasPatientRelationship($scope['dentist_id'], $patientId)) {
                throw HttpException::forbidden('Dentists can only view history for patients assigned to their care.');
            }
        }

        $patientUserId = isset($patient['user_id']) ? (int) $patient['user_id'] : null;
        $apptIds = $this->historyRepo->findAppointmentIdsForPatient($patientId, 60);

        $events = [];
        $auditRows = $this->historyRepo->findAuditEventsForTargets(
            ['patient', 'patients'],
            [$patientId],
            null,
            80
        );
        if ($patientUserId !== null && $patientUserId > 0) {
            $userRows = $this->historyRepo->findAuditEventsForTargets(['user', 'users'], [$patientUserId], null, 40);
            $auditRows = array_merge($auditRows, $userRows);
        }
        if (!empty($apptIds)) {
            $apptAudit = $this->historyRepo->findAuditEventsForTargets(['appointment', 'appointments'], $apptIds, null, 60);
            $auditRows = array_merge($auditRows, $apptAudit);
        }

        $seenAudit = [];
        foreach ($auditRows as $r) {
            $aid = (int) $r['id'];
            if (isset($seenAudit[$aid])) {
                continue;
            }
            $seenAudit[$aid] = true;
            $events[] = $this->presentHistoryEvent($r, $scope['role']);
        }

        foreach ($this->historyRepo->findAppointmentStatusHistory($apptIds, 60) as $ash) {
            $events[] = $this->presentAppointmentStatusEvent($ash, $scope['role']);
        }

        foreach ($this->historyRepo->findArchiveHistoryForEntity('patient', $patientId, $patientUserId, 40) as $ah) {
            $events[] = $this->presentArchiveCycleEvent($ah, $scope['role']);
        }

        usort($events, fn (array $a, array $b): int => strcmp((string) $b['created_at'], (string) $a['created_at']));

        $fullName = trim(($patient['first_name'] ?? '') . ' ' . ($patient['last_name'] ?? ''));
        return [
            'subject' => [
                'entity_type' => 'patient',
                'entity_id' => $patientId,
                'user_id' => $patientUserId,
                'name' => $fullName ?: 'Patient #' . $patientId,
                'email' => $patient['email'] ?? null,
                'is_active' => (int) ($patient['is_active'] ?? 0) === 1,
            ],
            'events' => array_slice($events, 0, 120),
            'total_events' => count($events),
            'timezone' => 'Asia/Manila',
        ];
    }

    /**
     * Chronological Dentist History Timeline (profile, schedules, leave, assignments, archive/restore).
     *
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    public function getDentistTimeline(array $user, int $dentistId): array
    {
        $scope = $this->resolveActorScope($user);
        $dentist = $this->dentistRepo->findById($dentistId);
        if ($dentist === null) {
            throw HttpException::notFound("Dentist #{$dentistId} was not found.");
        }

        if ($scope['role'] === 'PATIENT') {
            throw HttpException::forbidden('Patients are not authorized to inspect dentist operational history.');
        }
        if ($scope['role'] === 'DENTIST' && $scope['dentist_id'] !== $dentistId) {
            throw HttpException::forbidden('Dentists can only inspect their own practice history.');
        }

        $dentistUserId = isset($dentist['user_id']) ? (int) $dentist['user_id'] : null;
        $apptIds = $this->historyRepo->findAppointmentIdsForDentist($dentistId, 60);

        $events = [];
        $auditRows = $this->historyRepo->findAuditEventsForTargets(
            ['dentist', 'dentists', 'dentist_schedules', 'dentist_time_off', 'schedules'],
            [$dentistId],
            $dentistUserId,
            80
        );
        if ($dentistUserId !== null && $dentistUserId > 0) {
            $auditRows = array_merge(
                $auditRows,
                $this->historyRepo->findAuditEventsForTargets(['user', 'users'], [$dentistUserId], null, 40)
            );
        }
        if (!empty($apptIds)) {
            $auditRows = array_merge(
                $auditRows,
                $this->historyRepo->findAuditEventsForTargets(['appointment', 'appointments'], $apptIds, null, 60)
            );
        }

        $seen = [];
        foreach ($auditRows as $r) {
            $aid = (int) $r['id'];
            if (isset($seen[$aid])) {
                continue;
            }
            $seen[$aid] = true;
            $events[] = $this->presentHistoryEvent($r, $scope['role']);
        }

        foreach ($this->historyRepo->findAppointmentStatusHistory($apptIds, 60) as $ash) {
            $events[] = $this->presentAppointmentStatusEvent($ash, $scope['role']);
        }

        foreach ($this->historyRepo->findArchiveHistoryForEntity('dentist', $dentistId, $dentistUserId, 40) as $ah) {
            $events[] = $this->presentArchiveCycleEvent($ah, $scope['role']);
        }

        usort($events, fn (array $a, array $b): int => strcmp((string) $b['created_at'], (string) $a['created_at']));

        $fullName = 'Dr. ' . trim(($dentist['first_name'] ?? '') . ' ' . ($dentist['last_name'] ?? ''));
        return [
            'subject' => [
                'entity_type' => 'dentist',
                'entity_id' => $dentistId,
                'user_id' => $dentistUserId,
                'name' => $fullName,
                'email' => $dentist['email'] ?? null,
                'specialization' => $dentist['specialization'] ?? null,
                'is_active' => (int) ($dentist['is_active'] ?? 0) === 1,
            ],
            'events' => array_slice($events, 0, 120),
            'total_events' => count($events),
            'timezone' => 'Asia/Manila',
        ];
    }

    /**
     * Chronological Staff (Receptionist / Administrator) History Timeline.
     *
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    public function getStaffTimeline(array $user, int $targetUserId): array
    {
        $scope = $this->resolveActorScope($user);
        $target = $this->userRepo->findById($targetUserId);
        if ($target === null) {
            throw HttpException::notFound("User account #{$targetUserId} was not found.");
        }

        if ($scope['role'] !== 'ADMIN' && $scope['user_id'] !== $targetUserId) {
            throw HttpException::forbidden('You are only authorized to inspect your own staff activity history.');
        }

        $events = [];
        $auditRows = $this->historyRepo->findAuditEventsForTargets(
            ['user', 'users'],
            [$targetUserId],
            $targetUserId,
            100
        );
        foreach ($auditRows as $r) {
            $events[] = $this->presentHistoryEvent($r, $scope['role']);
        }

        foreach ($this->historyRepo->findArchiveHistoryForEntity('user', $targetUserId, $targetUserId, 40) as $ah) {
            $events[] = $this->presentArchiveCycleEvent($ah, $scope['role']);
        }

        usort($events, fn (array $a, array $b): int => strcmp((string) $b['created_at'], (string) $a['created_at']));

        $fullName = trim(($target['first_name'] ?? '') . ' ' . ($target['last_name'] ?? ''));
        return [
            'subject' => [
                'entity_type' => 'user',
                'entity_id' => $targetUserId,
                'user_id' => $targetUserId,
                'name' => $fullName ?: (string) $target['email'],
                'email' => (string) $target['email'],
                'role' => strtoupper((string) $target['role']),
                'is_active' => (int) ($target['is_active'] ?? 0) === 1,
            ],
            'events' => array_slice($events, 0, 120),
            'total_events' => count($events),
            'timezone' => 'Asia/Manila',
        ];
    }

    /**
     * Chronological Appointment Lifecycle History Timeline (creation, approvals, reschedules, reassignments, completion).
     *
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    public function getAppointmentTimeline(array $user, int $appointmentId): array
    {
        $scope = $this->resolveActorScope($user);
        $appt = $this->appointmentRepo->findById($appointmentId);
        if ($appt === null) {
            throw HttpException::notFound("Appointment #{$appointmentId} was not found.");
        }

        if ($scope['role'] === 'PATIENT' && (int) $appt['patient_id'] !== (int) ($scope['patient_id'] ?? 0)) {
            throw HttpException::forbidden('Patients can only inspect history for their own appointments.');
        }
        if ($scope['role'] === 'DENTIST' && (int) $appt['dentist_id'] !== (int) ($scope['dentist_id'] ?? 0)) {
            throw HttpException::forbidden('Dentists can only inspect history for appointments assigned to them.');
        }

        $events = [];
        foreach ($this->historyRepo->findAppointmentStatusHistory([$appointmentId], 80) as $ash) {
            $events[] = $this->presentAppointmentStatusEvent($ash, $scope['role']);
        }

        foreach ($this->historyRepo->findAuditEventsForTargets(['appointment', 'appointments'], [$appointmentId], null, 80) as $r) {
            $events[] = $this->presentHistoryEvent($r, $scope['role']);
        }

        foreach ($this->historyRepo->findArchiveHistoryForEntity('appointment', $appointmentId, null, 20) as $ah) {
            $events[] = $this->presentArchiveCycleEvent($ah, $scope['role']);
        }

        usort($events, fn (array $a, array $b): int => strcmp((string) $b['created_at'], (string) $a['created_at']));

        $patientName = trim(($appt['patient_first_name'] ?? '') . ' ' . ($appt['patient_last_name'] ?? ''));
        $dentistName = 'Dr. ' . trim(($appt['dentist_first_name'] ?? '') . ' ' . ($appt['dentist_last_name'] ?? ''));

        return [
            'subject' => [
                'entity_type' => 'appointment',
                'entity_id' => $appointmentId,
                'reference' => sprintf('APT-%06d', $appointmentId),
                'service_name' => $appt['service_name'] ?? 'Dental Visit',
                'patient_name' => $patientName,
                'dentist_name' => $dentistName,
                'status' => strtoupper((string) ($appt['status'] ?? '')),
                'start_at' => $appt['start_at'] ?? null,
                'end_at' => $appt['end_at'] ?? null,
            ],
            'events' => array_slice($events, 0, 120),
            'total_events' => count($events),
            'timezone' => 'Asia/Manila',
        ];
    }

    /**
     * Verify role/ownership access to inspect a specific audit_logs history event.
     *
     * @param array{role: string, user_id: int, patient_id: ?int, dentist_id: ?int} $scope
     * @param array<string, mixed> $row
     */
    private function assertCanInspectEvent(array $scope, array $row): void
    {
        if ($scope['role'] === 'ADMIN') {
            return;
        }

        $actorUid = isset($row['actor_user_id']) ? (int) $row['actor_user_id'] : 0;
        if ($actorUid > 0 && $actorUid === $scope['user_id']) {
            return;
        }

        $targetType = strtolower((string) ($row['target_type'] ?? ''));
        $targetId = isset($row['target_id']) ? (int) $row['target_id'] : 0;

        if ($scope['role'] === 'RECEPTIONIST') {
            if (in_array($targetType, ['appointment', 'appointments', 'patient', 'patients', 'service', 'services', 'archives', 'archive_records', 'schedules', 'dentist_schedules', 'dentist_time_off'], true)) {
                return;
            }
            throw HttpException::forbidden('Receptionists cannot inspect restricted administrative or security history events.');
        }

        if ($scope['role'] === 'DENTIST') {
            if (in_array($targetType, ['dentist', 'dentists', 'schedules', 'dentist_schedules', 'dentist_time_off'], true) && $targetId === (int) ($scope['dentist_id'] ?? 0)) {
                return;
            }
            if (in_array($targetType, ['appointment', 'appointments'], true) && $targetId > 0) {
                $appt = $this->appointmentRepo->findById($targetId);
                if ($appt && (int) $appt['dentist_id'] === (int) ($scope['dentist_id'] ?? 0)) {
                    return;
                }
            }
            throw HttpException::forbidden('Dentists can only inspect history events for their own account and assigned appointments.');
        }

        // PATIENT
        if (in_array($targetType, ['patient', 'patients'], true) && $targetId === (int) ($scope['patient_id'] ?? 0)) {
            return;
        }
        if (in_array($targetType, ['appointment', 'appointments'], true) && $targetId > 0) {
            $appt = $this->appointmentRepo->findById($targetId);
            if ($appt && (int) $appt['patient_id'] === (int) ($scope['patient_id'] ?? 0)) {
                return;
            }
        }
        throw HttpException::forbidden('Patients can only inspect their own account and appointment history.');
    }

    /**
     * Format an `audit_logs` row into a normalized History Record with sanitized diffs and Manila timestamp.
     *
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function presentHistoryEvent(array $row, string $viewerRole, bool $includeTechnical = false): array
    {
        $isPatient = strtoupper($viewerRole) === 'PATIENT';
        $rawPayload = null;
        if (!empty($row['sanitized_payload'])) {
            $decoded = json_decode((string) $row['sanitized_payload'], true);
            if (is_array($decoded)) {
                $rawPayload = $this->redactHistoryPayload($decoded);
            }
        }

        $action = strtoupper((string) ($row['action'] ?? 'SYSTEM_EVENT'));
        $targetType = strtolower((string) ($row['target_type'] ?? 'system'));
        $targetId = $row['target_id'] !== null ? (int) $row['target_id'] : null;

        $module = $this->resolveModule($targetType, $action);
        $category = $this->resolveCategory($targetType, $action, (string) ($row['actor_role'] ?? 'SYSTEM'));
        $result = $this->inferResult($action, $rawPayload);

        [$oldValues, $newValues, $changes] = $this->extractValueComparison($rawPayload);
        $reason = is_array($rawPayload)
            ? (string) ($rawPayload['reason'] ?? $rawPayload['archive_reason'] ?? $rawPayload['restore_reason'] ?? $rawPayload['cancellation_reason'] ?? '')
            : '';

        $actorName = trim(((string) ($row['actor_first_name'] ?? '')) . ' ' . ((string) ($row['actor_last_name'] ?? '')));
        $actorEmail = $row['actor_email'] ?? null;
        if ($actorName === '') {
            $actorName = $actorEmail ? (string) $actorEmail : 'System';
        }

        $actorRole = !empty($row['actor_role']) ? strtoupper((string) $row['actor_role']) : 'SYSTEM';
        $actorIsActive = $row['actor_is_active'] !== null ? ((int) $row['actor_is_active'] === 1) : true;

        $event = [
            'id' => (int) $row['id'],
            'source' => 'audit_log',
            'event_ref' => sprintf('HIS-%06d', (int) $row['id']),
            'actor_user_id' => $row['actor_user_id'] !== null ? (int) $row['actor_user_id'] : null,
            'actor_name' => $isPatient && $actorRole !== 'PATIENT' ? ucfirst(strtolower($actorRole)) : $actorName,
            'actor_email' => $isPatient ? null : ($actorEmail ?: null),
            'actor_role' => $actorRole,
            'actor_is_active' => $actorIsActive,
            'action' => $action,
            'action_label' => $this->humanizeAction($action),
            'module' => $module,
            'category' => $category,
            'affected_record' => [
                'type' => $targetType,
                'id' => $targetId,
                'reference' => $targetId !== null ? strtoupper($targetType) . ' #' . $targetId : strtoupper($targetType),
            ],
            'result' => $result,
            'reason' => $reason !== '' ? $reason : null,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'changes' => $changes,
            'created_at' => (string) $row['created_at'],
            'timestamp_manila' => $this->formatManilaTimestamp((string) $row['created_at']),
        ];

        if ($includeTechnical && !$isPatient) {
            $event['ip_address'] = isset($row['ip_address']) ? $this->minimizeIp((string) $row['ip_address']) : null;
            $event['payload'] = $rawPayload;
        }

        return $event;
    }

    /**
     * Format an `appointment_status_history` row for individual timelines.
     *
     * @param array<string, mixed> $ash
     * @return array<string, mixed>
     */
    private function presentAppointmentStatusEvent(array $ash, string $viewerRole): array
    {
        $isPatient = strtoupper($viewerRole) === 'PATIENT';
        $meta = !empty($ash['metadata']) ? (json_decode((string) $ash['metadata'], true) ?: []) : [];
        $meta = is_array($meta) ? $this->redactHistoryPayload($meta) : [];

        $oldValues = [];
        $newValues = [];
        if (!empty($ash['old_status'])) {
            $oldValues['status'] = (string) $ash['old_status'];
        }
        $newValues['status'] = (string) $ash['new_status'];

        if (isset($meta['old_start_at']) || isset($meta['new_start_at'])) {
            $oldValues['start_at'] = $meta['old_start_at'] ?? null;
            $newValues['start_at'] = $meta['new_start_at'] ?? null;
        }
        if (isset($meta['old_dentist_id']) || isset($meta['new_dentist_id'])) {
            $oldValues['dentist_id'] = $meta['old_dentist_id'] ?? null;
            $newValues['dentist_id'] = $meta['new_dentist_id'] ?? null;
        }

        $changes = $this->buildDiffList($oldValues, $newValues);

        $actorName = trim(((string) ($ash['actor_first_name'] ?? '')) . ' ' . ((string) ($ash['actor_last_name'] ?? '')));
        $actorEmail = $ash['actor_email'] ?? null;
        if ($actorName === '') {
            $actorName = $actorEmail ? (string) $actorEmail : 'System';
        }
        $actorRole = !empty($ash['actor_role']) ? strtoupper((string) $ash['actor_role']) : 'SYSTEM';
        $newStatus = strtoupper((string) $ash['new_status']);

        return [
            'id' => (int) $ash['id'],
            'source' => 'appointment_status',
            'event_ref' => sprintf('APT-EVT-%06d', (int) $ash['id']),
            'actor_user_id' => $ash['actor_user_id'] !== null ? (int) $ash['actor_user_id'] : null,
            'actor_name' => $isPatient && $actorRole !== 'PATIENT' ? ucfirst(strtolower($actorRole)) : $actorName,
            'actor_email' => $isPatient ? null : ($actorEmail ?: null),
            'actor_role' => $actorRole,
            'actor_is_active' => $ash['actor_is_active'] !== null ? ((int) $ash['actor_is_active'] === 1) : true,
            'action' => 'APPOINTMENT_' . $newStatus,
            'action_label' => 'Appointment ' . ucfirst(strtolower($newStatus)),
            'module' => 'appointments',
            'category' => 'APPOINTMENT',
            'affected_record' => [
                'type' => 'appointment',
                'id' => (int) $ash['appointment_id'],
                'reference' => sprintf('APT-%06d', (int) $ash['appointment_id']),
            ],
            'result' => in_array($newStatus, ['REJECTED', 'CANCELLED'], true) ? 'WARNING' : 'SUCCESS',
            'reason' => !empty($ash['reason']) ? (string) $ash['reason'] : null,
            'old_values' => $oldValues ?: null,
            'new_values' => $newValues ?: null,
            'changes' => $changes,
            'created_at' => (string) $ash['created_at'],
            'timestamp_manila' => $this->formatManilaTimestamp((string) $ash['created_at']),
        ];
    }

    /**
     * Format an `archive_history` cycle row for individual timelines.
     *
     * @param array<string, mixed> $ah
     * @return array<string, mixed>
     */
    private function presentArchiveCycleEvent(array $ah, string $viewerRole): array
    {
        $isPatient = strtoupper($viewerRole) === 'PATIENT';
        $eventType = strtoupper((string) ($ah['event_type'] ?? 'ARCHIVED'));
        $actorName = trim(((string) ($ah['actor_first_name'] ?? '')) . ' ' . ((string) ($ah['actor_last_name'] ?? '')));
        $actorEmail = $ah['actor_email'] ?? null;
        if ($actorName === '') {
            $actorName = $actorEmail ? (string) $actorEmail : 'System';
        }
        $actorRole = strtoupper((string) ($ah['actor_role'] ?? 'SYSTEM'));

        $oldStatus = $eventType === 'RESTORED' ? 'ARCHIVED' : 'ACTIVE';
        $newStatus = $eventType === 'RESTORED' ? 'ACTIVE' : 'ARCHIVED';

        return [
            'id' => (int) $ah['id'],
            'source' => 'archive_history',
            'event_ref' => (string) ($ah['reference_code'] ?: sprintf('ARC-EVT-%06d', (int) $ah['id'])),
            'actor_user_id' => $ah['actor_user_id'] !== null ? (int) $ah['actor_user_id'] : null,
            'actor_name' => $isPatient && $actorRole !== 'PATIENT' ? ucfirst(strtolower($actorRole)) : $actorName,
            'actor_email' => $isPatient ? null : ($actorEmail ?: null),
            'actor_role' => $actorRole,
            'actor_is_active' => $ah['actor_is_active'] !== null ? ((int) $ah['actor_is_active'] === 1) : true,
            'action' => 'RECORD_' . $eventType,
            'action_label' => match ($eventType) {
                'RESTORED' => 'Account / Record Restored',
                'REARCHIVED' => 'Account / Record Re-Archived',
                default => 'Account / Record Archived',
            },
            'module' => 'archives',
            'category' => 'ADMIN',
            'affected_record' => [
                'type' => (string) $ah['entity_type'],
                'id' => (int) $ah['entity_id'],
                'reference' => strtoupper((string) $ah['entity_type']) . ' #' . (int) $ah['entity_id'],
            ],
            'result' => 'SUCCESS',
            'reason' => (string) ($ah['reason'] ?? ''),
            'old_values' => ['account_status' => $oldStatus],
            'new_values' => ['account_status' => $newStatus],
            'changes' => [
                ['field' => 'account_status', 'before' => $oldStatus, 'after' => $newStatus],
            ],
            'created_at' => (string) $ah['created_at'],
            'timestamp_manila' => $this->formatManilaTimestamp((string) $ah['created_at']),
        ];
    }

    /**
     * Strip passwords, tokens, and full clinical notes recursively from general history payloads.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    private function redactHistoryPayload(array $data): array
    {
        $sanitized = $this->auditRepo->sanitizePayload($data);
        $out = [];
        foreach ($sanitized as $key => $val) {
            $lower = strtolower((string) $key);
            if (in_array($lower, self::REDACTED_HISTORY_FIELDS, true)) {
                $out[$key] = '[RESTRICTED]';
            } elseif (is_array($val)) {
                $out[$key] = $this->redactHistoryPayload($val);
            } else {
                $out[$key] = $val;
            }
        }
        return $out;
    }

    /**
     * Extract structured old_values, new_values, and field-level diffs from diverse audit payloads.
     *
     * @param array<string, mixed>|null $payload
     * @return array{0: ?array<string, mixed>, 1: ?array<string, mixed>, 2: list<array{field: string, before: mixed, after: mixed}>}
     */
    private function extractValueComparison(?array $payload): array
    {
        if (!is_array($payload) || empty($payload)) {
            return [null, null, []];
        }

        $old = null;
        $new = null;

        if (isset($payload['before']) && is_array($payload['before'])) {
            $old = $payload['before'];
        } elseif (isset($payload['old_values']) && is_array($payload['old_values'])) {
            $old = $payload['old_values'];
        }

        if (isset($payload['after']) && is_array($payload['after'])) {
            $new = $payload['after'];
        } elseif (isset($payload['new_values']) && is_array($payload['new_values'])) {
            $new = $payload['new_values'];
        }

        // Also map flat old_* / new_* or previous_* / updated_* keys
        if ($old === null && $new === null) {
            $flatOld = [];
            $flatNew = [];
            foreach ($payload as $k => $v) {
                $ks = (string) $k;
                if (str_starts_with($ks, 'old_')) {
                    $flatOld[substr($ks, 4)] = $v;
                } elseif (str_starts_with($ks, 'previous_')) {
                    $flatOld[substr($ks, 9)] = $v;
                } elseif (str_starts_with($ks, 'new_')) {
                    $flatNew[substr($ks, 4)] = $v;
                } elseif (str_starts_with($ks, 'updated_')) {
                    $flatNew[substr($ks, 8)] = $v;
                }
            }
            if (!empty($flatOld) || !empty($flatNew)) {
                $old = $flatOld;
                $new = $flatNew;
            }
        }

        $changes = $this->buildDiffList($old ?? [], $new ?? []);
        return [$old, $new, $changes];
    }

    /**
     * @param array<string, mixed> $old
     * @param array<string, mixed> $new
     * @return list<array{field: string, before: mixed, after: mixed}>
     */
    private function buildDiffList(array $old, array $new): array
    {
        $keys = array_values(array_unique(array_merge(array_keys($old), array_keys($new))));
        $changes = [];
        foreach ($keys as $key) {
            $b = $old[$key] ?? null;
            $a = $new[$key] ?? null;
            if ($b !== $a) {
                $changes[] = [
                    'field' => (string) $key,
                    'before' => $b,
                    'after' => $a,
                ];
            }
        }
        return $changes;
    }

    private function resolveModule(string $targetType, string $action): string
    {
        if (in_array($action, HistoryRepository::SECURITY_ACTIONS, true) || str_starts_with($action, 'LOGIN_') || str_starts_with($action, 'PASSWORD_')) {
            return 'security';
        }
        foreach (HistoryRepository::MODULE_TARGET_TYPES as $mod => $types) {
            if (in_array($targetType, $types, true)) {
                return $mod;
            }
        }
        return $targetType !== '' ? $targetType : 'system';
    }

    private function resolveCategory(string $targetType, string $action, string $actorRole): string
    {
        if (in_array($action, HistoryRepository::SECURITY_ACTIONS, true) || str_starts_with($action, 'LOGIN_') || str_starts_with($action, 'PASSWORD_')) {
            return 'SECURITY';
        }
        if (in_array($targetType, ['appointment', 'appointments'], true)) {
            return 'APPOINTMENT';
        }
        if (in_array($targetType, ['patient', 'patients'], true)) {
            return 'PATIENT';
        }
        if (in_array($targetType, ['dentist', 'dentists', 'schedules', 'dentist_schedules', 'dentist_time_off'], true) || in_array(strtoupper($actorRole), ['DENTIST', 'RECEPTIONIST'], true)) {
            return 'STAFF';
        }
        return 'ADMIN';
    }

    /**
     * @param array<string, mixed>|null $payload
     */
    private function inferResult(string $action, ?array $payload): string
    {
        if (is_array($payload) && !empty($payload['result'])) {
            $r = strtoupper((string) $payload['result']);
            if (in_array($r, self::ALLOWED_RESULTS, true)) {
                return $r;
            }
        }
        if (in_array($action, HistoryRepository::FAILURE_ACTIONS, true) || str_contains($action, 'FAILED') || str_contains($action, 'DENIED')) {
            return str_contains($action, 'FORBIDDEN') || str_contains($action, 'DENIED') || str_contains($action, 'AUTHORIZATION')
                ? 'DENIED'
                : 'FAILED';
        }
        if (str_contains($action, 'CONFLICT') || str_contains($action, 'LOCKED') || str_contains($action, 'CANCELLED') || str_contains($action, 'REJECTED')) {
            return 'WARNING';
        }
        return 'SUCCESS';
    }

    private function humanizeAction(string $action): string
    {
        $words = explode('_', strtolower($action));
        return implode(' ', array_map('ucfirst', $words));
    }

    private function formatManilaTimestamp(string $raw): string
    {
        if ($raw === '') {
            return '';
        }
        try {
            $dt = new DateTimeImmutable($raw, $this->manilaTz);
            return $dt->setTimezone($this->manilaTz)->format('Y-m-d h:i:s A') . ' PHT';
        } catch (\Throwable $e) {
            return $raw;
        }
    }

    /** Minimize IP precision slightly for privacy while preserving audit traceability. */
    private function minimizeIp(string $ip): string
    {
        $ip = trim($ip);
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $parts = explode('.', $ip);
            return "{$parts[0]}.{$parts[1]}.{$parts[2]}.0";
        }
        return $ip;
    }

    private function assertValidDate(string $value, string $field): void
    {
        $d = DateTimeImmutable::createFromFormat('!Y-m-d', $value, $this->manilaTz);
        if (!$d || $d->format('Y-m-d') !== $value) {
            throw HttpException::unprocessableEntity("Invalid {$field} format. Expected YYYY-MM-DD.", [
                $field => ["{$field} must be a valid YYYY-MM-DD date."],
            ]);
        }
    }
}
