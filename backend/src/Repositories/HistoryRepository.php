<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use App\Support\ServerTableQuery;
use PDO;

/**
 * History Records Repository
 *
 * Queries the existing append-only `audit_logs`, `appointment_status_history`,
 * and `archive_history` tables without creating duplicate audit infrastructure.
 * Strictly applies server-side role/ownership scoping, allowlisted sorting,
 * prepared statements, and database-level counts.
 */
class HistoryRepository
{
    public const SORT_ALLOWLIST = [
        'created_at' => 'al.created_at',
        'id' => 'al.id',
        'action' => 'al.action',
        'module' => 'al.target_type',
        'actor_role' => 'u.role',
    ];

    public const SECURITY_ACTIONS = [
        'LOGIN_SUCCESS',
        'LOGIN_FAILED',
        'ACCOUNT_LOCKED',
        'LOGOUT',
        'SESSION_REVOKED',
        'PASSWORD_RESET_REQUESTED',
        'PASSWORD_RESET_COMPLETED',
        'PASSWORD_CHANGED',
        'FORBIDDEN_ACCESS',
        'AUTHORIZATION_FAILED',
        'CSRF_FAILED',
        'RATE_LIMIT_EXCEEDED',
    ];

    public const FAILURE_ACTIONS = [
        'LOGIN_FAILED',
        'ACCOUNT_LOCKED',
        'FORBIDDEN_ACCESS',
        'AUTHORIZATION_FAILED',
        'CSRF_FAILED',
        'RATE_LIMIT_EXCEEDED',
        'EMAIL_DELIVERY_FAILED',
    ];

    /** @var array<string, list<string>> */
    public const MODULE_TARGET_TYPES = [
        'patients' => ['patients', 'patient'],
        'dentists' => ['dentists', 'dentist', 'dentist_schedules', 'dentist_time_off', 'schedules'],
        'appointments' => ['appointments', 'appointment'],
        'users' => ['users', 'user'],
        'roles' => ['roles', 'role', 'permissions'],
        'archives' => ['archives', 'archive', 'archive_record', 'archive_records'],
        'clinical' => ['treatment_records', 'treatment_record'],
        'services' => ['services', 'service'],
        'settings' => ['clinic_settings', 'settings', 'clinic_hours'],
        'security' => ['security', 'auth', 'session', 'sessions', 'audit_logs', 'audit_log'],
        'legal' => ['legal_documents', 'legal_document', 'legal_acceptances'],
        'notifications' => ['notifications', 'email_outbox', 'email_job', 'email_jobs'],
    ];

    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * Build mandatory role/ownership WHERE predicates applied to all history queries.
     *
     * @param array{role: string, user_id: int, patient_id: ?int, dentist_id: ?int} $scope
     * @param array<string, mixed> $params
     * @return list<string>
     */
    private function buildScopeClauses(array $scope, array &$params): array
    {
        $role = strtoupper($scope['role']);
        $userId = (int) $scope['user_id'];

        if ($role === 'ADMIN') {
            return ['1 = 1'];
        }

        if ($role === 'RECEPTIONIST') {
            // Receptionists view operational appointment/patient/service/archive activity + their own actions
            $params[':scope_rec_uid'] = $userId;
            return [
                "(al.actor_user_id = :scope_rec_uid OR al.target_type IN ('appointment', 'appointments', 'patient', 'patients', 'service', 'services', 'archives', 'archive_records', 'schedules', 'dentist_schedules', 'dentist_time_off'))"
            ];
        }

        if ($role === 'DENTIST') {
            $dentistId = $scope['dentist_id'];
            $params[':scope_dnt_uid'] = $userId;
            if ($dentistId !== null && $dentistId > 0) {
                $params[':scope_dnt_id'] = $dentistId;
                $params[':scope_dnt_id_ap'] = $dentistId;
                return [
                    "(al.actor_user_id = :scope_dnt_uid
                      OR (al.target_type IN ('dentist', 'dentists', 'dentist_schedules', 'dentist_time_off', 'schedules') AND al.target_id = :scope_dnt_id)
                      OR (al.target_type IN ('appointment', 'appointments') AND al.target_id IN (SELECT id FROM appointments WHERE dentist_id = :scope_dnt_id_ap)))"
                ];
            }
            return ['al.actor_user_id = :scope_dnt_uid'];
        }

