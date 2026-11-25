<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Persistence and concurrency-safe claiming for the real-time notification outbox.
 */
class RealtimeOutboxRepository
{
    public const STATUS_PENDING = 'PENDING';
    public const STATUS_PROCESSING = 'PROCESSING';
    public const STATUS_PUBLISHED = 'PUBLISHED';
    public const STATUS_FAILED_RETRYABLE = 'FAILED_RETRYABLE';
    public const STATUS_FAILED_PERMANENT = 'FAILED_PERMANENT';

    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * Insert an outbox event (optionally inside an active PDO transaction).
     *
     * @param array<string, mixed> $data
     */
    public function insert(array $data, ?PDO $pdo = null): int
    {
        $conn = $pdo ?? $this->database->getConnection();
        $driver = strtolower((string) $conn->getAttribute(PDO::ATTR_DRIVER_NAME));
        $insertKeyword = $driver === 'sqlite' ? 'INSERT OR IGNORE INTO' : 'INSERT IGNORE INTO';

        $stmt = $conn->prepare("
            {$insertKeyword} realtime_outbox (
                event_id, event_type, notification_id, recipient_user_id, payload,
                status, attempt_count, max_attempts, available_at, created_at
            ) VALUES (
                :event_id, :event_type, :notification_id, :recipient_user_id, :payload,
                :status, :attempt_count, :max_attempts, :available_at, :created_at
            )
        ");

        $now = (string) ($data['created_at'] ?? date('Y-m-d H:i:s'));
        $stmt->execute([
            'event_id' => (string) $data['event_id'],
            'event_type' => (string) $data['event_type'],
            'notification_id' => isset($data['notification_id']) ? (int) $data['notification_id'] : null,
            'recipient_user_id' => (int) $data['recipient_user_id'],
            'payload' => is_string($data['payload']) ? $data['payload'] : json_encode($data['payload'], JSON_UNESCAPED_SLASHES),
            'status' => (string) ($data['status'] ?? self::STATUS_PENDING),
            'attempt_count' => (int) ($data['attempt_count'] ?? 0),
            'max_attempts' => (int) ($data['max_attempts'] ?? 5),
            'available_at' => (string) ($data['available_at'] ?? $now),
            'created_at' => $now,
        ]);

        if ($stmt->rowCount() === 0) {
            return 0;
        }

        return (int) $conn->lastInsertId();
    }

    /**
     * Recover abandoned PROCESSING rows whose lock expired.
     */
    public function recoverStaleLocks(string $staleBefore, string $nowStr): int
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE realtime_outbox
            SET status = :retry_status,
                locked_at = NULL,
                locked_by = NULL,
                available_at = :available_at,
                last_error = COALESCE(last_error, "Recovered from stale worker lock")
            WHERE status = :processing_status
              AND locked_at IS NOT NULL
              AND locked_at < :stale_before
        ');
        $stmt->execute([
            'retry_status' => self::STATUS_FAILED_RETRYABLE,
            'available_at' => $nowStr,
            'processing_status' => self::STATUS_PROCESSING,
            'stale_before' => $staleBefore,
        ]);

        return $stmt->rowCount();
    }

