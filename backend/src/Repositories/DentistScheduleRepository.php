<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Dentist Weekly Schedule Repository
 * Manages recurring weekly practitioner working shifts, operatory chair allocations,
 * and interval validation.
 */
class DentistScheduleRepository
{
    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function findByDentistId(int $dentistId, bool $activeOnly = false): array
    {
        $pdo = $this->database->getConnection();
        $sql = '
            SELECT id, dentist_id, day_of_week, start_time, end_time, operatory_chair, is_active, created_at, updated_at
            FROM dentist_schedules
            WHERE dentist_id = ?
        ';
        if ($activeOnly) {
            $sql .= ' AND is_active = 1';
        }
        $sql .= ' ORDER BY day_of_week ASC, start_time ASC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$dentistId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findById(int $id): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('SELECT * FROM dentist_schedules WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function findByDentistAndDay(int $dentistId, int $dayOfWeek, bool $activeOnly = true): array
    {
        $pdo = $this->database->getConnection();
        $sql = '
            SELECT id, dentist_id, day_of_week, start_time, end_time, operatory_chair, is_active
            FROM dentist_schedules
            WHERE dentist_id = ? AND day_of_week = ?
        ';
        if ($activeOnly) {
            $sql .= ' AND is_active = 1';
        }
        $sql .= ' ORDER BY start_time ASC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$dentistId, $dayOfWeek]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @param array<string, mixed> $data
     */
    public function create(array $data): int
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            INSERT INTO dentist_schedules (dentist_id, day_of_week, start_time, end_time, operatory_chair, is_active, created_at, updated_at)
            VALUES (:dentist_id, :day_of_week, :start_time, :end_time, :operatory_chair, :is_active, NOW(), NOW())
        ');

        $stmt->execute([
            ':dentist_id' => $data['dentist_id'],
            ':day_of_week' => $data['day_of_week'],
            ':start_time' => $data['start_time'],
            ':end_time' => $data['end_time'],
            ':operatory_chair' => $data['operatory_chair'] ?? 'Chair 1',
            ':is_active' => $data['is_active'] ?? 1,
        ]);

        return (int) $pdo->lastInsertId();
    }

    /**
     * @param array<string, mixed> $data
     */
    public function update(int $id, array $data): bool
    {
        $pdo = $this->database->getConnection();
        $fields = [];
        $params = [':id' => $id];

        $allowedColumns = ['day_of_week', 'start_time', 'end_time', 'operatory_chair', 'is_active'];
        foreach ($allowedColumns as $col) {
            if (array_key_exists($col, $data)) {
                $fields[] = "{$col} = :{$col}";
                $params[":{$col}"] = $data[$col];
            }
        }

        if (empty($fields)) {
            return false;
        }

        $fields[] = 'updated_at = NOW()';
        $sql = 'UPDATE dentist_schedules SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $stmt = $pdo->prepare($sql);

        return $stmt->execute($params);
    }

    public function delete(int $id): bool
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('DELETE FROM dentist_schedules WHERE id = ?');
        return $stmt->execute([$id]);
    }

    /**
     * Check if a working shift overlaps with another active shift for the same dentist on the same day.
     * Overlap condition on half-open intervals [start, end): candidate_start < existing_end AND candidate_end > existing_start.
     */
    public function hasOverlap(
        int $dentistId,
        int $dayOfWeek,
        string $startTime,
        string $endTime,
        ?int $excludeId = null
    ): bool {
        $pdo = $this->database->getConnection();

        $sql = '
            SELECT COUNT(*)
            FROM dentist_schedules
            WHERE dentist_id = :dentist_id
              AND day_of_week = :day_of_week
              AND is_active = 1
              AND start_time < :end_time
              AND end_time > :start_time
        ';
        $params = [
            ':dentist_id' => $dentistId,
            ':day_of_week' => $dayOfWeek,
            ':start_time' => $startTime,
            ':end_time' => $endTime,
        ];

        if ($excludeId !== null) {
            $sql .= ' AND id != :exclude_id';
            $params[':exclude_id'] = $excludeId;
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return ((int) $stmt->fetchColumn()) > 0;
    }

    /**
     * Check if the proposed working shift falls completely within clinic operating hours for that day.
     */
    public function fitsClinicHours(int $dayOfWeek, string $startTime, string $endTime): bool
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT opening_time, closing_time, is_closed
            FROM clinic_operating_hours
            WHERE day_of_week = ?
            LIMIT 1
        ');
        $stmt->execute([$dayOfWeek]);
        $clinicDay = $stmt->fetch(PDO::FETCH_ASSOC);

        // If no record exists, default assume clinic is open 08:00 to 17:00
        if (!$clinicDay) {
            return $startTime >= '08:00:00' && $endTime <= '17:00:00';
        }

        if ((int) $clinicDay['is_closed'] === 1) {
            return false;
        }

        return $startTime >= $clinicDay['opening_time'] && $endTime <= $clinicDay['closing_time'];
    }
}

