<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Dentist Time Off Repository
 * Manages approved leaves, vacations, and emergency blocked schedules for dentists.
 */
class DentistTimeOffRepository
{
    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * Retrieve time-off records for a dentist, optionally filtered by date range.
     *
     * @return list<array<string, mixed>>
     */
    public function findByDentistId(int $dentistId, ?string $from = null, ?string $to = null): array
    {
        $pdo = $this->database->getConnection();
        $sql = '
            SELECT t.id, t.dentist_id, t.start_at, t.end_at, t.reason, t.approved_by_user_id,
                   t.created_at, t.updated_at,
                   u.email AS approver_name
            FROM dentist_time_off t
            LEFT JOIN users u ON t.approved_by_user_id = u.id
            WHERE t.dentist_id = ?
        ';
        $params = [$dentistId];

        if ($from !== null) {
            $sql .= ' AND t.end_at >= ?';
            $params[] = $from;
        }

        if ($to !== null) {
            $sql .= ' AND t.start_at <= ?';
            $params[] = $to;
        }

        $sql .= ' ORDER BY t.start_at ASC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Find a single time-off record by its ID.
     *
     * @return array<string, mixed>|null
     */
    public function findById(int $id): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT t.*, u.email AS approver_name
            FROM dentist_time_off t
            LEFT JOIN users u ON t.approved_by_user_id = u.id
            WHERE t.id = ?
            LIMIT 1
        ');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Check if a requested time-off period overlaps with an existing time-off record.
     * Uses half-open interval comparison [start, end): candidate_start < existing_end AND candidate_end > existing_start.
     *
     * @return list<array<string, mixed>>
     */
    public function findOverlapping(int $dentistId, string $startAt, string $endAt, ?int $excludeId = null): array
    {
        $pdo = $this->database->getConnection();
        $sql = '
            SELECT id, dentist_id, start_at, end_at, reason
            FROM dentist_time_off
            WHERE dentist_id = :dentist_id
              AND start_at < :end_at
              AND end_at > :start_at
        ';
        $params = [
            ':dentist_id' => $dentistId,
            ':start_at' => $startAt,
            ':end_at' => $endAt,
        ];

        if ($excludeId !== null) {
            $sql .= ' AND id != :exclude_id';
            $params[':exclude_id'] = $excludeId;
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Create a new time-off record.
     *
     * @param array<string, mixed> $data
     */
    public function create(array $data): int
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            INSERT INTO dentist_time_off (dentist_id, start_at, end_at, reason, approved_by_user_id, created_at, updated_at)
            VALUES (:dentist_id, :start_at, :end_at, :reason, :approved_by_user_id, NOW(), NOW())
        ');

        $stmt->execute([
            ':dentist_id' => $data['dentist_id'],
            ':start_at' => $data['start_at'],
            ':end_at' => $data['end_at'],
            ':reason' => $data['reason'],
            ':approved_by_user_id' => $data['approved_by_user_id'] ?? null,
        ]);

        return (int) $pdo->lastInsertId();
    }

    /**
     * Update an existing time-off record.
     *
     * @param array<string, mixed> $data
     */
    public function update(int $id, array $data): bool
    {
        $pdo = $this->database->getConnection();
        $fields = [];
        $params = [':id' => $id];

        if (array_key_exists('start_at', $data)) {
            $fields[] = 'start_at = :start_at';
            $params[':start_at'] = $data['start_at'];
        }
        if (array_key_exists('end_at', $data)) {
            $fields[] = 'end_at = :end_at';
            $params[':end_at'] = $data['end_at'];
        }
        if (array_key_exists('reason', $data)) {
            $fields[] = 'reason = :reason';
            $params[':reason'] = $data['reason'];
        }
        if (array_key_exists('approved_by_user_id', $data)) {
            $fields[] = 'approved_by_user_id = :approved_by_user_id';
            $params[':approved_by_user_id'] = $data['approved_by_user_id'];
        }

        if (empty($fields)) {
            return false;
        }

        $fields[] = 'updated_at = NOW()';
        $sql = 'UPDATE dentist_time_off SET ' . implode(', ', $fields) . ' WHERE id = :id';

        $stmt = $pdo->prepare($sql);
        return $stmt->execute($params);
    }

    /**
     * Delete a time-off record.
     */
    public function delete(int $id): bool
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('DELETE FROM dentist_time_off WHERE id = ?');
        return $stmt->execute([$id]);
    }
}