        // PATIENT: strictly self-owned account & appointment events
        $patientId = $scope['patient_id'];
        $params[':scope_pat_uid'] = $userId;
        if ($patientId !== null && $patientId > 0) {
            $params[':scope_pat_id'] = $patientId;
            $params[':scope_pat_id_ap'] = $patientId;
            return [
                "(al.actor_user_id = :scope_pat_uid
                  OR (al.target_type IN ('patient', 'patients') AND al.target_id = :scope_pat_id)
                  OR (al.target_type IN ('appointment', 'appointments') AND al.target_id IN (SELECT id FROM appointments WHERE patient_id = :scope_pat_id_ap)))"
            ];
        }
        return ['al.actor_user_id = :scope_pat_uid'];
    }

    /**
     * Build category SQL predicate for consistent dashboard KPI counts and category filtering.
     */
    private function categoryClause(string $category): string
    {
        $secIn = "'" . implode("','", self::SECURITY_ACTIONS) . "'";
        return match (strtoupper($category)) {
            'PATIENT' => "(al.target_type IN ('patient', 'patients') OR UPPER(COALESCE(u.role, '')) = 'PATIENT')",
            'STAFF' => "(UPPER(COALESCE(u.role, '')) IN ('RECEPTIONIST', 'DENTIST') OR al.target_type IN ('dentist', 'dentists', 'schedules', 'dentist_schedules', 'dentist_time_off'))",
            'APPOINTMENT' => "(al.target_type IN ('appointment', 'appointments'))",
            'SECURITY' => "(al.action IN ({$secIn}) OR al.action LIKE 'LOGIN_%' OR al.action LIKE 'PASSWORD_%' OR al.action LIKE '%SESSION%' OR al.action LIKE '%FORBIDDEN%' OR al.target_type IN ('security', 'auth', 'sessions'))",
            'ADMIN' => "(UPPER(COALESCE(u.role, '')) = 'ADMIN' OR al.target_type IN ('users', 'user', 'roles', 'role', 'permissions', 'clinic_settings', 'settings', 'archives', 'archive_records', 'legal_documents', 'services', 'service'))",
            default => '1 = 1',
        };
    }

    /**
     * Database-calculated summary counts for the History Records dashboard.
     *
     * @param array{role: string, user_id: int, patient_id: ?int, dentist_id: ?int} $scope
     * @return array<string, int>
     */
    public function summaryForActor(array $scope): array
    {
        $pdo = $this->database->getConnection();
        $params = [];
        $scopeClauses = $this->buildScopeClauses($scope, $params);
        $whereSql = implode(' AND ', $scopeClauses);

        $cPatient = $this->categoryClause('PATIENT');
        $cStaff = $this->categoryClause('STAFF');
        $cAppt = $this->categoryClause('APPOINTMENT');
        $cSec = $this->categoryClause('SECURITY');
        $cAdmin = $this->categoryClause('ADMIN');

        $sql = "
            SELECT
                COUNT(*) AS total_activities,
                COALESCE(SUM(CASE WHEN {$cPatient} THEN 1 ELSE 0 END), 0) AS patient_activities,
                COALESCE(SUM(CASE WHEN {$cStaff} THEN 1 ELSE 0 END), 0) AS staff_activities,
                COALESCE(SUM(CASE WHEN {$cAppt} THEN 1 ELSE 0 END), 0) AS appointment_activities,
                COALESCE(SUM(CASE WHEN {$cSec} THEN 1 ELSE 0 END), 0) AS security_activities,
                COALESCE(SUM(CASE WHEN {$cAdmin} THEN 1 ELSE 0 END), 0) AS administrative_activities
            FROM audit_logs al
            LEFT JOIN users u ON al.actor_user_id = u.id
            WHERE {$whereSql}
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'total_activities' => (int) ($row['total_activities'] ?? 0),
            'patient_activities' => (int) ($row['patient_activities'] ?? 0),
            'staff_activities' => (int) ($row['staff_activities'] ?? 0),
            'appointment_activities' => (int) ($row['appointment_activities'] ?? 0),
            'security_activities' => (int) ($row['security_activities'] ?? 0),
            'administrative_activities' => (int) ($row['administrative_activities'] ?? 0),
        ];
    }

    /**
     * Server-side paginated, searchable, filterable, sortable History Records listing.
     *
     * @param array{role: string, user_id: int, patient_id: ?int, dentist_id: ?int} $scope
     * @param array<string, mixed> $filters
     * @return array{data: list<array<string, mixed>>, meta: array<string, mixed>}
     */
    public function listForActor(array $scope, array $filters = [], int $page = 1, int $perPage = 10): array
    {
        $pdo = $this->database->getConnection();
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $offset = ($page - 1) * $perPage;

        $baseParams = [];
        $scopeClauses = $this->buildScopeClauses($scope, $baseParams);
        $baseWhereSql = implode(' AND ', $scopeClauses);

        $userClauses = [];
        $params = $baseParams;

        if (!empty($filters['actor_user_id'])) {
            $userClauses[] = 'al.actor_user_id = :f_actor_uid';
            $params[':f_actor_uid'] = (int) $filters['actor_user_id'];
        }

        if (!empty($filters['actor_role'])) {
            $r = strtoupper(trim((string) $filters['actor_role']));
            if ($r === 'SYSTEM') {
                $userClauses[] = 'al.actor_user_id IS NULL';
            } else {
                $userClauses[] = 'UPPER(u.role) = :f_actor_role';
                $params[':f_actor_role'] = $r;
            }
        }

        if (!empty($filters['category'])) {
            $userClauses[] = $this->categoryClause((string) $filters['category']);
        }

        if (!empty($filters['action'])) {
            $userClauses[] = 'al.action = :f_action';
            $params[':f_action'] = strtoupper(trim((string) $filters['action']));
        }

        if (!empty($filters['module'])) {
            $mod = strtolower(trim((string) $filters['module']));
            $targets = self::MODULE_TARGET_TYPES[$mod] ?? [$mod];
            $phs = [];
            foreach ($targets as $idx => $t) {
                $k = ":f_mod_{$idx}";
                $phs[] = $k;
                $params[$k] = $t;
            }
            if ($mod === 'security') {
                $userClauses[] = '(' . $this->categoryClause('SECURITY') . ' OR al.target_type IN (' . implode(', ', $phs) . '))';
            } else {
                $userClauses[] = 'al.target_type IN (' . implode(', ', $phs) . ')';
            }
        }

        if (!empty($filters['result'])) {
            $res = strtoupper(trim((string) $filters['result']));
            $failList = "'" . implode("','", self::FAILURE_ACTIONS) . "'";
            if ($res === 'FAILED' || $res === 'DENIED') {
                $userClauses[] = "(al.action IN ({$failList}) OR al.action LIKE '%FAILED%' OR al.action LIKE '%DENIED%' OR al.action LIKE '%REJECTED%')";
            } elseif ($res === 'WARNING') {
                $userClauses[] = "(al.action LIKE '%CONFLICT%' OR al.action LIKE '%LOCKED%' OR al.action LIKE '%EXPIRED%' OR al.action LIKE '%CANCELLED%')";
            } elseif ($res === 'SUCCESS') {
                $userClauses[] = "(al.action NOT IN ({$failList}) AND al.action NOT LIKE '%FAILED%' AND al.action NOT LIKE '%DENIED%')";
            }
        }

        if (!empty($filters['entity_type'])) {
            $et = strtolower(trim((string) $filters['entity_type']));
            $aliases = self::MODULE_TARGET_TYPES[$et] ?? [$et, $et . 's'];
            $phs = [];
            foreach (array_values(array_unique($aliases)) as $idx => $a) {
                $k = ":f_et_{$idx}";
                $phs[] = $k;
                $params[$k] = $a;
            }
            $userClauses[] = 'al.target_type IN (' . implode(', ', $phs) . ')';
        }

        if (!empty($filters['entity_id'])) {
            $userClauses[] = 'al.target_id = :f_entity_id';
            $params[':f_entity_id'] = (int) $filters['entity_id'];
        }

        if (!empty($filters['date_from'])) {
            $userClauses[] = 'al.created_at >= :f_date_from';
            $params[':f_date_from'] = trim((string) $filters['date_from']) . ' 00:00:00';
        }

        if (!empty($filters['date_to'])) {
            $userClauses[] = 'al.created_at <= :f_date_to';
            $params[':f_date_to'] = trim((string) $filters['date_to']) . ' 23:59:59';
        }

        if (!empty($filters['search']) && trim((string) $filters['search']) !== '') {
            $rawSearch = trim((string) $filters['search']);
            $term = '%' . ServerTableQuery::escapeLike($rawSearch) . '%';
            $orParts = [
                "al.action LIKE :s1 ESCAPE '!'",
                "al.target_type LIKE :s2 ESCAPE '!'",
                "u.email LIKE :s3 ESCAPE '!'",
                "u.first_name LIKE :s4 ESCAPE '!'",
                "u.last_name LIKE :s5 ESCAPE '!'",
                "al.sanitized_payload LIKE :s6 ESCAPE '!'",
            ];
            $params[':s1'] = $term;
            $params[':s2'] = $term;
            $params[':s3'] = $term;
            $params[':s4'] = $term;
            $params[':s5'] = $term;
            $params[':s6'] = $term;

            // Support direct lookup by HIS-000123 or numeric target_id
            if (preg_match('/^(?:HIS-)?0*(\d+)$/i', $rawSearch, $m)) {
                $orParts[] = 'al.id = :s_id OR al.target_id = :s_tid';
                $params[':s_id'] = (int) $m[1];
                $params[':s_tid'] = (int) $m[1];
            }
            $userClauses[] = '(' . implode(' OR ', $orParts) . ')';
        }

        $hasUserFilters = count($userClauses) > 0;
        $whereSql = $hasUserFilters
            ? $baseWhereSql . ' AND ' . implode(' AND ', $userClauses)
            : $baseWhereSql;

        $sort = ServerTableQuery::parseSort(
            $filters,
            self::SORT_ALLOWLIST,
            'created_at',
            'DESC',
            'al.id',
            false
        );

        $filteredStmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM audit_logs al
            LEFT JOIN users u ON al.actor_user_id = u.id
            WHERE {$whereSql}
        ");
        $filteredStmt->execute($params);
        $filteredTotal = (int) $filteredStmt->fetchColumn();

        if ($hasUserFilters) {
            $baseStmt = $pdo->prepare("
                SELECT COUNT(*)
                FROM audit_logs al
                LEFT JOIN users u ON al.actor_user_id = u.id
                WHERE {$baseWhereSql}
            ");
            $baseStmt->execute($baseParams);
            $totalRecords = (int) $baseStmt->fetchColumn();
        } else {
            $totalRecords = $filteredTotal;
        }

        $sql = "
            SELECT
                al.id, al.actor_user_id, al.action, al.target_type, al.target_id,
                al.ip_address, al.user_agent, al.sanitized_payload, al.created_at,
                u.email AS actor_email,
                u.role AS actor_role,
                u.first_name AS actor_first_name,
                u.last_name AS actor_last_name,
                u.is_active AS actor_is_active
            FROM audit_logs al
            LEFT JOIN users u ON al.actor_user_id = u.id
            WHERE {$whereSql}
            ORDER BY {$sort['order_by_sql']}
            LIMIT :limit OFFSET :offset
        ";

        $stmt = $pdo->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        return [
            'data' => $stmt->fetchAll(PDO::FETCH_ASSOC),
            'meta' => ServerTableQuery::buildMeta(
                $totalRecords,
                $filteredTotal,
                $page,
                $perPage,
                $sort['sort_by'],
                $sort['sort_dir']
            ),
        ];
    }

    /**
     * Find a single audit/history event by ID with preserved actor metadata.
     *
     * @return array<string, mixed>|null
     */
    public function findEventById(int $id): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT
                al.id, al.actor_user_id, al.action, al.target_type, al.target_id,
                al.ip_address, al.user_agent, al.sanitized_payload, al.created_at,
                u.email AS actor_email,
                u.role AS actor_role,
                u.first_name AS actor_first_name,
                u.last_name AS actor_last_name,
                u.is_active AS actor_is_active
            FROM audit_logs al
            LEFT JOIN users u ON al.actor_user_id = u.id
            WHERE al.id = :id
            LIMIT 1
        ');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * Fetch chronological `audit_logs` events matching an entity or related user/appointments.
     *
     * @param list<string> $targetTypes
     * @param list<int> $targetIds
     * @return list<array<string, mixed>>
     */
    public function findAuditEventsForTargets(array $targetTypes, array $targetIds, ?int $actorUserId = null, int $limit = 100): array
    {
        $pdo = $this->database->getConnection();
        $conditions = [];
        $params = [];

        if (!empty($targetTypes) && !empty($targetIds)) {
            $tPhs = [];
            foreach ($targetTypes as $i => $t) {
                $k = ":t_{$i}";
                $tPhs[] = $k;
                $params[$k] = $t;
            }
            $idPhs = [];
            foreach (array_values(array_unique($targetIds)) as $i => $id) {
                $k = ":tid_{$i}";
                $idPhs[] = $k;
                $params[$k] = (int) $id;
            }
            $conditions[] = '(al.target_type IN (' . implode(', ', $tPhs) . ') AND al.target_id IN (' . implode(', ', $idPhs) . '))';
        }

        if ($actorUserId !== null && $actorUserId > 0) {
            $conditions[] = 'al.actor_user_id = :actor_uid';
            $params[':actor_uid'] = $actorUserId;
        }

        if (empty($conditions)) {
            return [];
        }

        $whereSql = implode(' OR ', $conditions);
        $stmt = $pdo->prepare("
            SELECT
                al.id, al.actor_user_id, al.action, al.target_type, al.target_id,
                al.sanitized_payload, al.created_at,
                u.email AS actor_email,
                u.role AS actor_role,
                u.first_name AS actor_first_name,
                u.last_name AS actor_last_name,
                u.is_active AS actor_is_active
            FROM audit_logs al
            LEFT JOIN users u ON al.actor_user_id = u.id
            WHERE {$whereSql}
            ORDER BY al.created_at DESC, al.id DESC
            LIMIT :lim
        ");
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':lim', max(1, min(200, $limit)), PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Fetch chronological `appointment_status_history` rows for one or more appointment IDs.
     *
     * @param list<int> $appointmentIds
     * @return list<array<string, mixed>>
     */
    public function findAppointmentStatusHistory(array $appointmentIds, int $limit = 100): array
    {
        if (empty($appointmentIds)) {
            return [];
        }
        $pdo = $this->database->getConnection();
        $params = [];
        $phs = [];
        foreach (array_values(array_unique($appointmentIds)) as $idx => $id) {
            $k = ":aid_{$idx}";
            $phs[] = $k;
            $params[$k] = (int) $id;
        }

        $stmt = $pdo->prepare('
            SELECT
                ash.id, ash.appointment_id, ash.old_status, ash.new_status,
                ash.actor_user_id, ash.reason, ash.metadata, ash.created_at,
                u.email AS actor_email,
                u.role AS actor_role,
                u.first_name AS actor_first_name,
                u.last_name AS actor_last_name,
                u.is_active AS actor_is_active
            FROM appointment_status_history ash
            LEFT JOIN users u ON ash.actor_user_id = u.id
            WHERE ash.appointment_id IN (' . implode(', ', $phs) . ')
            ORDER BY ash.created_at DESC, ash.id DESC
            LIMIT :lim
        ');
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v, PDO::PARAM_INT);
        }
        $stmt->bindValue(':lim', max(1, min(200, $limit)), PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Fetch append-only `archive_history` rows for an entity (or user account across cycles).
     *
     * @return list<array<string, mixed>>
     */
    public function findArchiveHistoryForEntity(string $entityType, int $entityId, ?int $userId = null, int $limit = 100): array
    {
        $pdo = $this->database->getConnection();
        $clauses = ['(ah.entity_type = :et AND ah.entity_id = :eid)'];
        $params = [
            ':et' => strtolower($entityType),
            ':eid' => $entityId,
        ];

        if ($userId !== null && $userId > 0) {
            $clauses[] = "(ah.entity_type = 'user' AND ah.entity_id = :uid)";
            $params[':uid'] = $userId;
        }

        $whereSql = implode(' OR ', $clauses);
        $stmt = $pdo->prepare("
            SELECT
                ah.id, ah.archive_record_id, ah.entity_type, ah.entity_id, ah.account_type,
                ah.event_type, ah.actor_user_id, ah.actor_role, ah.reason, ah.metadata, ah.created_at,
                ar.reference_code,
                u.email AS actor_email,
                u.first_name AS actor_first_name,
                u.last_name AS actor_last_name,
                u.is_active AS actor_is_active
            FROM archive_history ah
            LEFT JOIN archive_records ar ON ah.archive_record_id = ar.id
            LEFT JOIN users u ON ah.actor_user_id = u.id
            WHERE {$whereSql}
            ORDER BY ah.created_at DESC, ah.id DESC
            LIMIT :lim
        ");
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':lim', max(1, min(200, $limit)), PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Return appointment IDs belonging to a patient.
     *
     * @return list<int>
     */
    public function findAppointmentIdsForPatient(int $patientId, int $limit = 100): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('SELECT id FROM appointments WHERE patient_id = :pid ORDER BY start_at DESC LIMIT :lim');
        $stmt->bindValue(':pid', $patientId, PDO::PARAM_INT);
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();
        return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    }

    /**
     * Return appointment IDs assigned to a dentist.
     *
     * @return list<int>
     */
    public function findAppointmentIdsForDentist(int $dentistId, int $limit = 100): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('SELECT id FROM appointments WHERE dentist_id = :did ORDER BY start_at DESC LIMIT :lim');
        $stmt->bindValue(':did', $dentistId, PDO::PARAM_INT);
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();
        return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    }

    /**
     * Check whether a dentist has ever been assigned to a given patient's appointment.
     */
    public function dentistHasPatientRelationship(int $dentistId, int $patientId): bool
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('SELECT 1 FROM appointments WHERE dentist_id = :did AND patient_id = :pid LIMIT 1');
        $stmt->execute([':did' => $dentistId, ':pid' => $patientId]);
        return (bool) $stmt->fetchColumn();
    }
}
