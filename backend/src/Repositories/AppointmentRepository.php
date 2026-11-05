<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Appointment Repository
 * Handles appointment persistence, interval queries, status updates, and conflict detection.
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
                   s.name AS service_name, s.duration_minutes AS service_duration
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
        ?int $excludeId = null
    ): array {
        $pdo = $this->database->getConnection();
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

        $stmt = $pdo->prepare($sql);
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
        ?int $excludeAppointmentId = null
    ): array {
        return $this->findBlockingByDentistAndRange($dentistId, $startAt, $endAt, $excludeAppointmentId);
    }

    /**
     * Create a new appointment record.
     *
     * @param array<string, mixed> $data
     */
    public function create(array $data): int
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
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

        return (int) $pdo->lastInsertId();
    }

    /**
     * Update appointment status with associated audit tracking.
     */
    public function updateStatus(
        int $id,
        string $status,
        ?int $userId = null,
        ?string $reason = null
    ): bool {
        $pdo = $this->database->getConnection();
        $fields = ['status = :status', 'updated_at = NOW()'];
        $params = [':id' => $id, ':status' => $status];

        if ($status === 'CANCELLED') {
            $fields[] = 'cancellation_reason = :reason';
            $fields[] = 'cancelled_by_user_id = :user_id';
            $fields[] = 'cancelled_at = NOW()';
            $params[':reason'] = $reason;
            $params[':user_id'] = $userId;
        } elseif ($status === 'CONFIRMED' || $status === 'REJECTED') {
            $fields[] = 'reviewed_by_user_id = :user_id';
            $fields[] = 'reviewed_at = NOW()';
            $params[':user_id'] = $userId;
        } elseif ($status === 'COMPLETED') {
            $fields[] = 'completed_at = NOW()';
        }

        $sql = 'UPDATE appointments SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $stmt = $pdo->prepare($sql);

        return $stmt->execute($params);
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
