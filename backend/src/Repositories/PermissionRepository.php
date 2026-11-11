<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * System Permission Repository (DRBAC)
 */
class PermissionRepository
{
    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * Retrieve all system permissions
     *
     * @return list<array<string, mixed>>
     */
    public function getAll(): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->query('
            SELECT id, name, slug, module, description, created_at
            FROM permissions
            ORDER BY module ASC, slug ASC
        ');

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Retrieve permissions grouped by functional module
     *
     * @return array<string, list<array<string, mixed>>>
     */
    public function getAllGroupedByModule(): array
    {
        $all = $this->getAll();
        $grouped = [];

        foreach ($all as $perm) {
            $mod = (string) ($perm['module'] ?: 'general');
            if (!isset($grouped[$mod])) {
                $grouped[$mod] = [];
            }
            $grouped[$mod][] = $perm;
        }

        return $grouped;
    }
}
