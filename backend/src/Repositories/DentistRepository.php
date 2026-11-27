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
                d.avatar_path, d.avatar_mime, d.avatar_updated_at,
                d.is_active, d.created_at, d.updated_at,
                u.email, u.role, u.email_verified, u.is_active AS user_active
            FROM dentists d
            INNER JOIN users u ON d.user_id = u.id
            WHERE d.id = ?
            LIMIT 1
        ');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? $this->hydrateAvatarFields($row) : null;
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
                d.avatar_path, d.avatar_mime, d.avatar_updated_at,
                d.is_active, d.created_at, d.updated_at,
                u.email, u.role, u.email_verified, u.is_active AS user_active
            FROM dentists d
            INNER JOIN users u ON d.user_id = u.id
            WHERE d.user_id = ?
            LIMIT 1
        ');
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? $this->hydrateAvatarFields($row) : null;
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

        $fields[] = 'updated_at = CURRENT_TIMESTAMP';
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

    public function updateAvatar(int $dentistId, string $filename, string $mime): bool
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE dentists
            SET avatar_path = ?,
                avatar_mime = ?,
                avatar_updated_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ');

        return $stmt->execute([$filename, $mime, $dentistId]);
    }

    public function clearAvatar(int $dentistId): bool
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE dentists
            SET avatar_path = NULL,
                avatar_mime = NULL,
                avatar_updated_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ');

        return $stmt->execute([$dentistId]);
    }

    /**
     * Append computed avatar_url when an avatar file is registered on the dentist row.
     *
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function hydrateAvatarFields(array $row): array
    {
        $hasAvatar = !empty($row['avatar_path']) && isset($row['id']);
        $versionSource = (string) ($row['avatar_updated_at'] ?? $row['avatar_path'] ?? '');
        $row['avatar_url'] = $hasAvatar
            ? '/api/v1/dentists/' . (int) $row['id'] . '/avatar?v=' . rawurlencode($versionSource)
            : null;

        return $row;
    }

    /**
     * Strip internal server storage fields before serializing a dentist payload to API clients.
     *
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function stripInternalFields(array $row): array
    {
        unset($row['avatar_path'], $row['avatar_mime']);
        return $row;
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

        $resolvedSortKey = array_key_exists($sortBy, self::SORT_ALLOWLIST) ? $sortBy : 'name';
        $sortColumn = self::SORT_ALLOWLIST[$resolvedSortKey];
        $direction = strtoupper($sortDir) === 'DESC' ? 'DESC' : 'ASC';

        $where = [];
        $params = [];

        // Search: name, license, specialization, or email
        if (!empty($filters['search'])) {
            $searchTerm = '%' . \App\Support\ServerTableQuery::escapeLike((string) $filters['search']) . '%';
            $where[] = "(d.first_name LIKE ? ESCAPE '!' OR d.last_name LIKE ? ESCAPE '!' OR d.license_number LIKE ? ESCAPE '!' OR d.specialization LIKE ? ESCAPE '!' OR u.email LIKE ? ESCAPE '!')";
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

        $hasFilters = !empty($where);
        $whereSql = $hasFilters ? 'WHERE ' . implode(' AND ', $where) : '';

        // Filtered count
        $countSql = "
            SELECT COUNT(*) 
            FROM dentists d
            INNER JOIN users u ON d.user_id = u.id
            {$whereSql}
        ";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $filteredItems = (int) $countStmt->fetchColumn();

        $totalRecords = $hasFilters
            ? (int) $pdo->query('SELECT COUNT(*) FROM dentists d INNER JOIN users u ON d.user_id = u.id')->fetchColumn()
            : $filteredItems;

        // Paginated items
        $sql = "
            SELECT 
                d.id, d.user_id, d.first_name, d.last_name, d.specialization,
                d.license_number, d.phone, d.default_operatory_chair, d.bio,
                d.avatar_path, d.avatar_mime, d.avatar_updated_at,
                d.is_active, d.created_at, d.updated_at,
                u.email, u.email_verified, u.is_active AS user_active
            FROM dentists d
            INNER JOIN users u ON d.user_id = u.id
            {$whereSql}
            ORDER BY {$sortColumn} {$direction}, d.id {$direction}
            LIMIT ? OFFSET ?
        ";

        $stmt = $pdo->prepare($sql);
        $pos = 1;
        foreach ($params as $val) {
            $stmt->bindValue($pos++, $val);
        }
        $stmt->bindValue($pos++, $perPage, PDO::PARAM_INT);
        $stmt->bindValue($pos, $offset, PDO::PARAM_INT);
        $stmt->execute();
        $items = array_map(
            fn (array $row): array => $this->stripInternalFields($this->hydrateAvatarFields($row)),
            $stmt->fetchAll(PDO::FETCH_ASSOC)
        );

        $totalPages = $filteredItems > 0 ? (int) ceil($filteredItems / $perPage) : 1;

        return [
            'items' => $items,
            'pagination' => [
                'current_page' => $page,
                'page' => $page,
                'per_page' => $perPage,
                'total' => $filteredItems,
                'total_items' => $filteredItems,
                'total_records' => $totalRecords,
                'filtered_records' => $filteredItems,
                'last_page' => $totalPages,
                'total_pages' => $totalPages,
                'sorting' => [
                    'sort_by' => $resolvedSortKey,
                    'sort_dir' => strtolower($direction),
                ],
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
                d.avatar_path, d.avatar_mime, d.avatar_updated_at,
                d.is_active, d.created_at, d.updated_at,
                u.email
            FROM dentists d
            INNER JOIN users u ON d.user_id = u.id
            WHERE d.is_active = 1
            ORDER BY d.last_name ASC, d.first_name ASC
        ');

        return array_map(
            fn (array $row): array => $this->stripInternalFields($this->hydrateAvatarFields($row)),
            $stmt->fetchAll(PDO::FETCH_ASSOC)
        );
    }
}
