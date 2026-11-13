<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Authentication Token Repository
 * Manages hashed, single-use tokens for email verification and password recovery.
 */
class AuthTokenRepository
{
    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    public function createToken(int $userId, string $tokenHash, string $tokenType, int $ttlSeconds): int
    {
        $pdo = $this->database->getConnection();
        
        // Invalidate older unused tokens of the same type for this user
        $this->invalidateOutstandingTokens($userId, $tokenType);

        $expiresAt = date('Y-m-d H:i:s', time() + $ttlSeconds);

        $stmt = $pdo->prepare('
            INSERT INTO auth_tokens (user_id, token_hash, token_type, expires_at, created_at)
            VALUES (?, ?, ?, ?, NOW())
        ');
        $stmt->execute([
            $userId,
            $tokenHash,
            strtoupper($tokenType),
            $expiresAt,
        ]);

        return (int) $pdo->lastInsertId();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findValidToken(string $tokenHash, string $tokenType): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT * FROM auth_tokens
            WHERE token_hash = ?
              AND token_type = ?
              AND used_at IS NULL
              AND expires_at > NOW()
            LIMIT 1
        ');
        $stmt->execute([
            $tokenHash,
            strtoupper($tokenType),
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function markTokenUsed(int $tokenId): bool
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE auth_tokens
            SET used_at = NOW()
            WHERE id = ? AND used_at IS NULL
        ');

        return $stmt->execute([$tokenId]);
    }

    public function invalidateOutstandingTokens(int $userId, string $tokenType): int
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE auth_tokens
            SET used_at = NOW()
            WHERE user_id = ?
              AND token_type = ?
              AND used_at IS NULL
        ');
        $stmt->execute([$userId, strtoupper($tokenType)]);

        return $stmt->rowCount();
    }
}
