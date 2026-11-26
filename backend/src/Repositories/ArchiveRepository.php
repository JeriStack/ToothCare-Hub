<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use App\Support\ServerTableQuery;
use PDO;

/**
 * Compliance Archive Repository
 *
 * Persists and queries tamper-evident archive snapshots with strict server-side
 * role & ownership scoping so unauthorized users never view or count records
 * outside their audit domain.
 */
class ArchiveRepository
{
    public const ENTITY_TYPES = [
        'appointment',
        'treatment_record',
        'patient',
        'dentist',
        'service',
        'user',
    ];

    public const STATUSES = [
        'ARCHIVED',
        'RESTORED',
        'LOCKED_RETENTION',
    ];

    public const RETENTION_CATEGORIES = [
        'CLINICAL_7Y',
        'OPERATIONAL_3Y',
        'ACCOUNT_5Y',
        'CATALOG_LEGACY',
    ];

    public const ACCOUNT_TYPES = [
        'PATIENT',
        'DENTIST',
        'RECEPTIONIST',
        'ADMIN',
    ];

    public const SORT_ALLOWLIST = [
        'archived_at' => 'ar.archived_at',
        'entity_type' => 'ar.entity_type',
        'account_type' => 'ar.account_type',
        'status' => 'ar.status',
        'retention_until' => 'ar.retention_until',
        'title' => 'ar.title',
        'reference_code' => 'ar.reference_code',
        'id' => 'ar.id',
    ];

    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * Build mandatory role/ownership WHERE predicates applied to EVERY read query.
     *
     * @param array{role: string, user_id: int, patient_id: ?int, dentist_id: ?int, allowed_types: list<string>} $scope
     * @param array<string, mixed> $params
     * @return list<string>
     */
    private function buildScopeClauses(array $scope, array &$params): array
    {
        $role = strtoupper($scope['role']);
        $allowedTypes = $scope['allowed_types'];
        if (empty($allowedTypes)) {
            return ['1 = 0'];
        }

        $typePlaceholders = [];
        foreach ($allowedTypes as $idx => $type) {
            $key = ":scope_type_{$idx}";
            $typePlaceholders[] = $key;
            $params[$key] = $type;
        }
        $clauses = ['ar.entity_type IN (' . implode(', ', $typePlaceholders) . ')'];

        if ($role === 'PATIENT') {
            $patientId = $scope['patient_id'];
            if ($patientId !== null && $patientId > 0) {
                $clauses[] = '(ar.owner_patient_id = :scope_patient_id OR ar.is_example = 1)';
                $params[':scope_patient_id'] = $patientId;
            } else {
                $clauses[] = 'ar.is_example = 1';
            }
        } elseif ($role === 'DENTIST') {
            $dentistId = $scope['dentist_id'];
            if ($dentistId !== null && $dentistId > 0) {
                $clauses[] = '(ar.owner_dentist_id = :scope_dentist_id OR ar.is_example = 1)';
                $params[':scope_dentist_id'] = $dentistId;
            } else {
                $clauses[] = 'ar.is_example = 1';
            }
        }

        return $clauses;
    }

