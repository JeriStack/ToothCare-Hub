<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use DateTimeImmutable;
use DateTimeZone;
use PDO;

/**
 * Treatment Record Repository
 * Clinical record persistence, dentist-authored treatment documentation, and 24h locked status.
 */
class TreatmentRecordRepository
{
    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * Retrieve treatment record by primary ID with clinical context.
     *
     * @return array<string, mixed>|null
     */
    public function findById(int $id): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT tr.*,
                   a.start_at AS appointment_start,
                   a.end_at AS appointment_end,
                   a.status AS appointment_status,
                   s.name AS service_name,
                   p.first_name AS patient_first_name,
                   p.last_name AS patient_last_name,
                   p.date_of_birth AS patient_date_of_birth,
                   p.gender AS patient_gender,
                   p.phone AS patient_phone,
                   p.medical_alerts AS patient_medical_alerts,
                   d.first_name AS dentist_first_name,
                   d.last_name AS dentist_last_name,
                   d.specialization AS dentist_specialization,
                   d.license_number AS dentist_license_number
            FROM treatment_records tr
            JOIN appointments a ON tr.appointment_id = a.id
            JOIN services s ON a.service_id = s.id
            JOIN patients p ON tr.patient_id = p.id
            JOIN dentists d ON tr.dentist_id = d.id
            WHERE tr.id = ?
            LIMIT 1
        ');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }

