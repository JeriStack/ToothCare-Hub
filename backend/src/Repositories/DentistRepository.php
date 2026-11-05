<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Dentist Profile Repository
 * Manages clinical provider records, license validations, and administrative listing.
 */
class DentistRepository
{
    private Database $database;

    private const SORT_ALLOWLIST = [
        'id' => 'd.id',
        'name' => 'd.last_name',
        'specialization' => 'd.specialization',
        'license_number' => 'd.license_number',
        'is_active' => 'd.is_active',
        'created_at' => 'd.created_at',
    ];

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findById(int $id): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT 
                d.id, d.user_id, d.first_name, d.last_name, d.specialization,
                d.license_number, d.phone, d.default_operatory_chair, d.bio,
                d.is_active, d.created_at, d.updated_at,
                u.email, u.role, u.email_verified, u.is_active AS user_active
            FROM dentists d
            INNER JOIN users u ON d.user_id = u.id
            WHERE d.id = ?
            LIMIT 1
        ');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findByUserId(int $userId): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT 
                d.id, d.user_id, d.first_name, d.last_name, d.specialization,
                d.license_number, d.phone, d.default_operatory_chair, d.bio,
                d.is_active, d.created_at, d.updated_at,
                u.email, u.role, u.email_verified, u.is_active AS user_active
            FROM dentists d
            INNER JOIN users u ON d.user_id = u.id
            WHERE d.user_id = ?
            LIMIT 1
        ');
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findByLicenseNumber(string $license): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('SELECT * FROM dentists WHERE LOWER(license_number) = LOWER(?) LIMIT 1');
        $stmt->execute([trim($license)]);
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
            INSERT INTO dentists (
                user_id, first_name, last_name, specialization, license_number,
                phone, default_operatory_chair, bio, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ');

        $stmt->execute([
            (int) $data['user_id'],
            trim((string) $data['first_name']),
            trim((string) $data['last_name']),
            trim((string) $data['specialization']),
            trim((string) $data['license_number']),
            trim((string) $data['phone']),
            trim((string) ($data['default_operatory_chair'] ?? 'Chair 1')),
            $data['bio'] ?? null,
            (int) ($data['is_active'] ?? 1),
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
        $params = [];

        $allowedColumns = [
            'first_name', 'last_name', 'specialization', 'license_number',
            'phone', 'default_operatory_chair', 'bio', 'is_active'
        ];

        foreach ($allowedColumns as $col) {
            if (array_key_exists($col, $data)) {
                $fields[] = "{$col} = ?";
                $params[] = $data[$col];
            }
        }

        if (empty($fields)) {
            return false;
        }

        $fields[] = 'updated_at = NOW()';
        $params[] = $id;

        $setClause = implode(', ', $fields);
        $stmt = $pdo->prepare("UPDATE dentists SET {$setClause} WHERE id = ?");

        return $stmt->execute($params);
    }

    /**
     * Update active status for dentist and synchronized user account
     */
    public function updateStatus(int $id, int $isActive): bool
    {
        $pdo = $this->database->getConnection();
        $dentist = $this->findById($id);
        if ($dentist === null) {
            return false;
        }

        $stmtD = $pdo->prepare('UPDATE dentists SET is_active = ?, updated_at = NOW() WHERE id = ?');
        $stmtD->execute([$isActive, $id]);

        $stmtU = $pdo->prepare('UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?');
        $stmtU->execute([$isActive, $dentist['user_id']]);

        return true;
    }

    public function countAppointmentsReferencing(int $dentistId): int
    {
        try {
            $pdo = $this->database->getConnection();
            $stmt = $pdo->prepare('SELECT COUNT(*) FROM appointments WHERE dentist_id = ?');
            $stmt->execute([$dentistId]);
            return (int) $stmt->fetchColumn();
        } catch (\Throwable $e) {
            return 0;
        }
    }

    /**
     * List dentists with search, filtering, allowlisted sorting, and pagination
     *
     * @param array<string, mixed> $filters
     * @return array{items: list<array<string, mixed>>, pagination: array<string, int>}
     */
    public function list(
        array $filters = [],
        string $sortBy = 'name',
        string $sortDir = 'ASC',
        int $page = 1,
        int $perPage = 10
    ): array {
        $pdo = $this->database->getConnection();

        $page = max(1, $page);
        $perPage = min(100, max(1, $perPage));
        $offset = ($page - 1) * $perPage;

        $sortColumn = self::SORT_ALLOWLIST[$sortBy] ?? 'd.last_name';
        $direction = strtoupper($sortDir) === 'DESC' ? 'DESC' : 'ASC';

        $where = [];
        $params = [];

        // Search: name, license, specialization, or email
        if (!empty($filters['search'])) {
            $searchTerm = '%' . str_replace(['%', '_'], ['\\%', '\\_'], trim((string) $filters['search'])) . '%';
            $where[] = '(d.first_name LIKE ? OR d.last_name LIKE ? OR d.license_number LIKE ? OR d.specialization LIKE ? OR u.email LIKE ?)';
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }

        // Active status filter
        if (isset($filters['is_active']) && $filters['is_active'] !== '') {
            $where[] = 'd.is_active = ?';
            $params[] = (int) $filters['is_active'];
        }

        // Specialization filter
        if (!empty($filters['specialization'])) {
            $where[] = 'd.specialization = ?';
            $params[] = trim((string) $filters['specialization']);
        }

        $whereSql = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        // Total count
        $countSql = "
            SELECT COUNT(*) 
            FROM dentists d
            INNER JOIN users u ON d.user_id = u.id
            {$whereSql}
        ";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $totalItems = (int) $countStmt->fetchColumn();

        // Paginated items
        $sql = "
            SELECT 
                d.id, d.user_id, d.first_name, d.last_name, d.specialization,
                d.license_number, d.phone, d.default_operatory_chair, d.bio,
                d.is_active, d.created_at, d.updated_at,
                u.email, u.email_verified, u.is_active AS user_active
            FROM dentists d
            INNER JOIN users u ON d.user_id = u.id
            {$whereSql}
            ORDER BY {$sortColumn} {$direction}
            LIMIT {$perPage} OFFSET {$offset}
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totalPages = $totalItems > 0 ? (int) ceil($totalItems / $perPage) : 1;

        return [
            'items' => $items,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total_items' => $totalItems,
                'total_pages' => $totalPages,
            ],
        ];
    }

    /**
     * Active dentists for booking selection
     *
     * @return list<array<string, mixed>>
     */
    public function listActive(): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->query('
            SELECT 
                d.id, d.user_id, d.first_name, d.last_name, d.specialization,
                d.license_number, d.phone, d.default_operatory_chair, d.bio,
                d.is_active, d.created_at, d.updated_at,
                u.email
            FROM dentists d
            INNER JOIN users u ON d.user_id = u.id
            WHERE d.is_active = 1
            ORDER BY d.last_name ASC, d.first_name ASC
        ');

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
