<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Attendance Repository
 * Manages front-desk patient arrivals, check-in timestamps, and clinic waiting list queues.
 */
class AttendanceRepository
{
    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * Find attendance record by appointment ID
     *
     * @return array<string, mixed>|null
     */
    public function findByAppointmentId(int $appointmentId): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT att.*,
                   u.email AS checked_in_by_email
            FROM appointment_attendances att
            LEFT JOIN users u ON u.id = att.checked_in_by_user_id
            WHERE att.appointment_id = ?
            LIMIT 1
        ');
        $stmt->execute([$appointmentId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Record patient check-in for an appointment
     *
     * @return array<string, mixed>
     */
    public function recordCheckIn(int $appointmentId, int $checkedInByUserId, ?string $notes = null): array
    {
        $pdo = $this->database->getConnection();
        $now = date('Y-m-d H:i:s');
        $existing = $this->findByAppointmentId($appointmentId);

        if ($existing !== null) {
            $stmt = $pdo->prepare('
                UPDATE appointment_attendances
                SET status = "CHECKED_IN",
                    checked_in_at = COALESCE(checked_in_at, ?),
                    checked_in_by_user_id = ?,
                    notes = COALESCE(?, notes),
                    updated_at = ?
                WHERE appointment_id = ?
            ');
            $stmt->execute([$now, $checkedInByUserId, $notes, $now, $appointmentId]);
        } else {
            $stmt = $pdo->prepare('
                INSERT INTO appointment_attendances (
                    appointment_id, status, checked_in_at, checked_in_by_user_id, notes, created_at, updated_at
                ) VALUES (?, "CHECKED_IN", ?, ?, ?, ?, ?)
            ');
            $stmt->execute([$appointmentId, $now, $checkedInByUserId, $notes, $now, $now]);
        }

        return $this->findByAppointmentId($appointmentId) ?? [];
    }

    /**
     * Update attendance status (e.g. WAITING, IN_CONSULTATION, FINISHED, NO_SHOW)
     *
     * @return array<string, mixed>
     */
    public function updateStatus(int $appointmentId, string $status, ?string $notes = null): array
    {
        $pdo = $this->database->getConnection();
        $now = date('Y-m-d H:i:s');
        $existing = $this->findByAppointmentId($appointmentId);

        if ($existing !== null) {
            $extraUpdates = '';
            $params = [$status, $notes];

            if ($status === 'IN_CONSULTATION') {
                $extraUpdates = ', consultation_started_at = COALESCE(consultation_started_at, ?)';
                $params[] = $now;
            } elseif ($status === 'FINISHED') {
                $extraUpdates = ', consultation_ended_at = ?';
                $params[] = $now;
            }

            $params[] = $now;
            $params[] = $appointmentId;

            $stmt = $pdo->prepare("
                UPDATE appointment_attendances
                SET status = ?,
                    notes = COALESCE(?, notes)
                    {$extraUpdates},
                    updated_at = ?
                WHERE appointment_id = ?
            ");
            $stmt->execute($params);
        } else {
            $consultationStarted = ($status === 'IN_CONSULTATION') ? $now : null;
            $consultationEnded = ($status === 'FINISHED') ? $now : null;

            $stmt = $pdo->prepare('
                INSERT INTO appointment_attendances (
                    appointment_id, status, notes, consultation_started_at, consultation_ended_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ');
            $stmt->execute([$appointmentId, $status, $notes, $consultationStarted, $consultationEnded, $now, $now]);
        }

        return $this->findByAppointmentId($appointmentId) ?? [];
    }

    /**
     * Retrieve active waiting list for clinic date
     * Returns checked-in or waiting patients who haven't finished consultation.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getWaitingQueue(string $clinicDate): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT a.id AS appointment_id,
                   a.start_at,
                   a.end_at,
                   a.duration_snapshot,
                   a.operatory_chair,
                   a.status AS appointment_status,
                   p.id AS patient_id,
                   p.first_name AS patient_first_name,
                   p.last_name AS patient_last_name,
                   p.phone AS patient_phone,
                   p.medical_alerts AS patient_medical_alerts,
                   d.id AS dentist_id,
                   d.first_name AS dentist_first_name,
                   d.last_name AS dentist_last_name,
                   d.specialization AS dentist_specialization,
                   s.name AS service_name,
                   att.status AS attendance_status,
                   att.checked_in_at,
                   att.consultation_started_at,
                   att.notes AS attendance_notes
            FROM appointments a
            JOIN patients p ON p.id = a.patient_id
            JOIN dentists d ON d.id = a.dentist_id
            JOIN services s ON s.id = a.service_id
            JOIN appointment_attendances att ON att.appointment_id = a.id
            WHERE DATE(a.start_at) = ?
              AND a.status = "CONFIRMED"
              AND att.status IN ("CHECKED_IN", "WAITING", "IN_CONSULTATION")
            ORDER BY 
                CASE att.status 
                    WHEN "IN_CONSULTATION" THEN 1
                    WHEN "WAITING" THEN 2
                    WHEN "CHECKED_IN" THEN 3
                    ELSE 4
                END ASC,
                att.checked_in_at ASC
        ');
        $stmt->execute([$clinicDate]);

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) {
            if (!empty($row['checked_in_at'])) {
                $row['waiting_minutes'] = max(0, (int) floor((time() - strtotime((string) $row['checked_in_at'])) / 60));
            } else {
                $row['waiting_minutes'] = null;
            }
        }
        unset($row);

        return $rows;
    }

    /**
     * Get attendance counts for today
     *
     * @return array{checked_in: int, waiting: int, in_consultation: int, finished: int, no_show: int}
     */
    public function getTodayCounts(string $clinicDate): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT att.status, COUNT(*) as total
            FROM appointments a
            JOIN appointment_attendances att ON att.appointment_id = a.id
            WHERE DATE(a.start_at) = ?
            GROUP BY att.status
        ');
        $stmt->execute([$clinicDate]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $counts = [
            'checked_in' => 0,
            'waiting' => 0,
            'in_consultation' => 0,
            'finished' => 0,
            'no_show' => 0,
        ];

        foreach ($rows as $r) {
            $key = strtolower($r['status']);
            if (isset($counts[$key])) {
                $counts[$key] = (int) $r['total'];
            }
        }

        return $counts;
    }
}