    /**
     * Claim a batch of due PENDING / FAILED_RETRYABLE outbox rows for a worker.
     *
     * @return list<array<string, mixed>>
     */
    public function claimDueBatch(string $workerId, int $limit, string $nowStr): array
    {
        $pdo = $this->database->getConnection();
        $driver = strtolower((string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME));
        $useSkipLocked = ($driver === 'mysql' && !$pdo->inTransaction());

        if ($useSkipLocked) {
            try {
                $pdo->beginTransaction();
                $selectStmt = $pdo->prepare('
                    SELECT id
                    FROM realtime_outbox
                    WHERE status IN (:pending, :retryable)
                      AND available_at <= :now_str
                    ORDER BY available_at ASC, id ASC
                    LIMIT :limit
                    FOR UPDATE SKIP LOCKED
                ');
                $selectStmt->bindValue(':pending', self::STATUS_PENDING);
                $selectStmt->bindValue(':retryable', self::STATUS_FAILED_RETRYABLE);
                $selectStmt->bindValue(':now_str', $nowStr);
                $selectStmt->bindValue(':limit', max(1, $limit), PDO::PARAM_INT);
                $selectStmt->execute();
                $ids = array_map('intval', $selectStmt->fetchAll(PDO::FETCH_COLUMN));

                if ($ids === []) {
                    $pdo->commit();
                    return [];
                }

                $placeholders = implode(', ', array_fill(0, count($ids), '?'));
                $upd = $pdo->prepare("
                    UPDATE realtime_outbox
                    SET status = ?, locked_at = ?, locked_by = ?, attempt_count = attempt_count + 1
                    WHERE id IN ({$placeholders})
                ");
                $upd->execute(array_merge([self::STATUS_PROCESSING, $nowStr, $workerId], $ids));

                $fetch = $pdo->prepare("SELECT * FROM realtime_outbox WHERE id IN ({$placeholders}) ORDER BY available_at ASC, id ASC");
                $fetch->execute($ids);
                $rows = $fetch->fetchAll(PDO::FETCH_ASSOC);
                $pdo->commit();

                return $rows;
            } catch (\Throwable) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                // Fall back to portable CAS claiming
            }
        }

        $stmt = $pdo->prepare('
            SELECT id
            FROM realtime_outbox
            WHERE status IN (:pending, :retryable)
              AND available_at <= :now_str
            ORDER BY available_at ASC, id ASC
            LIMIT :limit
        ');
        $stmt->bindValue(':pending', self::STATUS_PENDING);
        $stmt->bindValue(':retryable', self::STATUS_FAILED_RETRYABLE);
        $stmt->bindValue(':now_str', $nowStr);
        $stmt->bindValue(':limit', max(1, $limit), PDO::PARAM_INT);
        $stmt->execute();

        $ids = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
        if ($ids === []) {
            return [];
        }

        $claimed = [];
        $lockStmt = $pdo->prepare('
            UPDATE realtime_outbox
            SET status = :processing,
                locked_at = :locked_at,
                locked_by = :locked_by,
                attempt_count = attempt_count + 1
            WHERE id = :id
              AND status IN (:pending, :retryable)
        ');
        $fetchStmt = $pdo->prepare('SELECT * FROM realtime_outbox WHERE id = ? LIMIT 1');

        foreach ($ids as $id) {
            $lockStmt->execute([
                'processing' => self::STATUS_PROCESSING,
                'locked_at' => $nowStr,
                'locked_by' => $workerId,
                'id' => $id,
                'pending' => self::STATUS_PENDING,
                'retryable' => self::STATUS_FAILED_RETRYABLE,
            ]);
            if ($lockStmt->rowCount() === 1) {
                $fetchStmt->execute([$id]);
                $row = $fetchStmt->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    $claimed[] = $row;
                }
            }
        }

        return $claimed;
    }

    public function markPublished(int $id, string $publishedAt): void
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE realtime_outbox
            SET status = :status,
                published_at = :published_at,
                locked_at = NULL,
                locked_by = NULL,
                last_error = NULL
            WHERE id = :id
        ');
        $stmt->execute([
            'status' => self::STATUS_PUBLISHED,
            'published_at' => $publishedAt,
            'id' => $id,
        ]);
    }

    public function markRetryableFailure(int $id, string $nextAvailableAt, string $error): void
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE realtime_outbox
            SET status = :status,
                available_at = :available_at,
                locked_at = NULL,
                locked_by = NULL,
                last_error = :last_error
            WHERE id = :id
        ');
        $stmt->execute([
            'status' => self::STATUS_FAILED_RETRYABLE,
            'available_at' => $nextAvailableAt,
            'last_error' => substr($error, 0, 500),
            'id' => $id,
        ]);
    }

    public function markPermanentFailure(int $id, string $error): void
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE realtime_outbox
            SET status = :status,
                locked_at = NULL,
                locked_by = NULL,
                last_error = :last_error
            WHERE id = :id
        ');
        $stmt->execute([
            'status' => self::STATUS_FAILED_PERMANENT,
            'last_error' => substr($error, 0, 500),
            'id' => $id,
        ]);
    }

    /**
     * Aggregate queue counts for Prometheus / operational status.
     *
     * @return array{pending: int, processing: int, published: int, failed_retryable: int, failed_permanent: int, retries: int}
     */
    public function stats(): array
    {
        $pdo = $this->database->getConnection();
        $counts = [
            'pending' => 0,
            'processing' => 0,
            'published' => 0,
            'failed_retryable' => 0,
            'failed_permanent' => 0,
            'retries' => 0,
        ];

        $rows = $pdo->query('SELECT status, COUNT(*) AS c FROM realtime_outbox GROUP BY status')->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $row) {
            $status = strtolower((string) $row['status']);
            if (array_key_exists($status, $counts)) {
                $counts[$status] = (int) $row['c'];
            }
        }

        $retries = $pdo->query('SELECT COALESCE(SUM(CASE WHEN attempt_count > 1 THEN attempt_count - 1 ELSE 0 END), 0) FROM realtime_outbox')->fetchColumn();
        $counts['retries'] = (int) $retries;

        return $counts;
    }
}
