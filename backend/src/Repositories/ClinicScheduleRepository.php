<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Clinic Operating Hours & Closures Repository
 * Manages weekly facility hours, shift intervals, and clinic-wide holiday/maintenance closures.
 */
class ClinicScheduleRepository
{
    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function getOperatingHours(): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->query('
            SELECT id, day_of_week, opening_time, closing_time, is_closed, created_at, updated_at
            FROM clinic_operating_hours
            ORDER BY day_of_week ASC
        ');
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getOperatingHoursForDay(int $dayOfWeek): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT id, day_of_week, opening_time, closing_time, is_closed
            FROM clinic_operating_hours
            WHERE day_of_week = ?
            LIMIT 1
        ');
        $stmt->execute([$dayOfWeek]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    public function setOperatingHours(int $dayOfWeek, string $openingTime, string $closingTime, int $isClosed): bool
    {
        $pdo = $this->database->getConnection();

        $existing = $this->getOperatingHoursForDay($dayOfWeek);
        if ($existing) {
            $stmt = $pdo->prepare('
                UPDATE clinic_operating_hours
                SET opening_time = ?, closing_time = ?, is_closed = ?, updated_at = NOW()
                WHERE day_of_week = ?
            ');
            return $stmt->execute([$openingTime, $closingTime, $isClosed, $dayOfWeek]);
        }

        $stmt = $pdo->prepare('
            INSERT INTO clinic_operating_hours (day_of_week, opening_time, closing_time, is_closed, created_at, updated_at)
            VALUES (?, ?, ?, ?, NOW(), NOW())
        ');
        return $stmt->execute([$dayOfWeek, $openingTime, $closingTime, $isClosed]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function getClosures(?string $startDate = null, ?string $endDate = null): array
    {
        $pdo = $this->database->getConnection();

        $where = [];
        $params = [];

        if ($startDate !== null) {
            $where[] = 'end_at >= ?';
            $params[] = $startDate . ' 00:00:00';
        }

        if ($endDate !== null) {
            $where[] = 'start_at <= ?';
            $params[] = $endDate . ' 23:59:59';
        }

        $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        $stmt = $pdo->prepare("
            SELECT id, title, start_at, end_at, closure_type, notes, created_by_user_id, created_at
            FROM clinic_closures
            {$whereClause}
            ORDER BY start_at ASC
        ");
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @param array<string, mixed> $data
     */
    public function createClosure(array $data): int
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            INSERT INTO clinic_closures (title, start_at, end_at, closure_type, notes, created_by_user_id, created_at, updated_at)
            VALUES (:title, :start_at, :end_at, :closure_type, :notes, :created_by_user_id, NOW(), NOW())
        ');

        $stmt->execute([
            ':title' => $data['title'],
            ':start_at' => $data['start_at'],
            ':end_at' => $data['end_at'],
            ':closure_type' => $data['closure_type'] ?? 'HOLIDAY',
            ':notes' => $data['notes'] ?? null,
            ':created_by_user_id' => $data['created_by_user_id'] ?? null,
        ]);

        return (int) $pdo->lastInsertId();
    }

    public function deleteClosure(int $id): bool
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('DELETE FROM clinic_closures WHERE id = ?');
        return $stmt->execute([$id]);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findClosureById(int $id): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('SELECT * FROM clinic_closures WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }
}

