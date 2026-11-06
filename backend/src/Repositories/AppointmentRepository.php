<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Appointment Repository
 * Handles appointment persistence, interval queries, status updates, locking, and conflict detection.
 */
class AppointmentRepository
{
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
                   p.first_name AS patient_first_name, p.last_name AS patient_last_name, p.phone AS patient_phone,
                   u_p.email AS patient_email,
                   d.license_number, d.specialization,
                   d.first_name AS dentist_first_name, d.last_name AS dentist_last_name,
                   u_d.email AS dentist_email,
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
        int $perPage = 20
    ): array {
        $pdo = $this->database->getConnection();
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

        $whereClause = implode(' AND ', $where);

        // Count total
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM appointments a WHERE {$whereClause}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $offset = max(0, ($page - 1) * $perPage);
        $totalPages = $perPage > 0 ? (int) ceil($total / $perPage) : 1;

        $sql = "
            SELECT a.*,
                   d.first_name AS dentist_first_name, d.last_name AS dentist_last_name, d.specialization,
                   s.name AS service_name, s.duration_minutes AS service_duration
            FROM appointments a
            JOIN dentists d ON a.dentist_id = d.id
            JOIN services s ON a.service_id = s.id
            WHERE {$whereClause}
            ORDER BY a.start_at DESC
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
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => $totalPages,
        ];
    }

    /**
     * List all appointments with comprehensive administrative filtering and pagination.
     *
     * @param array<string, mixed> $filters
     * @return array{items: list<array<string, mixed>>, total: int, page: int, per_page: int, total_pages: int}
     */
    public function findAllFiltered(array $filters = [], int $page = 1, int $perPage = 20): array
    {
        $pdo = $this->database->getConnection();
        $where = ['1=1'];
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
        if (!empty($filters['search'])) {
            $searchTerm = '%' . trim((string) $filters['search']) . '%';
            $where[] = '(p.first_name LIKE :search1 OR p.last_name LIKE :search2 OR u_p.email LIKE :search3 OR p.phone LIKE :search4)';
            $params[':search1'] = $searchTerm;
            $params[':search2'] = $searchTerm;
            $params[':search3'] = $searchTerm;
            $params[':search4'] = $searchTerm;
        }

        $whereClause = implode(' AND ', $where);

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
        $total = (int) $countStmt->fetchColumn();

        $offset = max(0, ($page - 1) * $perPage);
        $totalPages = $perPage > 0 ? (int) ceil($total / $perPage) : 1;

        $sql = "
            SELECT a.*,
                   p.first_name AS patient_first_name, p.last_name AS patient_last_name, p.phone AS patient_phone,
                   u_p.email AS patient_email,
                   d.first_name AS dentist_first_name, d.last_name AS dentist_last_name, d.specialization,
                   s.name AS service_name, s.duration_minutes AS service_duration
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN users u_p ON p.user_id = u_p.id
            JOIN dentists d ON a.dentist_id = d.id
            JOIN services s ON a.service_id = s.id
            WHERE {$whereClause}
            ORDER BY a.start_at DESC
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
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => $totalPages,
        ];
    }

    /**
     * List appointments for a dentist with optional filters.
     *
     * @return list<array<string, mixed>>
     */
    public function findByDentist(
        int $dentistId,
        ?string $from = null,
        ?string $to = null,
        ?string $status = null
    ): array {
        $pdo = $this->database->getConnection();
        $sql = '
            SELECT a.*,
                   p.first_name AS patient_first_name, p.last_name AS patient_last_name,
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
        if ($status !== null) {
            $sql .= ' AND a.status = ?';
            $params[] = $status;
        }

        $sql .= ' ORDER BY a.start_at ASC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
