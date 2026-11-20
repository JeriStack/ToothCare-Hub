<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Persistence for short-lived, single-use, hashed Socket.IO connection tickets.
 * Raw opaque ticket values are NEVER stored in the database.
 */
class RealtimeTicketRepository
{
    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * Persist a hashed connection ticket record.
     *
     * @param array<string, mixed> $data
     */
    public function create(array $data): int
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            INSERT INTO realtime_tickets (
                ticket_hash, user_id, role, dentist_id, session_id_hash, permissions_json, expires_at, created_at
            ) VALUES (
                :ticket_hash, :user_id, :role, :dentist_id, :session_id_hash, :permissions_json, :expires_at, :created_at
            )
        ');

        $stmt->execute([
            'ticket_hash' => (string) $data['ticket_hash'],
            'user_id' => (int) $data['user_id'],
            'role' => strtoupper((string) $data['role']),
            'dentist_id' => isset($data['dentist_id']) ? (int) $data['dentist_id'] : null,
            'session_id_hash' => $data['session_id_hash'] ?? null,
            'permissions_json' => (string) ($data['permissions_json'] ?? '[]'),
            'expires_at' => (string) $data['expires_at'],
            'created_at' => (string) ($data['created_at'] ?? date('Y-m-d H:i:s')),
        ]);

        return (int) $pdo->lastInsertId();
    }

    /**
     * Lookup a ticket record by its SHA-256 hash.
     *
     * @return array<string, mixed>|null
     */
    public function findByHash(string $ticketHash): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('SELECT * FROM realtime_tickets WHERE ticket_hash = ? LIMIT 1');
        $stmt->execute([$ticketHash]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Atomically mark an unused, unrevoked, unexpired ticket as consumed.
     * Returns true only for the single winner in concurrent verification attempts.
     */
    public function markConsumedAtomically(string $ticketHash, string $nowStr): bool
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE realtime_tickets
            SET used_at = :used_at
            WHERE ticket_hash = :ticket_hash
              AND used_at IS NULL
              AND revoked_at IS NULL
              AND expires_at > :now_check
        ');
        $stmt->execute([
            'used_at' => $nowStr,
            'ticket_hash' => $ticketHash,
            'now_check' => $nowStr,
        ]);

        return $stmt->rowCount() === 1;
    }

    /**
     * Revoke all active tickets for a specific user session.
     */
    public function revokeBySession(int $userId, string $sessionIdHash, ?string $nowStr = null): int
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE realtime_tickets
            SET revoked_at = :revoked_at
            WHERE user_id = :user_id
              AND session_id_hash = :session_id_hash
              AND revoked_at IS NULL
        ');
        $stmt->execute([
            'revoked_at' => $nowStr ?? date('Y-m-d H:i:s'),
            'user_id' => $userId,
            'session_id_hash' => $sessionIdHash,
        ]);

        return $stmt->rowCount();
    }

    /**
     * Revoke all active tickets for a user across all sessions (e.g. deactivation or role change).
     */
    public function revokeAllForUser(int $userId, ?string $nowStr = null): int
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE realtime_tickets
            SET revoked_at = :revoked_at
            WHERE user_id = :user_id
              AND revoked_at IS NULL
        ');
        $stmt->execute([
            'revoked_at' => $nowStr ?? date('Y-m-d H:i:s'),
            'user_id' => $userId,
        ]);

        return $stmt->rowCount();
    }

    /**
     * Delete expired tickets older than cutoff to keep the table compact.
     */
    public function purgeExpired(string $olderThan): int
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('DELETE FROM realtime_tickets WHERE expires_at < ?');
        $stmt->execute([$olderThan]);

        return $stmt->rowCount();
    }
}
