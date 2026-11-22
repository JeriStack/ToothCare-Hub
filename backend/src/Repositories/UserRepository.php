<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * User Account Repository
 * Manages identity, authentication credentials, and account statuses.
 */
class UserRepository
{
    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findByEmail(string $email): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([strtolower(trim($email))]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? $this->hydrateAvatarFields($row) : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findById(int $id): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? $this->hydrateAvatarFields($row) : null;
    }

    public function create(
        string $email,
        string $passwordHash,
        string $role = 'PATIENT',
        int $isActive = 1,
        int $emailVerified = 0,
        ?string $firstName = null,
        ?string $lastName = null
    ): int {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            INSERT INTO users (email, first_name, last_name, password_hash, role, is_active, email_verified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ');
        $cleanFirst = $firstName !== null && trim($firstName) !== '' ? trim($firstName) : null;
        $cleanLast = $lastName !== null && trim($lastName) !== '' ? trim($lastName) : null;
        $stmt->execute([
            strtolower(trim($email)),
            $cleanFirst,
            $cleanLast,
            $passwordHash,
            strtoupper($role),
            $isActive,
            $emailVerified,
        ]);

        return (int) $pdo->lastInsertId();
    }

    public function updateName(int $userId, ?string $firstName, ?string $lastName): bool
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE users
            SET first_name = ?, last_name = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ');

        return $stmt->execute([
            $firstName !== null && trim($firstName) !== '' ? trim($firstName) : null,
            $lastName !== null && trim($lastName) !== '' ? trim($lastName) : null,
            $userId,
        ]);
    }

    /**
     * Update user profile contact information and names
     *
     * @param array<string, mixed> $data
     */
    public function updateProfile(int $userId, array $data): bool
    {
        $pdo = $this->database->getConnection();
        $fields = [];
        $params = [];

        $allowedColumns = ['first_name', 'last_name', 'phone'];
        foreach ($allowedColumns as $col) {
            if (array_key_exists($col, $data)) {
                $fields[] = "{$col} = ?";
                $val = $data[$col] !== null ? trim((string) $data[$col]) : null;
                $params[] = $val === '' ? null : $val;
            }
        }

        if (empty($fields)) {
            return false;
        }

        $fields[] = 'updated_at = CURRENT_TIMESTAMP';
        $params[] = $userId;

        $setClause = implode(', ', $fields);
        $stmt = $pdo->prepare("UPDATE users SET {$setClause} WHERE id = ?");

        return $stmt->execute($params);
    }

    public function updateAvatar(int $userId, string $filename, string $mime): bool
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE users
            SET avatar_path = ?,
                avatar_mime = ?,
                avatar_updated_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ');

