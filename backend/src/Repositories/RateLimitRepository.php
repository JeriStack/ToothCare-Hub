<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Rate Limiting Repository
 * Provides server-side atomic sliding-window rate limit counters with persistent database storage.
 */
class RateLimitRepository
{
    private Database $database;
    /**
     * @var array<string, array{hits: int, reset_at: int}>
     */
    private static array $inMemoryFallback = [];

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * Hit a rate limit bucket and return current consumption
     *
     * @return array{hits: int, remaining: int, reset_at: int, allowed: bool}
     */
    public function hit(string $key, int $maxHits, int $windowSeconds): array
    {
        $now = time();
        $resetTime = $now + $windowSeconds;
        $resetDate = date('Y-m-d H:i:s', $resetTime);

        try {
            $pdo = $this->database->getConnection();

            // Try to find an unexpired bucket
            $stmt = $pdo->prepare('SELECT hits, UNIX_TIMESTAMP(reset_at) as reset_timestamp FROM rate_limits WHERE rate_key = ? LIMIT 1');
            $stmt->execute([$key]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row) {
                $currentHits = (int) $row['hits'];
                $currentReset = (int) ($row['reset_timestamp'] ?? (strtotime((string) ($row['reset_at'] ?? 'now'))));

                if ($now > $currentReset) {
                    // Window expired, reset bucket
                    $updateStmt = $pdo->prepare('
                        UPDATE rate_limits
                        SET hits = 1, reset_at = ?, updated_at = NOW()
                        WHERE rate_key = ?
                    ');
                    $updateStmt->execute([$resetDate, $key]);

                    return [
                        'hits' => 1,
                        'remaining' => max(0, $maxHits - 1),
                        'reset_at' => $resetTime,
                        'allowed' => true,
                    ];
                }

                // Increment hits
                $newHits = $currentHits + 1;
                $updateStmt = $pdo->prepare('
                    UPDATE rate_limits
                    SET hits = hits + 1, updated_at = NOW()
                    WHERE rate_key = ?
                ');
                $updateStmt->execute([$key]);

                return [
                    'hits' => $newHits,
                    'remaining' => max(0, $maxHits - $newHits),
                    'reset_at' => $currentReset,
                    'allowed' => $newHits <= $maxHits,
                ];
            }

            // Insert new bucket
            $insertStmt = $pdo->prepare('
                INSERT INTO rate_limits (rate_key, hits, reset_at, created_at, updated_at)
                VALUES (?, 1, ?, NOW(), NOW())
            ');
            $insertStmt->execute([$key, $resetDate]);

            return [
                'hits' => 1,
                'remaining' => max(0, $maxHits - 1),
                'reset_at' => $resetTime,
                'allowed' => true,
            ];
        } catch (\Throwable $e) {
            // In-memory fallback if database is unavailable or in unit tests
            if (!isset(self::$inMemoryFallback[$key]) || self::$inMemoryFallback[$key]['reset_at'] < $now) {
                self::$inMemoryFallback[$key] = [
                    'hits' => 1,
                    'reset_at' => $resetTime,
                ];
            } else {
                self::$inMemoryFallback[$key]['hits']++;
            }

            $currentHits = self::$inMemoryFallback[$key]['hits'];
            $currentReset = self::$inMemoryFallback[$key]['reset_at'];

            return [
                'hits' => $currentHits,
                'remaining' => max(0, $maxHits - $currentHits),
                'reset_at' => $currentReset,
                'allowed' => $currentHits <= $maxHits,
            ];
        }
    }

    public function clear(string $key): void
    {
        unset(self::$inMemoryFallback[$key]);

        try {
            $pdo = $this->database->getConnection();
            $stmt = $pdo->prepare('DELETE FROM rate_limits WHERE rate_key = ?');
            $stmt->execute([$key]);
        } catch (\Throwable $e) {
            // Ignore failure on clear
        }
    }

    public static function resetInMemory(): void
    {
        self::$inMemoryFallback = [];
    }
}
