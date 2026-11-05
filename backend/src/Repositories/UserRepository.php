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

        return $row ?: null;
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

        return $row ?: null;
    }

    public function create(
        string $email,
        string $passwordHash,
        string $role = 'PATIENT',
        int $isActive = 1,
        int $emailVerified = 0
    ): int {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            INSERT INTO users (email, password_hash, role, is_active, email_verified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, NOW(), NOW())
        ');
        $stmt->execute([
            strtolower(trim($email)),
            $passwordHash,
            strtoupper($role),
            $isActive,
            $emailVerified,
        ]);

        return (int) $pdo->lastInsertId();
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
}

