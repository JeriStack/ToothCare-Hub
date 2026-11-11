<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Dynamic Role-Based Access Control (DRBAC) Repository
 */
class RoleRepository
{
    private Database $database;

    /**
     * Core permissions locked for the Administrator role to prevent accidental lockout
     */
    public const PROTECTED_ADMIN_PERMISSIONS = [
        'users.view',
        'users.manage',
        'roles.manage',
        'audit_logs.view',
        'settings.manage',
    ];

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function getAllRolesWithPermissions(): array
    {
        $pdo = $this->database->getConnection();
        $roles = $pdo->query('
            SELECT id, name, slug, description, is_system, created_at
            FROM roles
            ORDER BY id ASC
        ')->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Fetch permissions map
        $rpStmt = $pdo->query('
            SELECT rp.role_id, p.slug
            FROM role_permissions rp
            INNER JOIN permissions p ON rp.permission_id = p.id
        ');
        $map = [];
        foreach ($rpStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $rId = (int) $row['role_id'];
            if (!isset($map[$rId])) {
                $map[$rId] = [];
            }
            $map[$rId][] = (string) $row['slug'];
        }

        // Attach permission counts and user counts
        $userCountStmt = $pdo->query('
            SELECT UPPER(role) AS role_upper, COUNT(*) AS cnt
            FROM users
            GROUP BY UPPER(role)
        ');
        $userCounts = [];
        foreach ($userCountStmt->fetchAll(PDO::FETCH_ASSOC) as $uc) {
            $userCounts[(string) $uc['role_upper']] = (int) $uc['cnt'];
        }

        foreach ($roles as &$role) {
            $rId = (int) $role['id'];
            $slugUpper = strtoupper((string) $role['slug']);
            $role['id'] = $rId;
            $role['is_system'] = (int) $role['is_system'] === 1;
            $role['permissions'] = $map[$rId] ?? [];
            $role['users_count'] = $userCounts[$slugUpper] ?? 0;
        }
        unset($role);

        return $roles;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findById(int $id): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('SELECT * FROM roles WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findBySlug(string $slug): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('SELECT * FROM roles WHERE slug = ? LIMIT 1');
        $stmt->execute([strtolower(trim($slug))]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Retrieve list of permission slugs assigned to a role
     *
     * @return list<string>
     */
    public function getRolePermissions(int $roleId): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT p.slug
            FROM role_permissions rp
            INNER JOIN permissions p ON rp.permission_id = p.id
            WHERE rp.role_id = ?
        ');
        $stmt->execute([$roleId]);

        return $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
    }

    /**
     * Replace role permissions with full transactional atomicity
     *
     * @param list<string> $permissionSlugs
     */
    public function syncRolePermissions(int $roleId, array $permissionSlugs): bool
    {
        $pdo = $this->database->getConnection();
        $role = $this->findById($roleId);
        if ($role === null) {
            return false;
        }

        // Enforce super-admin protection invariant
        if (strtolower((string) $role['slug']) === 'admin') {
            $permissionSlugs = array_values(array_unique(array_merge(
                $permissionSlugs,
                self::PROTECTED_ADMIN_PERMISSIONS
            )));
        }

        $pdo->beginTransaction();
        try {
            $delStmt = $pdo->prepare('DELETE FROM role_permissions WHERE role_id = ?');
            $delStmt->execute([$roleId]);

            if (count($permissionSlugs) > 0) {
                $placeholders = implode(',', array_fill(0, count($permissionSlugs), '?'));
                $permStmt = $pdo->prepare("SELECT id FROM permissions WHERE slug IN ({$placeholders})");
                $permStmt->execute($permissionSlugs);
                $permIds = $permStmt->fetchAll(PDO::FETCH_COLUMN);

                $insStmt = $pdo->prepare('INSERT INTO role_permissions (role_id, permission_id, granted_at) VALUES (?, ?, NOW())');
                foreach ($permIds as $pId) {
                    $insStmt->execute([$roleId, (int) $pId]);
                }
            }

            $pdo->commit();
            return true;
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Check if a role possesses a specific permission slug in the database
     */
    public function roleHasPermission(string $roleSlug, string $permissionSlug): bool
    {
        $pdo = $this->database->getConnection();
        $normalizedRole = strtolower(trim($roleSlug));

        $stmt = $pdo->prepare('
            SELECT COUNT(*)
            FROM role_permissions rp
            INNER JOIN roles r ON rp.role_id = r.id
            INNER JOIN permissions p ON rp.permission_id = p.id
            WHERE r.slug = ? AND p.slug = ?
        ');
        $stmt->execute([$normalizedRole, $permissionSlug]);

        return ((int) $stmt->fetchColumn()) > 0;
    }

    /**
     * Return all permission slugs assigned to a given role slug
     *
     * @return list<string>
     */
    public function getPermissionsForRoleSlug(string $roleSlug): array
    {
        try {
            $pdo = $this->database->getConnection();
            $stmt = $pdo->prepare('
                SELECT p.slug
                FROM role_permissions rp
                INNER JOIN roles r ON rp.role_id = r.id
                INNER JOIN permissions p ON rp.permission_id = p.id
                WHERE r.slug = ?
                ORDER BY p.slug ASC
            ');
            $stmt->execute([strtolower(trim($roleSlug))]);
            return $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
        } catch (\Throwable $e) {
            return [];
        }
    }
}
