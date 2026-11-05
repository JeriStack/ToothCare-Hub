<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Patient Profile Repository
 * Manages patient demographic and medical records linked to user identity.
 */
class PatientRepository
{
    private Database $database;

    private const ALLOWED_SORT_COLUMNS = [
        'id' => 'p.id',
        'first_name' => 'p.first_name',
        'last_name' => 'p.last_name',
        'name' => 'p.last_name',
        'date_of_birth' => 'p.date_of_birth',
        'phone' => 'p.phone',
        'gender' => 'p.gender',
        'created_at' => 'p.created_at',
        'email' => 'u.email',
        'is_active' => 'u.is_active',
    ];

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findByUserId(int $userId): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('SELECT * FROM patients WHERE user_id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findById(int $id): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('SELECT * FROM patients WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Retrieve patient profile joined with account identity details.
     *
     * @return array<string, mixed>|null
     */
    public function findWithUserById(int $id): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT 
                p.*,
                u.email,
                u.role,
                u.is_active,
                u.email_verified,
                u.created_at AS user_created_at
            FROM patients p
            INNER JOIN users u ON p.user_id = u.id
            WHERE p.id = ?
            LIMIT 1
        ');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * @param array<string, mixed> $data
     */
    public function create(array $data): int
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            INSERT INTO patients (
                user_id, first_name, last_name, date_of_birth, phone,
                gender, address, emergency_contact_name, emergency_contact_phone,
                medical_alerts, created_at, updated_at
            ) VALUES (
                :user_id, :first_name, :last_name, :date_of_birth, :phone,
                :gender, :address, :emergency_contact_name, :emergency_contact_phone,
                :medical_alerts, NOW(), NOW()
            )
        ');

        $stmt->execute([
            ':user_id' => $data['user_id'],
            ':first_name' => $data['first_name'],
            ':last_name' => $data['last_name'],
            ':date_of_birth' => $data['date_of_birth'],
            ':phone' => $data['phone'],
            ':gender' => $data['gender'] ?? 'PREFER_NOT_TO_SAY',
            ':address' => $data['address'] ?? null,
            ':emergency_contact_name' => $data['emergency_contact_name'] ?? null,
            ':emergency_contact_phone' => $data['emergency_contact_phone'] ?? null,
            ':medical_alerts' => $data['medical_alerts'] ?? null,
        ]);

        return (int) $pdo->lastInsertId();
    }

    /**
     * @param array<string, mixed> $data
     */
    public function update(int $patientId, array $data): bool
    {
        $pdo = $this->database->getConnection();
        $fields = [];
        $params = [':id' => $patientId];

        $allowedColumns = [
            'first_name', 'last_name', 'date_of_birth', 'phone',
            'gender', 'address', 'emergency_contact_name', 'emergency_contact_phone',
            'medical_alerts'
        ];

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
        $setClause = implode(', ', $fields);

        $stmt = $pdo->prepare("UPDATE patients SET {$setClause} WHERE id = :id");
        return $stmt->execute($params);
    }

    /**
     * List patients with server-side pagination, search wildcards, and status filters.
     *
     * @param array<string, mixed> $filters
     * @return array{data: list<array<string, mixed>>, meta: array<string, int>}
     */
    public function list(
        array $filters = [],
        string $sortBy = 'created_at',
        string $sortDir = 'DESC',
        int $page = 1,
        int $perPage = 15
    ): array {
        $pdo = $this->database->getConnection();

        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $offset = ($page - 1) * $perPage;

        $conditions = [];
        $params = [];

        // 1. Search across name, phone, email
        if (!empty($filters['search'])) {
            $search = '%' . trim((string) $filters['search']) . '%';
            $conditions[] = '(p.first_name LIKE :s1 OR p.last_name LIKE :s2 OR p.phone LIKE :s3 OR u.email LIKE :s4)';
            $params[':s1'] = $search;
            $params[':s2'] = $search;
            $params[':s3'] = $search;
            $params[':s4'] = $search;
        }

        // 2. Active status (account level)
        if (isset($filters['is_active']) && $filters['is_active'] !== '') {
            $conditions[] = 'u.is_active = :is_active';
            $params[':is_active'] = (int) $filters['is_active'];
        }

        // 3. Gender filter
        if (!empty($filters['gender'])) {
            $conditions[] = 'p.gender = :gender';
            $params[':gender'] = strtoupper(trim((string) $filters['gender']));
        }

        $whereClause = !empty($conditions) ? 'WHERE ' . implode(' AND ', $conditions) : '';

        // Total count
        $countSql = "SELECT COUNT(*) FROM patients p INNER JOIN users u ON p.user_id = u.id {$whereClause}";
        $countStmt = $pdo->prepare($countSql);
        foreach ($params as $key => $val) {
            $countStmt->bindValue($key, $val);
        }
        $countStmt->execute();
        $total = (int) $countStmt->fetchColumn();

        // Sort validation
        $sortColumn = self::ALLOWED_SORT_COLUMNS[$sortBy] ?? 'p.created_at';
        $direction = strtoupper($sortDir) === 'ASC' ? 'ASC' : 'DESC';

        $dataSql = "
            SELECT 
                p.id,
                p.user_id,
                p.first_name,
                p.last_name,
                p.date_of_birth,
                p.phone,
                p.gender,
                p.address,
                p.emergency_contact_name,
                p.emergency_contact_phone,
                p.medical_alerts,
                p.created_at,
                p.updated_at,
                u.email,
                u.role,
                u.is_active,
                u.email_verified
            FROM patients p
            INNER JOIN users u ON p.user_id = u.id
            {$whereClause}
            ORDER BY {$sortColumn} {$direction}
            LIMIT :limit OFFSET :offset
        ";

        $dataStmt = $pdo->prepare($dataSql);
        foreach ($params as $key => $val) {
            $dataStmt->bindValue($key, $val);
        }
        $dataStmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $dataStmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $dataStmt->execute();

        $rows = $dataStmt->fetchAll(PDO::FETCH_ASSOC);

        $lastPage = $total > 0 ? (int) ceil($total / $perPage) : 1;

        return [
            'data' => $rows,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'last_page' => $lastPage,
            ],
        ];
    }

    public function countAppointmentsReferencing(int $patientId): int
    {
        try {
            $pdo = $this->database->getConnection();
            $stmt = $pdo->prepare('SELECT COUNT(*) FROM appointments WHERE patient_id = ?');
            $stmt->execute([$patientId]);
            return (int) $stmt->fetchColumn();
        } catch (\Throwable $e) {
            return 0;
        }
    }

    public function countTotal(): int
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->query('SELECT COUNT(*) FROM patients');
        return (int) $stmt->fetchColumn();
    }
}