    /**
     * Retrieve a single archive record by ID (joins actor emails for audit provenance).
     *
     * @return array<string, mixed>|null
     */
    public function findById(int $id): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT ar.id, ar.entity_type, ar.entity_id, ar.account_type, ar.reference_code,
                   ar.title, ar.summary, ar.archived_email,
                   ar.owner_patient_id, ar.owner_dentist_id, ar.owner_user_id,
                   ar.status, ar.retention_category, ar.retention_until,
                   ar.archive_reason, ar.archived_by_user_id, ar.archived_by_role, ar.archived_at,
                   ar.restored_by_user_id, ar.restored_at, ar.restore_reason,
                   ar.snapshot_json, ar.snapshot_sha256, ar.is_example,
                   ar.created_at, ar.updated_at,
                   u_arch.email AS archived_by_email,
                   u_rest.email AS restored_by_email
            FROM archive_records ar
            LEFT JOIN users u_arch ON ar.archived_by_user_id = u_arch.id
            LEFT JOIN users u_rest ON ar.restored_by_user_id = u_rest.id
            WHERE ar.id = :id
            LIMIT 1
        ');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Check if an entity already has an active (ARCHIVED or LOCKED_RETENTION) archive entry.
     *
     * @return array<string, mixed>|null
     */
    public function findActiveByEntity(string $entityType, int $entityId): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare("
            SELECT id, reference_code, status, archived_at
            FROM archive_records
            WHERE entity_type = :entity_type
              AND entity_id = :entity_id
              AND status IN ('ARCHIVED', 'LOCKED_RETENTION')
            ORDER BY id DESC
            LIMIT 1
        ");
        $stmt->execute([
            ':entity_type' => $entityType,
            ':entity_id' => $entityId,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Persist a new archive record.
     *
     * @param array<string, mixed> $data
     */
    public function create(array $data): int
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            INSERT INTO archive_records (
                entity_type, entity_id, account_type, reference_code, title, summary, archived_email,
                owner_patient_id, owner_dentist_id, owner_user_id,
                status, retention_category, retention_until,
                archive_reason, archived_by_user_id, archived_by_role, archived_at,
                snapshot_json, snapshot_sha256, is_example, created_at, updated_at
            ) VALUES (
                :entity_type, :entity_id, :account_type, :reference_code, :title, :summary, :archived_email,
                :owner_patient_id, :owner_dentist_id, :owner_user_id,
                :status, :retention_category, :retention_until,
                :archive_reason, :archived_by_user_id, :archived_by_role, NOW(),
                :snapshot_json, :snapshot_sha256, :is_example, NOW(), NOW()
            )
        ');

        $stmt->execute([
            ':entity_type' => $data['entity_type'],
            ':entity_id' => $data['entity_id'],
            ':account_type' => $data['account_type'] ?? null,
            ':reference_code' => $data['reference_code'],
            ':title' => $data['title'],
            ':summary' => $data['summary'] ?? null,
            ':archived_email' => $data['archived_email'] ?? null,
            ':owner_patient_id' => $data['owner_patient_id'] ?? null,
            ':owner_dentist_id' => $data['owner_dentist_id'] ?? null,
            ':owner_user_id' => $data['owner_user_id'] ?? null,
            ':status' => $data['status'] ?? 'ARCHIVED',
            ':retention_category' => $data['retention_category'] ?? 'OPERATIONAL_3Y',
            ':retention_until' => $data['retention_until'] ?? null,
            ':archive_reason' => $data['archive_reason'],
            ':archived_by_user_id' => $data['archived_by_user_id'] ?? null,
            ':archived_by_role' => $data['archived_by_role'] ?? 'SYSTEM',
            ':snapshot_json' => $data['snapshot_json'],
            ':snapshot_sha256' => $data['snapshot_sha256'],
            ':is_example' => (int) ($data['is_example'] ?? 0),
        ]);

        return (int) $pdo->lastInsertId();
    }

    /**
     * Count prior archive cycles for an entity so repeated archival is tagged REARCHIVED.
     */
    public function countCyclesForEntity(string $entityType, int $entityId): int
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT COUNT(*)
            FROM archive_records
            WHERE entity_type = :et AND entity_id = :eid
        ');
        $stmt->execute([':et' => $entityType, ':eid' => $entityId]);
        return (int) $stmt->fetchColumn();
    }

    /**
     * Append an immutable archival/restoration cycle event into `archive_history`.
     *
     * @param array<string, mixed>|null $metadata
     */
    public function recordHistoryEvent(
        int $archiveRecordId,
        string $entityType,
        int $entityId,
        ?string $accountType,
        string $eventType,
        ?int $actorUserId,
        string $actorRole,
        string $reason,
        ?array $metadata = null
    ): int {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            INSERT INTO archive_history (
                archive_record_id, entity_type, entity_id, account_type,
                event_type, actor_user_id, actor_role, reason, metadata, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ');
        $stmt->execute([
            $archiveRecordId,
            $entityType,
            $entityId,
            $accountType,
            strtoupper($eventType),
            $actorUserId,
            strtoupper($actorRole),
            $reason,
            $metadata !== null ? json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
        ]);

        return (int) $pdo->lastInsertId();
    }

    /**
     * Retrieve full multi-cycle archive/restore history for an entity (never overwritten).
     *
     * @return list<array<string, mixed>>
     */
    public function findCycleHistoryForEntity(string $entityType, int $entityId): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT
                ah.id, ah.archive_record_id, ah.entity_type, ah.entity_id, ah.account_type,
                ah.event_type, ah.actor_user_id, ah.actor_role, ah.reason, ah.metadata, ah.created_at,
                ar.reference_code,
                u.email AS actor_email,
                u.first_name AS actor_first_name,
                u.last_name AS actor_last_name
            FROM archive_history ah
            LEFT JOIN archive_records ar ON ah.archive_record_id = ar.id
            LEFT JOIN users u ON ah.actor_user_id = u.id
            WHERE ah.entity_type = :et AND ah.entity_id = :eid
            ORDER BY ah.created_at DESC, ah.id DESC
            LIMIT 100
        ');
        $stmt->execute([':et' => $entityType, ':eid' => $entityId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Find unresolved (PENDING / CONFIRMED) appointments for a patient that must be resolved before archival.
     *
     * @return list<array<string, mixed>>
     */
    public function findUnresolvedAppointmentsForPatient(int $patientId): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare("
            SELECT a.id, a.status, a.start_at, a.end_at, a.dentist_id,
                   s.name AS service_name
            FROM appointments a
            LEFT JOIN services s ON a.service_id = s.id
            WHERE a.patient_id = :pid
              AND a.status IN ('PENDING', 'CONFIRMED')
            ORDER BY a.start_at ASC
            LIMIT 25
        ");
        $stmt->execute([':pid' => $patientId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Find unresolved (PENDING / CONFIRMED) appointments assigned to a dentist before archival.
     *
     * @return list<array<string, mixed>>
     */
    public function findUnresolvedAppointmentsForDentist(int $dentistId): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare("
            SELECT a.id, a.status, a.start_at, a.end_at, a.patient_id,
                   s.name AS service_name
            FROM appointments a
            LEFT JOIN services s ON a.service_id = s.id
            WHERE a.dentist_id = :did
              AND a.status IN ('PENDING', 'CONFIRMED')
            ORDER BY a.start_at ASC
            LIMIT 25
        ");
        $stmt->execute([':did' => $dentistId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Mark a reversible archive record as RESTORED with actor & reason provenance.
     */
    public function markRestored(int $id, int $restoredByUserId, string $reason): bool
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare("
            UPDATE archive_records
            SET status = 'RESTORED',
                restored_by_user_id = :user_id,
                restored_at = NOW(),
                restore_reason = :reason,
                updated_at = NOW()
            WHERE id = :id
              AND status = 'ARCHIVED'
        ");

        $stmt->execute([
            ':user_id' => $restoredByUserId,
            ':reason' => $reason,
            ':id' => $id,
        ]);

        return $stmt->rowCount() > 0;
    }

    /**
     * Build shared role-scoped + user-filtered WHERE clauses and bound parameters.
     *
     * @param array{role: string, user_id: int, patient_id: ?int, dentist_id: ?int, allowed_types: list<string>} $scope
     * @param array<string, mixed> $filters
     * @return array{base_where: string, base_params: array<string, mixed>, where: string, params: array<string, mixed>, has_user_filters: bool, sort: array<string, mixed>}
     */
    private function buildFilteredQuery(array $scope, array $filters = []): array
    {
        $baseParams = [];
        $scopeClauses = $this->buildScopeClauses($scope, $baseParams);
        $baseWhereSql = implode(' AND ', $scopeClauses);

        $userClauses = [];
        $params = $baseParams;

        if (!empty($filters['entity_type'])) {
            $userClauses[] = 'ar.entity_type = :entity_type';
            $params[':entity_type'] = strtolower(trim((string) $filters['entity_type']));
        }
        if (!empty($filters['account_type'])) {
            $userClauses[] = 'ar.account_type = :account_type';
            $params[':account_type'] = strtoupper(trim((string) $filters['account_type']));
        }
        if (!empty($filters['archived_by_user_id'])) {
            $userClauses[] = 'ar.archived_by_user_id = :archived_by_user_id';
            $params[':archived_by_user_id'] = (int) $filters['archived_by_user_id'];
        }
        if (!empty($filters['status'])) {
            $userClauses[] = 'ar.status = :status';
            $params[':status'] = strtoupper(trim((string) $filters['status']));
        }
        if (!empty($filters['retention_category'])) {
            $userClauses[] = 'ar.retention_category = :retention_category';
            $params[':retention_category'] = strtoupper(trim((string) $filters['retention_category']));
        }
        if (array_key_exists('include_examples', $filters) && $filters['include_examples'] === false) {
            $userClauses[] = 'ar.is_example = 0';
        }
        if (!empty($filters['date_from'])) {
            $userClauses[] = 'ar.archived_at >= :date_from';
            $params[':date_from'] = trim((string) $filters['date_from']) . ' 00:00:00';
        }
        if (!empty($filters['date_to'])) {
            $userClauses[] = 'ar.archived_at <= :date_to';
            $params[':date_to'] = trim((string) $filters['date_to']) . ' 23:59:59';
        }
        if (!empty($filters['search']) && trim((string) $filters['search']) !== '') {
            $term = '%' . ServerTableQuery::escapeLike((string) $filters['search']) . '%';
            $userClauses[] = "(ar.reference_code LIKE :s1 ESCAPE '!' OR ar.title LIKE :s2 ESCAPE '!' OR ar.summary LIKE :s3 ESCAPE '!' OR ar.archive_reason LIKE :s4 ESCAPE '!' OR ar.archived_email LIKE :s5 ESCAPE '!')";
            $params[':s1'] = $term;
            $params[':s2'] = $term;
            $params[':s3'] = $term;
            $params[':s4'] = $term;
            $params[':s5'] = $term;
        }

        $hasUserFilters = count($userClauses) > 0;
        $whereSql = $hasUserFilters
            ? $baseWhereSql . ' AND ' . implode(' AND ', $userClauses)
            : $baseWhereSql;

        $sort = ServerTableQuery::parseSort(
            $filters,
            self::SORT_ALLOWLIST,
            'archived_at',
            'DESC',
            'ar.id',
            false
        );

        return [
            'base_where' => $baseWhereSql,
            'base_params' => $baseParams,
            'where' => $whereSql,
            'params' => $params,
            'has_user_filters' => $hasUserFilters,
            'sort' => $sort,
        ];
    }

    /**
     * Server-side paginated, sorted, searchable, role-scoped archive listing.
     *
     * @param array{role: string, user_id: int, patient_id: ?int, dentist_id: ?int, allowed_types: list<string>} $scope
     * @param array<string, mixed> $filters
     * @return array{data: list<array<string, mixed>>, meta: array<string, mixed>}
     */
    public function listForActor(array $scope, array $filters = [], int $page = 1, int $perPage = 10): array
    {
        $pdo = $this->database->getConnection();
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $offset = ($page - 1) * $perPage;

        $q = $this->buildFilteredQuery($scope, $filters);

        // Filtered count within actor's authorized scope
        $filteredStmt = $pdo->prepare("SELECT COUNT(*) FROM archive_records ar WHERE {$q['where']}");
        $filteredStmt->execute($q['params']);
        $filteredTotal = (int) $filteredStmt->fetchColumn();

        // Unfiltered total strictly within actor's authorized scope (never leaks other roles/users)
        if ($q['has_user_filters']) {
            $baseStmt = $pdo->prepare("SELECT COUNT(*) FROM archive_records ar WHERE {$q['base_where']}");
            $baseStmt->execute($q['base_params']);
            $totalRecords = (int) $baseStmt->fetchColumn();
        } else {
            $totalRecords = $filteredTotal;
        }

        $sql = "
            SELECT ar.id, ar.entity_type, ar.entity_id, ar.account_type, ar.reference_code,
                   ar.title, ar.summary, ar.archived_email,
                   ar.owner_patient_id, ar.owner_dentist_id, ar.owner_user_id,
                   ar.status, ar.retention_category, ar.retention_until,
                   ar.archive_reason, ar.archived_by_user_id, ar.archived_by_role, ar.archived_at,
                   ar.restored_by_user_id, ar.restored_at, ar.restore_reason,
                   ar.snapshot_sha256, ar.is_example,
                   u_arch.email AS archived_by_email,
                   u_rest.email AS restored_by_email
            FROM archive_records ar
            LEFT JOIN users u_arch ON ar.archived_by_user_id = u_arch.id
            LEFT JOIN users u_rest ON ar.restored_by_user_id = u_rest.id
            WHERE {$q['where']}
            ORDER BY {$q['sort']['order_by_sql']}
            LIMIT :limit OFFSET :offset
        ";

        $stmt = $pdo->prepare($sql);
        foreach ($q['params'] as $k => $v) {
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
                $q['sort']['sort_by'],
                $q['sort']['sort_dir']
            ),
        ];
    }

    /**
     * Bounded role-scoped archive export query (up to 5,000 rows matching AuditLogRepository::exportCsv).
     *
     * @param array{role: string, user_id: int, patient_id: ?int, dentist_id: ?int, allowed_types: list<string>} $scope
     * @param array<string, mixed> $filters
     * @return list<array<string, mixed>>
     */
    public function listForExport(array $scope, array $filters = [], int $limit = 5000): array
    {
        $pdo = $this->database->getConnection();
        $safeLimit = max(1, min(5000, $limit));
        $q = $this->buildFilteredQuery($scope, $filters);

        $sql = "
            SELECT ar.id, ar.entity_type, ar.entity_id, ar.account_type, ar.reference_code,
                   ar.title, ar.summary, ar.archived_email,
                   ar.owner_patient_id, ar.owner_dentist_id, ar.owner_user_id,
                   ar.status, ar.retention_category, ar.retention_until,
                   ar.archive_reason, ar.archived_by_user_id, ar.archived_by_role, ar.archived_at,
                   ar.restored_by_user_id, ar.restored_at, ar.restore_reason,
                   ar.snapshot_sha256, ar.is_example,
                   u_arch.email AS archived_by_email,
                   u_rest.email AS restored_by_email
            FROM archive_records ar
            LEFT JOIN users u_arch ON ar.archived_by_user_id = u_arch.id
            LEFT JOIN users u_rest ON ar.restored_by_user_id = u_rest.id
            WHERE {$q['where']}
            ORDER BY {$q['sort']['order_by_sql']}
            LIMIT :limit
        ";

        $stmt = $pdo->prepare($sql);
        foreach ($q['params'] as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $safeLimit, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Aggregate role-scoped archive KPIs without exposing unauthorized domains.
     *
     * @param array{role: string, user_id: int, patient_id: ?int, dentist_id: ?int, allowed_types: list<string>} $scope
     * @return array<string, mixed>
     */
    public function summaryForActor(array $scope): array
    {
        $pdo = $this->database->getConnection();
        $params = [];
        $whereSql = implode(' AND ', $this->buildScopeClauses($scope, $params));

        $stmt = $pdo->prepare("
            SELECT
                COUNT(*) AS total_records,
                COALESCE(SUM(CASE WHEN ar.status = 'ARCHIVED' THEN 1 ELSE 0 END), 0) AS active_archived,
                COALESCE(SUM(CASE WHEN ar.status = 'LOCKED_RETENTION' THEN 1 ELSE 0 END), 0) AS locked_retention,
                COALESCE(SUM(CASE WHEN ar.status = 'RESTORED' THEN 1 ELSE 0 END), 0) AS restored_count,
                COALESCE(SUM(CASE WHEN ar.is_example = 1 THEN 1 ELSE 0 END), 0) AS example_count
            FROM archive_records ar
            WHERE {$whereSql}
        ");
        $stmt->execute($params);
        $totals = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $byTypeStmt = $pdo->prepare("
            SELECT ar.entity_type, COUNT(*) AS total
            FROM archive_records ar
            WHERE {$whereSql}
            GROUP BY ar.entity_type
        ");
        $byTypeStmt->execute($params);
        $rawTypes = $byTypeStmt->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

        $byType = [];
        foreach ($scope['allowed_types'] as $t) {
            $byType[$t] = (int) ($rawTypes[$t] ?? 0);
        }

        $byAccountStmt = $pdo->prepare("
            SELECT ar.account_type, COUNT(*) AS total
            FROM archive_records ar
            WHERE {$whereSql}
              AND ar.account_type IS NOT NULL
              AND ar.status = 'ARCHIVED'
            GROUP BY ar.account_type
        ");
        $byAccountStmt->execute($params);
        $rawAccountTypes = $byAccountStmt->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

        $byAccountType = [
            'PATIENT' => (int) ($rawAccountTypes['PATIENT'] ?? 0),
            'DENTIST' => (int) ($rawAccountTypes['DENTIST'] ?? 0),
            'RECEPTIONIST' => (int) ($rawAccountTypes['RECEPTIONIST'] ?? 0),
            'ADMIN' => (int) ($rawAccountTypes['ADMIN'] ?? 0),
        ];

        return [
            'total_records' => (int) ($totals['total_records'] ?? 0),
            'active_archived' => (int) ($totals['active_archived'] ?? 0),
            'locked_retention' => (int) ($totals['locked_retention'] ?? 0),
            'restored_count' => (int) ($totals['restored_count'] ?? 0),
            'example_count' => (int) ($totals['example_count'] ?? 0),
            'by_entity_type' => $byType,
            'by_account_type' => $byAccountType,
        ];
    }
}