        return $stmt->execute([$filename, $mime, $userId]);
    }

    public function clearAvatar(int $userId): bool
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE users
            SET avatar_path = NULL,
                avatar_mime = NULL,
                avatar_updated_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ');

        return $stmt->execute([$userId]);
    }

    /**
     * Append computed avatar_url when an avatar file is registered on the user row.
     *
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function hydrateAvatarFields(array $row): array
    {
        $hasAvatar = !empty($row['avatar_path']) && isset($row['id']);
        $versionSource = (string) ($row['avatar_updated_at'] ?? '') . '_' . (string) ($row['avatar_path'] ?? '');
        $row['avatar_url'] = $hasAvatar
            ? '/api/v1/users/' . (int) $row['id'] . '/avatar?v=' . rawurlencode($versionSource)
            : null;

        return $row;
    }

    /**
     * Strip internal server storage fields before serializing a user payload to API clients.
     *
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function stripInternalFields(array $row): array
    {
        unset($row['avatar_path'], $row['avatar_mime'], $row['password_hash']);
        return $row;
    }

    public function updatePassword(int $userId, string $passwordHash): bool
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE users
            SET password_hash = ?, updated_at = NOW()
            WHERE id = ?
        ');

        return $stmt->execute([$passwordHash, $userId]);
    }

    public function markEmailVerified(int $userId): bool
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE users
            SET email_verified = 1, email_verified_at = NOW(), updated_at = NOW()
            WHERE id = ?
        ');

        return $stmt->execute([$userId]);
    }

    public function updateStatus(int $userId, int $isActive): bool
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE users
            SET is_active = ?, updated_at = NOW()
            WHERE id = ?
        ');

        return $stmt->execute([$isActive, $userId]);
    }

    public function updateRole(int $userId, string $role): bool
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE users
            SET role = ?, updated_at = NOW()
            WHERE id = ?
        ');

        return $stmt->execute([strtoupper($role), $userId]);
    }

    /**
     * Count active administrators to ensure at least one active super-admin remains
     */
    public function countActiveAdmins(): int
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'ADMIN' AND is_active = 1");
        return (int) $stmt->fetchColumn();
    }

    /**
     * Paginated list of users with multi-column filtering and linked profiles
     *
     * @param array<string, mixed> $filters
     * @return array{data: list<array<string, mixed>>, meta: array<string, mixed>}
     */
    public function list(
        array $filters = [],
        string $sortBy = 'created_at',
        string $sortDir = 'DESC',
        int $page = 1,
        int $perPage = 15
    ): array {
        $pdo = $this->database->getConnection();

        $where = [];
        $params = [];

        if (!empty($filters['search'])) {
            $search = '%' . trim((string) $filters['search']) . '%';
            $where[] = '(u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR d.first_name LIKE ? OR d.last_name LIKE ? OR p.first_name LIKE ? OR p.last_name LIKE ?)';
            $params[] = $search;
            $params[] = $search;
            $params[] = $search;
            $params[] = $search;
            $params[] = $search;
            $params[] = $search;
            $params[] = $search;
        }

        if (!empty($filters['role'])) {
            $where[] = 'u.role = ?';
            $params[] = strtoupper((string) $filters['role']);
        }

        if (isset($filters['is_active']) && $filters['is_active'] !== null && $filters['is_active'] !== '') {
            $where[] = 'u.is_active = ?';
            $params[] = (int) $filters['is_active'];
        }

        if (isset($filters['email_verified']) && $filters['email_verified'] !== null && $filters['email_verified'] !== '') {
            $where[] = 'u.email_verified = ?';
            $params[] = (int) $filters['email_verified'];
        }

        $whereSql = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

        // Count total matching records
        $countSql = "
            SELECT COUNT(DISTINCT u.id)
            FROM users u
            LEFT JOIN dentists d ON d.user_id = u.id
            LEFT JOIN patients p ON p.user_id = u.id
            {$whereSql}
        ";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        // Sort direction and column validation
        $allowedSort = ['created_at' => 'u.created_at', 'email' => 'u.email', 'role' => 'u.role', 'id' => 'u.id'];
        $sortColumn = $allowedSort[$sortBy] ?? 'u.created_at';
        $direction = strtoupper($sortDir) === 'ASC' ? 'ASC' : 'DESC';

        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $offset = ($page - 1) * $perPage;

        $selectSql = "
            SELECT 
                u.id, u.email, u.first_name AS user_first_name, u.last_name AS user_last_name, u.role, u.is_active, u.email_verified, u.created_at, u.updated_at,
                d.id AS dentist_id, d.first_name AS dentist_first_name, d.last_name AS dentist_last_name, d.specialization,
                p.id AS patient_id, p.first_name AS patient_first_name, p.last_name AS patient_last_name, p.phone AS patient_phone
            FROM users u
            LEFT JOIN dentists d ON d.user_id = u.id
            LEFT JOIN patients p ON p.user_id = u.id
            {$whereSql}
            ORDER BY {$sortColumn} {$direction}, u.id {$direction}
            LIMIT {$perPage} OFFSET {$offset}
        ";

        $stmt = $pdo->prepare($selectSql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Normalize display name
        $data = array_map(function ($row) {
            $firstName = null;
            $lastName = null;
            $displayName = null;
            if (!empty($row['dentist_first_name'])) {
                $firstName = (string) $row['dentist_first_name'];
                $lastName = (string) ($row['dentist_last_name'] ?? '');
                $displayName = 'Dr. ' . trim($firstName . ' ' . $lastName);
            } elseif (!empty($row['patient_first_name'])) {
                $firstName = (string) $row['patient_first_name'];
                $lastName = (string) ($row['patient_last_name'] ?? '');
                $displayName = trim($firstName . ' ' . $lastName);
            } elseif (!empty($row['user_first_name']) || !empty($row['user_last_name'])) {
                $firstName = (string) ($row['user_first_name'] ?? '');
                $lastName = (string) ($row['user_last_name'] ?? '');
                $displayName = trim($firstName . ' ' . $lastName);
            } else {
                $local = explode('@', (string) $row['email'])[0];
                $displayName = ucwords(trim(str_replace(['.', '_', '-'], ' ', $local)));
            }

            return [
                'id' => (int) $row['id'],
                'email' => (string) $row['email'],
                'first_name' => $firstName,
                'last_name' => $lastName,
                'role' => (string) $row['role'],
                'display_name' => $displayName,
                'is_active' => (int) $row['is_active'] === 1,
                'email_verified' => (int) $row['email_verified'] === 1,
                'created_at' => (string) $row['created_at'],
                'updated_at' => (string) $row['updated_at'],
                'dentist' => $row['dentist_id'] ? [
                    'id' => (int) $row['dentist_id'],
                    'first_name' => (string) $row['dentist_first_name'],
                    'last_name' => (string) $row['dentist_last_name'],
                    'specialization' => (string) ($row['specialization'] ?? ''),
                ] : null,
                'patient' => $row['patient_id'] ? [
                    'id' => (int) $row['patient_id'],
                    'first_name' => (string) $row['patient_first_name'],
                    'last_name' => (string) $row['patient_last_name'],
                    'phone' => (string) ($row['patient_phone'] ?? ''),
                ] : null,
            ];
        }, $rows);

        return [
            'data' => $data,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'last_page' => (int) ceil($total / $perPage) ?: 1,
            ],
        ];
    }

    /**
     * Retrieve user with full linked profile (dentist or patient)
     *
     * @return array<string, mixed>|null
     */
    public function getUserWithProfile(int $id): ?array
    {
        $user = $this->findById($id);
        if ($user === null) {
            return null;
        }

        $pdo = $this->database->getConnection();
        $role = strtoupper((string) $user['role']);

        $dentist = null;
        $patient = null;

        if ($role === 'DENTIST') {
            $stmt = $pdo->prepare('SELECT * FROM dentists WHERE user_id = ? LIMIT 1');
            $stmt->execute([$id]);
            $dentist = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        } elseif ($role === 'PATIENT') {
            $stmt = $pdo->prepare('SELECT * FROM patients WHERE user_id = ? LIMIT 1');
            $stmt->execute([$id]);
            $patient = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        }

        unset($user['password_hash']);

        $firstName = $dentist['first_name'] ?? $patient['first_name'] ?? $user['first_name'] ?? null;
        $lastName = $dentist['last_name'] ?? $patient['last_name'] ?? $user['last_name'] ?? null;
        if ($dentist !== null && !empty($dentist['first_name'])) {
            $displayName = 'Dr. ' . trim(($dentist['first_name'] ?? '') . ' ' . ($dentist['last_name'] ?? ''));
        } elseif (trim((string) $firstName . ' ' . (string) $lastName) !== '') {
            $displayName = trim((string) $firstName . ' ' . (string) $lastName);
        } else {
            $local = explode('@', (string) $user['email'])[0];
            $displayName = ucwords(trim(str_replace(['.', '_', '-'], ' ', $local)));
        }

        return [
            ...$user,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'display_name' => $displayName,
            'is_active' => (int) $user['is_active'] === 1,
            'email_verified' => (int) $user['email_verified'] === 1,
            'dentist' => $dentist,
            'patient' => $patient,
        ];
    }

    /**
     * Synchronize user to user_roles table
     */
    public function assignUserRole(int $userId, string $roleSlug): void
    {
        try {
            $pdo = $this->database->getConnection();
            $roleStmt = $pdo->prepare('SELECT id FROM roles WHERE slug = ? LIMIT 1');
            $roleStmt->execute([strtolower($roleSlug)]);
            $roleId = $roleStmt->fetchColumn();
            if (!$roleId) {
                return;
            }

            $delStmt = $pdo->prepare('DELETE FROM user_roles WHERE user_id = ?');
            $delStmt->execute([$userId]);

            $insStmt = $pdo->prepare('INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES (?, ?, NOW())');
            $insStmt->execute([$userId, (int) $roleId]);
        } catch (\Throwable $e) {
            // Ignore if user_roles table is not enabled in this environment
        }
    }
}