        return $this->hydrateRecord($row);
    }

    /**
     * Retrieve treatment record by appointment ID.
     *
     * @return array<string, mixed>|null
     */
    public function findByAppointmentId(int $appointmentId): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT tr.*,
                   a.start_at AS appointment_start,
                   a.end_at AS appointment_end,
                   a.status AS appointment_status,
                   s.name AS service_name,
                   p.first_name AS patient_first_name,
                   p.last_name AS patient_last_name,
                   p.medical_alerts AS patient_medical_alerts,
                   d.first_name AS dentist_first_name,
                   d.last_name AS dentist_last_name,
                   d.license_number AS dentist_license_number
            FROM treatment_records tr
            JOIN appointments a ON tr.appointment_id = a.id
            JOIN services s ON a.service_id = s.id
            JOIN patients p ON tr.patient_id = p.id
            JOIN dentists d ON tr.dentist_id = d.id
            WHERE tr.appointment_id = ?
            LIMIT 1
        ');
        $stmt->execute([$appointmentId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }

        return $this->hydrateRecord($row);
    }

    /**
     * Retrieve paginated treatment records authored by a specific dentist.
     *
     * @return array{items: list<array<string, mixed>>, total: int, page: int, per_page: int, total_pages: int}
     */
    public function findByDentistId(int $dentistId, int $page = 1, int $perPage = 20): array
    {
        $pdo = $this->database->getConnection();
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $offset = ($page - 1) * $perPage;

        $countStmt = $pdo->prepare('SELECT COUNT(*) FROM treatment_records WHERE dentist_id = ?');
        $countStmt->execute([$dentistId]);
        $total = (int) $countStmt->fetchColumn();

        $stmt = $pdo->prepare('
            SELECT tr.*,
                   a.start_at AS appointment_start,
                   s.name AS service_name,
                   p.first_name AS patient_first_name,
                   p.last_name AS patient_last_name
            FROM treatment_records tr
            JOIN appointments a ON tr.appointment_id = a.id
            JOIN services s ON a.service_id = s.id
            JOIN patients p ON tr.patient_id = p.id
            WHERE tr.dentist_id = ?
            ORDER BY tr.created_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->bindValue(1, $dentistId, PDO::PARAM_INT);
        $stmt->bindValue(2, $perPage, PDO::PARAM_INT);
        $stmt->bindValue(3, $offset, PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $items = array_map([$this, 'hydrateRecord'], $rows);

        $totalPages = $total > 0 ? (int) ceil($total / $perPage) : 1;

        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => $totalPages,
        ];
    }

    /**
     * Retrieve historical treatment records for a patient.
     *
     * @return list<array<string, mixed>>
     */
    public function findByPatientId(int $patientId): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT tr.*,
                   a.start_at AS appointment_start,
                   s.name AS service_name,
                   d.first_name AS dentist_first_name,
                   d.last_name AS dentist_last_name,
                   d.specialization AS dentist_specialization
            FROM treatment_records tr
            JOIN appointments a ON tr.appointment_id = a.id
            JOIN services s ON a.service_id = s.id
            JOIN dentists d ON tr.dentist_id = d.id
            WHERE tr.patient_id = ?
            ORDER BY tr.created_at DESC
        ');
        $stmt->execute([$patientId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map([$this, 'hydrateRecord'], $rows);
    }

    /**
     * Create treatment record. Automatically initializes 24-hour edit lock window.
     *
     * @param array<string, mixed> $data
     */
    public function create(array $data, ?PDO $pdo = null): int
    {
        $db = $pdo ?? $this->database->getConnection();

        $teethJson = null;
        if (!empty($data['teeth_treated'])) {
            $teethJson = is_array($data['teeth_treated'])
                ? json_encode(array_values($data['teeth_treated']))
                : (string) $data['teeth_treated'];
        }

        // Default 24-hour edit window lock time
        $lockedAt = $data['locked_at'] ?? (new DateTimeImmutable('+24 hours', new DateTimeZone('Asia/Manila')))->format('Y-m-d H:i:s');

        $stmt = $db->prepare('
            INSERT INTO treatment_records (
                appointment_id, dentist_id, patient_id, teeth_treated,
                diagnosis, procedure_notes, prescription_notes, home_care_advice,
                locked_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ');

        $stmt->execute([
            (int) $data['appointment_id'],
            (int) $data['dentist_id'],
            (int) $data['patient_id'],
            $teethJson,
            trim((string) $data['diagnosis']),
            trim((string) $data['procedure_notes']),
            isset($data['prescription_notes']) && $data['prescription_notes'] !== '' ? trim((string) $data['prescription_notes']) : null,
            isset($data['home_care_advice']) && $data['home_care_advice'] !== '' ? trim((string) $data['home_care_advice']) : null,
            $lockedAt,
        ]);

        return (int) $db->lastInsertId();
    }

    /**
     * Update clinical notes of a treatment record.
     *
     * @param array<string, mixed> $data
     */
    public function update(int $id, array $data, ?PDO $pdo = null): bool
    {
        $db = $pdo ?? $this->database->getConnection();
        $fields = [];
        $params = [];

        if (array_key_exists('diagnosis', $data)) {
            $fields[] = 'diagnosis = ?';
            $params[] = trim((string) $data['diagnosis']);
        }
        if (array_key_exists('procedure_notes', $data)) {
            $fields[] = 'procedure_notes = ?';
            $params[] = trim((string) $data['procedure_notes']);
        }
        if (array_key_exists('prescription_notes', $data)) {
            $fields[] = 'prescription_notes = ?';
            $params[] = $data['prescription_notes'] !== null && $data['prescription_notes'] !== '' ? trim((string) $data['prescription_notes']) : null;
        }
        if (array_key_exists('home_care_advice', $data)) {
            $fields[] = 'home_care_advice = ?';
            $params[] = $data['home_care_advice'] !== null && $data['home_care_advice'] !== '' ? trim((string) $data['home_care_advice']) : null;
        }
        if (array_key_exists('teeth_treated', $data)) {
            $fields[] = 'teeth_treated = ?';
            $params[] = !empty($data['teeth_treated'])
                ? (is_array($data['teeth_treated']) ? json_encode(array_values($data['teeth_treated'])) : (string) $data['teeth_treated'])
                : null;
        }
        if (array_key_exists('locked_at', $data)) {
            $fields[] = 'locked_at = ?';
            $params[] = $data['locked_at'];
        }

        if (empty($fields)) {
            return false;
        }

        $fields[] = 'updated_at = NOW()';
        $params[] = $id;

        $sql = 'UPDATE treatment_records SET ' . implode(', ', $fields) . ' WHERE id = ?';
        $stmt = $db->prepare($sql);

        return $stmt->execute($params);
    }

    /**
     * Hydrate raw database row with decoded JSON teeth and lock status.
     *
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function hydrateRecord(array $row): array
    {
        $row['id'] = (int) $row['id'];
        $row['appointment_id'] = (int) $row['appointment_id'];
        $row['dentist_id'] = (int) $row['dentist_id'];
        $row['patient_id'] = (int) $row['patient_id'];

        if (!empty($row['teeth_treated']) && is_string($row['teeth_treated'])) {
            $decoded = json_decode($row['teeth_treated'], true);
            $row['teeth_treated'] = is_array($decoded) ? $decoded : [];
        } else {
            $row['teeth_treated'] = is_array($row['teeth_treated'] ?? null) ? $row['teeth_treated'] : [];
        }

        $now = new DateTimeImmutable('now', new DateTimeZone('Asia/Manila'));
        $isLocked = false;
        if (!empty($row['locked_at'])) {
            try {
                $lockedDt = new DateTimeImmutable($row['locked_at'], new DateTimeZone('Asia/Manila'));
                $isLocked = $now > $lockedDt;
            } catch (\Throwable) {
                $isLocked = false;
            }
        }

        $row['is_locked'] = $isLocked;

        return $row;
    }
}
