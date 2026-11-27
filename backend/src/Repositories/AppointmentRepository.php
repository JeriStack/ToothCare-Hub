<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use App\Support\ServerTableQuery;
use PDO;

/**
 * Appointment Repository
 * Handles appointment persistence, interval queries, status updates, locking, and conflict detection.
 */
class AppointmentRepository
{
    public const ADMIN_SORT_ALLOWLIST = [
        'id' => 'a.id',
        'start_at' => 'a.start_at',
        'created_at' => 'a.created_at',
        'status' => 'a.status',
        'patient_name' => ['p.last_name', 'p.first_name'],
        'dentist_name' => ['d.last_name', 'd.first_name'],
        'service_name' => 's.name',
    ];

    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * Find appointment by ID with joined dentist, patient, and service details.
     *
     * @return array<string, mixed>|null
     */
    public function findById(int $id): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT a.*,
                   COALESCE(NULLIF(a.operatory_chair, \'\'), d.default_operatory_chair, \'Chair 1\') AS dentist_room_number,
                   p.first_name AS patient_first_name, p.last_name AS patient_last_name, p.phone AS patient_phone,
                   p.medical_alerts AS patient_medical_alerts, p.date_of_birth AS patient_date_of_birth, p.gender AS patient_gender,
                   u_p.id AS patient_user_id, u_p.email AS patient_email,
                   d.license_number, d.specialization, d.default_operatory_chair, d.is_active AS dentist_is_active,
                   d.first_name AS dentist_first_name, d.last_name AS dentist_last_name,
                   u_d.id AS dentist_user_id, u_d.email AS dentist_email,
                   s.name AS service_name, s.duration_minutes AS service_duration, s.category AS service_category
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN users u_p ON p.user_id = u_p.id
            JOIN dentists d ON a.dentist_id = d.id
            JOIN users u_d ON d.user_id = u_d.id
            JOIN services s ON a.service_id = s.id
            WHERE a.id = ?
            LIMIT 1
        ');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Pessimistically lock a dentist row for update.
     * Used as transaction synchronization anchor to prevent concurrent booking conflicts.
     *
     * @return array<string, mixed>|null
     */
    public function lockDentist(int $dentistId, ?PDO $pdo = null): ?array
    {
        $db = $pdo ?? $this->database->getConnection();
        $isSqlite = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
        $sql = 'SELECT id, is_active FROM dentists WHERE id = ?' . ($isSqlite ? '' : ' FOR UPDATE');
        $stmt = $db->prepare($sql);
        $stmt->execute([$dentistId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Pessimistically lock an appointment row for update.
     * Used for atomic lifecycle transitions (confirm, reject, cancel, complete).
     *
     * @return array<string, mixed>|null
     */
    public function findByIdForUpdate(int $id, ?PDO $pdo = null): ?array
    {
        $db = $pdo ?? $this->database->getConnection();
        $isSqlite = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
        $sql = 'SELECT * FROM appointments WHERE id = ?' . ($isSqlite ? '' : ' FOR UPDATE');
        $stmt = $db->prepare($sql);
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Retrieve blocking appointments for a dentist within a date-time range.
     * Statuses that block: PENDING, CONFIRMED.
     * Uses half-open interval comparison [start_at, end_at):
     * appointment_start < candidate_end AND appointment_end > candidate_start.
     *
     * @return list<array<string, mixed>>
     */
    public function findBlockingByDentistAndRange(
        int $dentistId,
        string $startAt,
        string $endAt,
        ?int $excludeId = null,
        ?PDO $pdo = null
    ): array {
        $db = $pdo ?? $this->database->getConnection();
        $sql = "
            SELECT id, patient_id, dentist_id, service_id, start_at, end_at, duration_snapshot,
                   status, operatory_chair
            FROM appointments
            WHERE dentist_id = :dentist_id
              AND status IN ('PENDING', 'CONFIRMED')
              AND start_at < :end_at
              AND end_at > :start_at
        ";
        $params = [
            ':dentist_id' => $dentistId,
            ':start_at' => $startAt,
            ':end_at' => $endAt,
        ];

        if ($excludeId !== null) {
            $sql .= ' AND id != :exclude_id';
            $params[':exclude_id'] = $excludeId;
        }

        $sql .= ' ORDER BY start_at ASC';

        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Check for any overlapping blocking appointments.
     *
     * @return list<array<string, mixed>>
     */
    public function findOverlappingForDentist(
        int $dentistId,
        string $startAt,
        string $endAt,
        ?int $excludeAppointmentId = null,
        ?PDO $pdo = null
    ): array {
        return $this->findBlockingByDentistAndRange($dentistId, $startAt, $endAt, $excludeAppointmentId, $pdo);
    }

    /**
     * Check for overlapping blocking appointments occupying the same operatory chair/room
     * assigned to another practitioner.
     *
     * @return list<array<string, mixed>>
     */
    public function findRoomConflicts(
        string $operatoryChair,
        string $startAt,
        string $endAt,
        int $excludeDentistId,
        ?int $excludeAppointmentId = null,
        ?PDO $pdo = null
    ): array {
        $chair = trim($operatoryChair);
        if ($chair === '') {
            return [];
        }

        $db = $pdo ?? $this->database->getConnection();
        $sql = "
            SELECT id, dentist_id, start_at, end_at, duration_snapshot, status, operatory_chair
            FROM appointments
            WHERE operatory_chair = :chair
              AND dentist_id != :exclude_dentist_id
              AND status IN ('PENDING', 'CONFIRMED')
              AND start_at < :end_at
              AND end_at > :start_at
        ";
        $params = [
            ':chair' => $chair,
            ':exclude_dentist_id' => $excludeDentistId,
            ':start_at' => $startAt,
            ':end_at' => $endAt,
        ];

        if ($excludeAppointmentId !== null) {
            $sql .= ' AND id != :exclude_id';
            $params[':exclude_id'] = $excludeAppointmentId;
        }

        $sql .= ' ORDER BY start_at ASC';

        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Retrieve operational triage summary counts using index-friendly Asia/Manila boundaries.
     *
     * @return array{pending_review: int, confirmed: int, today_appointments: int}
     */
    public function getTriageSummaryCounts(string $todayStart, string $todayEnd): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare("
            SELECT
                COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0) AS pending_review,
                COALESCE(SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END), 0) AS confirmed,
                COALESCE(SUM(CASE WHEN start_at >= :today_start AND start_at <= :today_end AND status IN ('PENDING', 'CONFIRMED', 'COMPLETED') THEN 1 ELSE 0 END), 0) AS today_appointments
            FROM appointments
        ");
        $stmt->execute([
            ':today_start' => $todayStart,
            ':today_end' => $todayEnd,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'pending_review' => (int) ($row['pending_review'] ?? 0),
            'confirmed' => (int) ($row['confirmed'] ?? 0),
            'today_appointments' => (int) ($row['today_appointments'] ?? 0),
        ];
    }

    /**
     * Stream PENDING appointments using keyset pagination (WHERE status = 'PENDING' AND id > :after_id).
     * Avoids offset degradation and eliminates arbitrary record caps while keeping memory bounded.
     *
     * @return list<array<string, mixed>>
     */
    public function findPendingChunkAfterId(int $afterId = 0, int $chunkSize = 500): array
    {
        $pdo = $this->database->getConnection();
        $chunkSize = max(1, min(1000, $chunkSize));
        $stmt = $pdo->prepare("
            SELECT id, dentist_id, service_id, start_at, end_at, duration_snapshot, operatory_chair, status
            FROM appointments
            WHERE status = 'PENDING'
              AND id > :after_id
            ORDER BY id ASC
            LIMIT :limit
        ");
        $stmt->bindValue(':after_id', max(0, $afterId), PDO::PARAM_INT);
        $stmt->bindValue(':limit', $chunkSize, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Batch-fetch blocking appointments (PENDING/CONFIRMED) overlapping [minStartAt, maxEndAt]
     * for any of the specified dentist IDs or operatory chairs in a single query.
     *
     * @param list<int> $dentistIds
     * @param list<string> $operatoryChairs
     * @return list<array<string, mixed>>
     */
    public function findBlockingForBatch(
        array $dentistIds,
        array $operatoryChairs,
        string $minStartAt,
        string $maxEndAt
    ): array {
        $cleanDentists = array_values(array_unique(array_filter(array_map('intval', $dentistIds), static fn (int $id): bool => $id > 0)));
        $cleanChairs = array_values(array_unique(array_filter(array_map(static fn ($c): string => trim((string) $c), $operatoryChairs), static fn (string $c): bool => $c !== '')));

        if (empty($cleanDentists) && empty($cleanChairs)) {
            return [];
        }

        $pdo = $this->database->getConnection();
        $orParts = [];
        $params = [
            ':max_end' => $maxEndAt,
            ':min_start' => $minStartAt,
        ];

        if (!empty($cleanDentists)) {
            $placeholders = [];
            foreach ($cleanDentists as $i => $dId) {
                $key = ":d_{$i}";
                $placeholders[] = $key;
                $params[$key] = $dId;
            }
            $orParts[] = 'dentist_id IN (' . implode(', ', $placeholders) . ')';
        }

        if (!empty($cleanChairs)) {
            $placeholders = [];
            foreach ($cleanChairs as $i => $chair) {
                $key = ":c_{$i}";
                $placeholders[] = $key;
                $params[$key] = $chair;
            }
            $orParts[] = 'operatory_chair IN (' . implode(', ', $placeholders) . ')';
        }

        $scopeClause = implode(' OR ', $orParts);
        $sql = "
            SELECT id, dentist_id, service_id, start_at, end_at, duration_snapshot, status, operatory_chair
            FROM appointments
            WHERE status IN ('PENDING', 'CONFIRMED')
              AND start_at < :max_end
              AND end_at > :min_start
              AND ({$scopeClause})
            ORDER BY start_at ASC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Retrieve bounded pending appointments (retained for backward compatibility).
     *
     * @return list<array<string, mixed>>
     */
    public function findPendingForValidation(int $limit = 200): array
    {
        return $this->findPendingChunkAfterId(0, $limit);
    }

    /**
     * Create a new appointment record.
     *
     * @param array<string, mixed> $data
     */
    public function create(array $data, ?PDO $pdo = null): int
    {
        $db = $pdo ?? $this->database->getConnection();
        $stmt = $db->prepare('
            INSERT INTO appointments (
                patient_id, dentist_id, service_id, start_at, end_at,
                duration_snapshot, price_snapshot, status, chief_complaint,
                operatory_chair, rescheduled_from_id, created_at, updated_at
            ) VALUES (
                :patient_id, :dentist_id, :service_id, :start_at, :end_at,
                :duration_snapshot, :price_snapshot, :status, :chief_complaint,
                :operatory_chair, :rescheduled_from_id, NOW(), NOW()
            )
        ');

        $stmt->execute([
            ':patient_id' => $data['patient_id'],
            ':dentist_id' => $data['dentist_id'],
            ':service_id' => $data['service_id'],
            ':start_at' => $data['start_at'],
            ':end_at' => $data['end_at'],
            ':duration_snapshot' => $data['duration_snapshot'],
            ':price_snapshot' => $data['price_snapshot'],
            ':status' => $data['status'] ?? 'PENDING',
            ':chief_complaint' => $data['chief_complaint'] ?? null,
            ':operatory_chair' => $data['operatory_chair'] ?? 'Chair 1',
            ':rescheduled_from_id' => $data['rescheduled_from_id'] ?? null,
        ]);

        return (int) $db->lastInsertId();
    }

    /**
     * Append an immutable record into appointment_status_history.
     *
     * @param array<string, mixed>|null $metadata
     */
    public function recordStatusHistory(
        int $appointmentId,
        ?string $oldStatus,
        string $newStatus,
        ?int $actorUserId = null,
        ?string $reason = null,
        ?array $metadata = null,
        ?PDO $pdo = null
    ): int {
        $db = $pdo ?? $this->database->getConnection();
        $stmt = $db->prepare('
            INSERT INTO appointment_status_history (
                appointment_id, old_status, new_status, actor_user_id, reason, metadata, created_at
            ) VALUES (
                :appointment_id, :old_status, :new_status, :actor_user_id, :reason, :metadata, NOW()
            )
        ');

        $stmt->execute([
            ':appointment_id' => $appointmentId,
            ':old_status' => $oldStatus,
            ':new_status' => $newStatus,
            ':actor_user_id' => $actorUserId,
            ':reason' => $reason,
            ':metadata' => $metadata !== null ? json_encode($metadata, JSON_UNESCAPED_UNICODE) : null,
        ]);

        return (int) $db->lastInsertId();
    }

    /**
     * Retrieve complete immutable status history for an appointment.
     *
     * @return list<array<string, mixed>>
     */
    public function getStatusHistory(int $appointmentId): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT h.*, u.email AS actor_email, u.role AS actor_role
            FROM appointment_status_history h
            LEFT JOIN users u ON h.actor_user_id = u.id
            WHERE h.appointment_id = ?
            ORDER BY h.created_at ASC, h.id ASC
        ');
        $stmt->execute([$appointmentId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Update appointment status with associated audit tracking.
     */
    public function updateStatus(
        int $id,
        string $status,
        ?int $userId = null,
        ?string $reason = null,
        ?PDO $pdo = null
    ): bool {
        $db = $pdo ?? $this->database->getConnection();
        $fields = ['status = :status', 'updated_at = NOW()'];
        $params = [':id' => $id, ':status' => $status];

        if ($status === 'CANCELLED') {
            $fields[] = 'cancellation_reason = :reason';
            $fields[] = 'cancelled_by_user_id = :user_id';
            $fields[] = 'cancelled_at = NOW()';
            $params[':reason'] = $reason;
            $params[':user_id'] = $userId;
        } elseif ($status === 'CONFIRMED') {
            $fields[] = 'reviewed_by_user_id = :user_id';
            $fields[] = 'reviewed_at = NOW()';
            $params[':user_id'] = $userId;
        } elseif ($status === 'REJECTED') {
            $fields[] = 'reviewed_by_user_id = :user_id';
            $fields[] = 'reviewed_at = NOW()';
            $fields[] = 'cancellation_reason = :reason';
            $params[':user_id'] = $userId;
            $params[':reason'] = $reason;
        } elseif ($status === 'COMPLETED') {
            $fields[] = 'completed_at = NOW()';
        }

        $sql = 'UPDATE appointments SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $stmt = $db->prepare($sql);

        return $stmt->execute($params);
    }

    /**
     * List appointments for a patient with optional filters and pagination.
     *
     * @return array{items: list<array<string, mixed>>, total: int, page: int, per_page: int, total_pages: int}
     */
    public function findByPatient(
        int $patientId,
        ?string $status = null,
        ?string $from = null,
        ?string $to = null,
        int $page = 1,
        int $perPage = 20,
        ?int $dentistId = null,
        ?int $serviceId = null
    ): array {
        $pdo = $this->database->getConnection();
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $where = ['a.patient_id = :patient_id'];
        $params = [':patient_id' => $patientId];

        if ($status !== null && $status !== '') {
            $where[] = 'a.status = :status';
            $params[':status'] = strtoupper($status);
        }
        if ($from !== null && $from !== '') {
            $where[] = 'a.start_at >= :from';
            $params[':from'] = $from;
        }
        if ($to !== null && $to !== '') {
            $where[] = 'a.start_at <= :to';
            $params[':to'] = $to;
        }
        if ($dentistId !== null && $dentistId > 0) {
            $where[] = 'a.dentist_id = :dentist_id';
            $params[':dentist_id'] = $dentistId;
        }
        if ($serviceId !== null && $serviceId > 0) {
            $where[] = 'a.service_id = :service_id';
            $params[':service_id'] = $serviceId;
        }

        $whereClause = implode(' AND ', $where);
        $hasUserFilters = count($where) > 1;

        // Filtered count (strictly scoped to patient_id)
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM appointments a WHERE {$whereClause}");
        $countStmt->execute($params);
        $filteredTotal = (int) $countStmt->fetchColumn();

        // Unfiltered authorized count for this patient (prevents inferring other patients' records)
        if ($hasUserFilters) {
            $baseStmt = $pdo->prepare('SELECT COUNT(*) FROM appointments WHERE patient_id = :patient_id');
            $baseStmt->execute([':patient_id' => $patientId]);
            $totalRecords = (int) $baseStmt->fetchColumn();
        } else {
            $totalRecords = $filteredTotal;
        }

        $offset = max(0, ($page - 1) * $perPage);
        $totalPages = $filteredTotal > 0 ? (int) ceil($filteredTotal / $perPage) : 1;

        $sql = "
            SELECT a.*,
                   d.first_name AS dentist_first_name, d.last_name AS dentist_last_name, d.specialization,
                   s.name AS service_name, s.duration_minutes AS service_duration
            FROM appointments a
            JOIN dentists d ON a.dentist_id = d.id
            JOIN services s ON a.service_id = s.id
            WHERE {$whereClause}
            ORDER BY a.start_at DESC, a.id DESC
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
            'items' => $stmt->fetchAll(PDO::FETCH_ASSOC),
            'total' => $filteredTotal,
            'total_records' => $totalRecords,
            'filtered_records' => $filteredTotal,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => $totalPages,
        ];
    }

    /**
     * List all appointments with comprehensive administrative filtering, allowlisted sorting, and pagination.
     *
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function findAllFiltered(array $filters = [], int $page = 1, int $perPage = 20): array
    {
        $pdo = $this->database->getConnection();
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $where = [];
        $params = [];

        if (!empty($filters['status'])) {
            $where[] = 'a.status = :status';
            $params[':status'] = strtoupper((string) $filters['status']);
        }
        if (!empty($filters['dentist_id'])) {
            $where[] = 'a.dentist_id = :dentist_id';
            $params[':dentist_id'] = (int) $filters['dentist_id'];
        }
        if (!empty($filters['service_id'])) {
            $where[] = 'a.service_id = :service_id';
            $params[':service_id'] = (int) $filters['service_id'];
        }
        if (!empty($filters['patient_id'])) {
            $where[] = 'a.patient_id = :patient_id';
            $params[':patient_id'] = (int) $filters['patient_id'];
        }
        if (!empty($filters['from'])) {
            $where[] = 'a.start_at >= :from';
            $params[':from'] = (string) $filters['from'];
        }
        if (!empty($filters['to'])) {
            $where[] = 'a.start_at <= :to';
            $params[':to'] = (string) $filters['to'];
        }
        if (!empty($filters['search']) && trim((string) $filters['search']) !== '') {
            $rawSearch = trim((string) $filters['search']);
            $escaped = ServerTableQuery::escapeLike($rawSearch);
            $searchTerm = '%' . $escaped . '%';
            $isSqlite = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
            $fullNameExpr = $isSqlite
                ? "(p.first_name || ' ' || p.last_name) LIKE :search6 ESCAPE '!'"
                : "CONCAT(p.first_name, ' ', p.last_name) LIKE :search6 ESCAPE '!'";
            $searchParts = [
                "p.first_name LIKE :search1 ESCAPE '!'",
                "p.last_name LIKE :search2 ESCAPE '!'",
                "u_p.email LIKE :search3 ESCAPE '!'",
                "p.phone LIKE :search4 ESCAPE '!'",
                "s.name LIKE :search5 ESCAPE '!'",
                $fullNameExpr,
            ];
            $params[':search1'] = $searchTerm;
            $params[':search2'] = $searchTerm;
            $params[':search3'] = $searchTerm;
            $params[':search4'] = $searchTerm;
            $params[':search5'] = $searchTerm;
            $params[':search6'] = $searchTerm;

            // Support reference lookups like "1066", "#1066", or "TC-001066"
            $normalizedRef = preg_replace('/^(?:TC-?|#)/i', '', $rawSearch);
            if ($normalizedRef !== null && $normalizedRef !== '' && ctype_digit($normalizedRef)) {
                $searchParts[] = 'a.id = :search_ref_id';
                $params[':search_ref_id'] = (int) ltrim($normalizedRef, '0') ?: (int) $normalizedRef;
            }

            $where[] = '(' . implode(' OR ', $searchParts) . ')';
        }

        $hasFilters = count($where) > 0;
        $whereClause = $hasFilters ? implode(' AND ', $where) : '1=1';

        $sort = ServerTableQuery::parseSort(
            $filters,
            self::ADMIN_SORT_ALLOWLIST,
            'start_at',
            'DESC',
            'a.id',
            false
        );

        // Filtered record count
        $countStmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN users u_p ON p.user_id = u_p.id
            JOIN dentists d ON a.dentist_id = d.id
            JOIN services s ON a.service_id = s.id
            WHERE {$whereClause}
        ");
        $countStmt->execute($params);
        $filteredTotal = (int) $countStmt->fetchColumn();

        // Unfiltered total count (avoids extra query when no filters are active)
        $totalRecords = $hasFilters
            ? (int) $pdo->query('SELECT COUNT(*) FROM appointments')->fetchColumn()
            : $filteredTotal;

        $offset = max(0, ($page - 1) * $perPage);
        $totalPages = $filteredTotal > 0 ? (int) ceil($filteredTotal / $perPage) : 1;

        $sql = "
            SELECT a.id, a.patient_id, a.dentist_id, a.service_id,
                   a.start_at, a.end_at, a.duration_snapshot, a.price_snapshot,
                   a.status, a.chief_complaint, a.operatory_chair,
                   a.rescheduled_from_id, a.cancellation_reason, a.cancelled_by_user_id,
                   a.cancelled_at, a.reviewed_by_user_id, a.reviewed_at, a.completed_at,
                   a.created_at, a.updated_at,
                   COALESCE(NULLIF(a.operatory_chair, ''), d.default_operatory_chair, 'Chair 1') AS dentist_room_number,
                   p.first_name AS patient_first_name, p.last_name AS patient_last_name, p.phone AS patient_phone,
                   u_p.email AS patient_email,
                   d.first_name AS dentist_first_name, d.last_name AS dentist_last_name, d.specialization,
                   d.default_operatory_chair, d.is_active AS dentist_is_active,
                   s.name AS service_name, s.duration_minutes AS service_duration, s.is_active AS service_is_active
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN users u_p ON p.user_id = u_p.id
            JOIN dentists d ON a.dentist_id = d.id
            JOIN services s ON a.service_id = s.id
            WHERE {$whereClause}
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
            'items' => $stmt->fetchAll(PDO::FETCH_ASSOC),
            'total' => $filteredTotal,
            'total_records' => $totalRecords,
            'filtered_records' => $filteredTotal,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => $totalPages,
            'sorting' => [
                'sort_by' => $sort['sort_by'],
                'sort_dir' => $sort['sort_dir'],
            ],
        ];
    }

    /**
     * List paginated appointments assigned to a dentist using SQL LIMIT/OFFSET
     * (avoids loading unbounded appointment tables into PHP memory).
     *
     * @return array{items: list<array<string, mixed>>, total: int, page: int, per_page: int, total_pages: int}
     */
    public function findByDentistPaginated(
        int $dentistId,
        ?string $from = null,
        ?string $to = null,
        ?string $status = null,
        ?string $search = null,
        ?int $serviceId = null,
        int $page = 1,
        int $perPage = 20
    ): array {
        $pdo = $this->database->getConnection();
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));

        $where = ['a.dentist_id = :dentist_id'];
        $params = [':dentist_id' => $dentistId];

        if ($from !== null && $from !== '') {
            $where[] = 'a.start_at >= :from';
            $params[':from'] = $from;
        }
        if ($to !== null && $to !== '') {
            $where[] = 'a.start_at <= :to';
            $params[':to'] = $to;
        }
        if ($status !== null && $status !== '' && $status !== 'ALL') {
            $where[] = 'a.status = :status';
            $params[':status'] = strtoupper($status);
        }
        if ($serviceId !== null && $serviceId > 0) {
            $where[] = 'a.service_id = :service_id';
            $params[':service_id'] = $serviceId;
        }
        if ($search !== null && trim($search) !== '') {
            $rawSearch = trim($search);
            $term = '%' . ServerTableQuery::escapeLike($rawSearch) . '%';
            $driver = (string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
            $fullNameExpr = $driver === 'sqlite'
                ? "(p.first_name || ' ' || p.last_name)"
                : "CONCAT(p.first_name, ' ', p.last_name)";
            $searchClauses = [
                "p.first_name LIKE :s1 ESCAPE '!'",
                "p.last_name LIKE :s2 ESCAPE '!'",
                "{$fullNameExpr} LIKE :s3 ESCAPE '!'",
                "p.phone LIKE :s4 ESCAPE '!'",
                "s.name LIKE :s5 ESCAPE '!'",
            ];
            $params[':s1'] = $term;
            $params[':s2'] = $term;
            $params[':s3'] = $term;
            $params[':s4'] = $term;
            $params[':s5'] = $term;

            $refNum = ltrim($rawSearch, '#');
            if (preg_match('/^(?:TC-)?(\d+)$/i', $refNum, $m) === 1) {
                $searchClauses[] = 'a.id = :s_id';
                $params[':s_id'] = (int) $m[1];
            }

            $where[] = '(' . implode(' OR ', $searchClauses) . ')';
        }

        $whereSql = implode(' AND ', $where);
        $hasUserFilters = count($where) > 1;

        $countStmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN services s ON a.service_id = s.id
            WHERE {$whereSql}
        ");
        $countStmt->execute($params);
        $filteredTotal = (int) $countStmt->fetchColumn();

        if ($hasUserFilters) {
            $baseStmt = $pdo->prepare('SELECT COUNT(*) FROM appointments WHERE dentist_id = :dentist_id');
            $baseStmt->execute([':dentist_id' => $dentistId]);
            $totalRecords = (int) $baseStmt->fetchColumn();
        } else {
            $totalRecords = $filteredTotal;
        }

        $offset = ($page - 1) * $perPage;
        $totalPages = $filteredTotal > 0 ? (int) ceil($filteredTotal / $perPage) : 1;

        $stmt = $pdo->prepare("
            SELECT a.*,
                   p.first_name AS patient_first_name, p.last_name AS patient_last_name,
                   p.phone AS patient_phone, p.medical_alerts AS patient_medical_alerts,
                   p.date_of_birth AS patient_date_of_birth, p.gender AS patient_gender,
                   s.name AS service_name, s.duration_minutes AS service_duration
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN services s ON a.service_id = s.id
            WHERE {$whereSql}
            ORDER BY a.start_at ASC, a.id ASC
            LIMIT :limit OFFSET :offset
        ");
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        return [
            'items' => $stmt->fetchAll(PDO::FETCH_ASSOC),
            'total' => $filteredTotal,
            'total_records' => $totalRecords,
            'filtered_records' => $filteredTotal,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => $totalPages,
        ];
    }

    /**
     * List appointments for a dentist with optional filters (bounded for daily/schedule views).
     *
     * @return list<array<string, mixed>>
     */
    public function findByDentist(
        int $dentistId,
        ?string $from = null,
        ?string $to = null,
        ?string $status = null,
        ?string $search = null
    ): array {
        $pdo = $this->database->getConnection();
        $sql = '
            SELECT a.*,
                   p.first_name AS patient_first_name, p.last_name AS patient_last_name,
                   p.phone AS patient_phone, p.medical_alerts AS patient_medical_alerts,
                   p.date_of_birth AS patient_date_of_birth, p.gender AS patient_gender,
                   s.name AS service_name, s.duration_minutes AS service_duration
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN services s ON a.service_id = s.id
            WHERE a.dentist_id = ?
        ';
        $params = [$dentistId];

        if ($from !== null) {
            $sql .= ' AND a.start_at >= ?';
            $params[] = $from;
        }
        if ($to !== null) {
            $sql .= ' AND a.start_at <= ?';
            $params[] = $to;
        }
        if ($status !== null && $status !== 'ALL') {
            $sql .= ' AND a.status = ?';
            $params[] = $status;
        }
        if ($search !== null && trim($search) !== '') {
            $term = '%' . ServerTableQuery::escapeLike($search) . '%';
            $sql .= " AND (p.first_name LIKE ? ESCAPE '!' OR p.last_name LIKE ? ESCAPE '!' OR s.name LIKE ? ESCAPE '!')";
            $params[] = $term;
            $params[] = $term;
            $params[] = $term;
        }

        $sql .= ' ORDER BY a.start_at ASC, a.id ASC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
