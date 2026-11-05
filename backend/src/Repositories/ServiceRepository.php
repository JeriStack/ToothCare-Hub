<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Service Catalog Repository
 * Manages dental procedure listings, pricing, durations, and administrative pagination.
 */
class ServiceRepository
{
    private Database $database;

    private const SORT_ALLOWLIST = [
        'id' => 'id',
        'name' => 'name',
        'price' => 'price',
        'duration_minutes' => 'duration_minutes',
        'category' => 'category',
        'is_active' => 'is_active',
        'created_at' => 'created_at',
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
        $stmt = $pdo->prepare('SELECT * FROM services WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findByName(string $name): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('SELECT * FROM services WHERE LOWER(name) = LOWER(?) LIMIT 1');
        $stmt->execute([trim($name)]);
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
            INSERT INTO services (name, category, description, price, duration_minutes, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        ');

        $stmt->execute([
            trim((string) $data['name']),
            trim((string) ($data['category'] ?? 'General')),
            $data['description'] ?? null,
            (float) $data['price'],
            (int) $data['duration_minutes'],
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

        $allowedColumns = ['name', 'category', 'description', 'price', 'duration_minutes', 'is_active'];
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
        $stmt = $pdo->prepare("UPDATE services SET {$setClause} WHERE id = ?");

        return $stmt->execute($params);
    }

    public function updateStatus(int $id, int $isActive): bool
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('UPDATE services SET is_active = ?, updated_at = NOW() WHERE id = ?');
        return $stmt->execute([$isActive, $id]);
    }

    public function countAppointmentsReferencing(int $serviceId): int
    {
        try {
            $pdo = $this->database->getConnection();
            $stmt = $pdo->prepare('SELECT COUNT(*) FROM appointments WHERE service_id = ?');
            $stmt->execute([$serviceId]);
            return (int) $stmt->fetchColumn();
        } catch (\Throwable $e) {
            return 0;
        }
    }

    /**
     * List services with server-side search, filtering, allowlisted sorting, and pagination
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

        // Sorting allowlist protection against SQL injection
        $sortColumn = self::SORT_ALLOWLIST[$sortBy] ?? 'name';
        $direction = strtoupper($sortDir) === 'DESC' ? 'DESC' : 'ASC';

        $where = [];
        $params = [];

        // Search query (name or description or category)
        if (!empty($filters['search'])) {
            $searchTerm = '%' . str_replace(['%', '_'], ['\\%', '\\_'], trim((string) $filters['search'])) . '%';
            $where[] = '(name LIKE ? OR description LIKE ? OR category LIKE ?)';
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }

        // Active filter
        if (isset($filters['is_active']) && $filters['is_active'] !== '') {
            $where[] = 'is_active = ?';
            $params[] = (int) $filters['is_active'];
        }

        // Category filter
        if (!empty($filters['category'])) {
            $where[] = 'category = ?';
            $params[] = trim((string) $filters['category']);
        }

        $whereSql = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        // Count total matching items
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM services {$whereSql}");
        $countStmt->execute($params);
        $totalItems = (int) $countStmt->fetchColumn();

        // Retrieve paginated items
        $sql = "
            SELECT * FROM services
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
                'total' => $totalItems,
                'total_items' => $totalItems,
                'page' => $page,
                'current_page' => $page,
                'per_page' => $perPage,
                'last_page' => $totalPages,
                'total_pages' => $totalPages,
            ],
        ];
    }

    /**
     * List active services for public/patient booking selection
     *
     * @return list<array<string, mixed>>
     */
    public function listActive(): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->query('SELECT * FROM services WHERE is_active = 1 ORDER BY category ASC, name ASC');
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
