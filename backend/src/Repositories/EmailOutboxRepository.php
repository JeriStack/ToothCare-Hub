<?php
declare(strict_types=1);
namespace App\Repositories;
use App\Core\Database;
use PDO;
use PDOException;
/**
 * Persistence for the email outbox. All timestamps are supplied by the caller (clinic time zone)
 * so comparisons never mix MySQL server time with application time.
 *
 * Methods that write on behalf of a business transaction accept no PDO argument on purpose:
 * they use the shared connection from Database, which is the same connection that owns the
 * active transaction.
 */
class EmailOutboxRepository
{
    public const PENDING = 'PENDING';
    public const PROCESSING = 'PROCESSING';
    public const SENT = 'SENT';
    public const FAILED_RETRYABLE = 'FAILED_RETRYABLE';
    public const FAILED_PERMANENT = 'FAILED_PERMANENT';
    public const CANCELLED = 'CANCELLED';
    /** Extra attempts granted by a manual retry or requeue. */
    public const MANUAL_RETRY_ALLOWANCE = 3;
    private Database $database;
    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }
    private function pdo(): PDO
    {
        return $this->database->getConnection();
    }
    /**
     * Insert a job idempotently. Returns the new id, or null when the event key already exists.
     * Any other database error is rethrown so the surrounding business transaction rolls back.
     *
     * @param array<string, mixed> $job
     */
    public function insertIdempotent(array $job): ?int
    {
        $pdo = $this->pdo();
        $eventKey = (string) $job['event_key'];
        $exists = $pdo->prepare('SELECT id FROM email_outbox WHERE event_key = ? LIMIT 1');
        $exists->execute([$eventKey]);
        if ($exists->fetchColumn() !== false) {
            return null;
        }
        $stmt = $pdo->prepare('
            INSERT INTO email_outbox (
                event_key, event_type, template_key, payload_json, user_id, appointment_id,
                recipient_email, recipient_name, subject, status, attempts, max_attempts,
                next_attempt_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
        ');
        try {
            $stmt->execute([
                $eventKey,
                $job['event_type'],
                $job['template_key'],
                $job['payload_json'],
                $job['user_id'] ?? null,
                $job['appointment_id'] ?? null,
                $job['recipient_email'],
                $job['recipient_name'],
                $job['subject'],
                self::PENDING,
                $job['max_attempts'],
                $job['available_at'],
                $job['now'],
                $job['now'],
            ]);
        } catch (PDOException $e) {
            if ($this->isDuplicateKey($e)) {
                return null;
            }
            throw $e;
        }
        return (int) $pdo->lastInsertId();
    }
    private function isDuplicateKey(PDOException $e): bool
    {
        $code = (string) $e->getCode();
        $driverCode = (int) ($e->errorInfo[1] ?? 0);
        return $code === '23000' && in_array($driverCode, [1062, 19], true)
            || str_contains(strtolower($e->getMessage()), 'unique constraint failed')
            || str_contains(strtolower($e->getMessage()), 'duplicate entry');
    }
    /**
     * Atomically claim up to $limit eligible jobs for one worker.
     * Uses a short transaction. On MySQL, FOR UPDATE SKIP LOCKED avoids contention; correctness
     * does not depend on it because every claim is a guarded UPDATE verified by row count.
     *
     * @return list<array<string, mixed>>
     */
    public function claimBatch(string $workerId, int $limit, string $now): array
    {
        $pdo = $this->pdo();
        $limit = max(1, min($limit, 500));
        $ownsTx = !$pdo->inTransaction();
        if ($ownsTx) {
            $pdo->beginTransaction();
        }
        $claimed = [];
        try {
            $skip = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE SKIP LOCKED' : '';
            $select = $pdo->prepare(
                "SELECT id FROM email_outbox
                 WHERE status IN ('PENDING','FAILED_RETRYABLE') AND next_attempt_at <= ?
                 ORDER BY next_attempt_at ASC, id ASC LIMIT {$limit}{$skip}"
            );
            $select->execute([$now]);
            $ids = $select->fetchAll(PDO::FETCH_COLUMN);
            $update = $pdo->prepare("
                UPDATE email_outbox
                SET status = 'PROCESSING', attempts = attempts + 1, locked_at = ?, locked_by = ?, updated_at = ?
                WHERE id = ? AND status IN ('PENDING','FAILED_RETRYABLE')
            ");
            foreach ($ids as $id) {
                $update->execute([$now, $workerId, $now, (int) $id]);
                if ($update->rowCount() === 1) {
                    $claimed[] = (int) $id;
                }
            }
            if ($ownsTx) {
                $pdo->commit();
            }
        } catch (\Throwable $e) {
            if ($ownsTx && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
        if ($claimed === []) {
            return [];
        }
        $in = implode(',', array_fill(0, count($claimed), '?'));
        $rows = $pdo->prepare("SELECT * FROM email_outbox WHERE id IN ({$in}) AND locked_by = ? ORDER BY id ASC");
        $rows->execute([...$claimed, $workerId]);
        return $rows->fetchAll(PDO::FETCH_ASSOC);
    }
    /**
     * Release jobs whose worker vanished. The crashed attempt already counted (attempts is
     * incremented at claim time), so exhausted jobs become permanent failures.
     *
     * @return int number of jobs recovered
     */
    public function recoverExpiredLocks(string $now, int $lockTimeoutSeconds): int
    {
        $pdo = $this->pdo();
        $cutoff = date('Y-m-d H:i:s', strtotime($now) - $lockTimeoutSeconds);
        $exhausted = $pdo->prepare("
            UPDATE email_outbox
            SET status = 'FAILED_PERMANENT', failed_at = ?, failure_category = 'UNKNOWN',
                last_error_code = 'LOCK_EXPIRED_EXHAUSTED', last_error = 'Worker lock expired and attempts are exhausted.',
                locked_at = NULL, locked_by = NULL, updated_at = ?
            WHERE status = 'PROCESSING' AND locked_at < ? AND attempts >= max_attempts
        ");
        $exhausted->execute([$now, $now, $cutoff]);
        $count = $exhausted->rowCount();
        $retry = $pdo->prepare("
            UPDATE email_outbox
            SET status = 'FAILED_RETRYABLE', next_attempt_at = ?, failure_category = 'UNKNOWN',
                last_error_code = 'LOCK_EXPIRED', last_error = 'Worker lock expired before a result was recorded.',
                locked_at = NULL, locked_by = NULL, updated_at = ?
            WHERE status = 'PROCESSING' AND locked_at < ?
        ");
        $retry->execute([$now, $now, $cutoff]);
        return $count + $retry->rowCount();
    }
    /**
     * @param array<string, mixed>|null $scrubbedPayload payload without sealed secrets
     */
    public function markSent(int $id, string $workerId, string $now, ?array $scrubbedPayload): bool
    {
        $stmt = $this->pdo()->prepare("
            UPDATE email_outbox
            SET status = 'SENT', sent_at = ?, payload_json = ?, last_error = NULL, last_error_code = NULL,
                failure_category = NULL, locked_at = NULL, locked_by = NULL, updated_at = ?
            WHERE id = ? AND status = 'PROCESSING' AND locked_by = ?
        ");
        $stmt->execute([
            $now,
            $scrubbedPayload === null ? null : json_encode($scrubbedPayload, JSON_UNESCAPED_UNICODE),
            $now,
            $id,
            $workerId,
        ]);
        return $stmt->rowCount() === 1;
    }
    public function markRetry(int $id, string $workerId, string $nextAttemptAt, string $category, string $code, string $message, string $now): bool
    {
        $stmt = $this->pdo()->prepare("
            UPDATE email_outbox
            SET status = 'FAILED_RETRYABLE', next_attempt_at = ?, failure_category = ?, last_error_code = ?,
                last_error = ?, locked_at = NULL, locked_by = NULL, updated_at = ?
            WHERE id = ? AND status = 'PROCESSING' AND locked_by = ?
        ");
        $stmt->execute([$nextAttemptAt, $category, $code, mb_substr($message, 0, 500), $now, $id, $workerId]);
        return $stmt->rowCount() === 1;
    }
    public function markFailed(int $id, string $workerId, string $category, string $code, string $message, string $now): bool
    {
        $stmt = $this->pdo()->prepare("
            UPDATE email_outbox
            SET status = 'FAILED_PERMANENT', failed_at = ?, failure_category = ?, last_error_code = ?,
                last_error = ?, locked_at = NULL, locked_by = NULL, updated_at = ?
            WHERE id = ? AND status = 'PROCESSING' AND locked_by = ?
        ");
        $stmt->execute([$now, $category, $code, mb_substr($message, 0, 500), $now, $id, $workerId]);
        return $stmt->rowCount() === 1;
    }
    public function markCancelled(int $id, string $workerId, string $code, string $message, string $now): bool
    {
        $stmt = $this->pdo()->prepare("
            UPDATE email_outbox
            SET status = 'CANCELLED', last_error_code = ?, last_error = ?, locked_at = NULL, locked_by = NULL, updated_at = ?
            WHERE id = ? AND status = 'PROCESSING' AND locked_by = ?
        ");
        $stmt->execute([$code, mb_substr($message, 0, 500), $now, $id, $workerId]);
        return $stmt->rowCount() === 1;
    }
    /**
     * Cancel queued (not yet claimed) jobs of the given types for an appointment.
     *
     * @param list<string> $eventTypes
     */
    public function cancelQueuedForAppointment(int $appointmentId, array $eventTypes, string $reasonCode, string $now, ?string $exceptEventKey = null): int
    {
        if ($eventTypes === []) {
            return 0;
        }
        $in = implode(',', array_fill(0, count($eventTypes), '?'));
        $params = [$reasonCode, 'Invalidated before delivery.', $now, $appointmentId, ...$eventTypes];
        $sql = "UPDATE email_outbox
                SET status = 'CANCELLED', last_error_code = ?, last_error = ?, updated_at = ?
                WHERE appointment_id = ? AND event_type IN ({$in}) AND status IN ('PENDING','FAILED_RETRYABLE')";
        if ($exceptEventKey !== null) {
            $sql .= ' AND event_key <> ?';
            $params[] = $exceptEventKey;
        }
        $stmt = $this->pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }
    /** @return array<string, mixed>|null */
    public function findById(int $id): ?array
    {
        $stmt = $this->pdo()->prepare('SELECT * FROM email_outbox WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }
    /** @return array<string, mixed>|null */
    public function findByEventKey(string $eventKey): ?array
    {
        $stmt = $this->pdo()->prepare('SELECT * FROM email_outbox WHERE event_key = ?');
        $stmt->execute([$eventKey]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }
    /**
     * Requeue an eligible failed job. Atomic: only one concurrent caller can succeed.
     * Grants MANUAL_RETRY_ALLOWANCE additional attempts without altering history columns.
     */
    public function requeue(int $id, string $now): bool
    {
        $allowance = self::MANUAL_RETRY_ALLOWANCE;
        $stmt = $this->pdo()->prepare("
            UPDATE email_outbox
            SET status = 'PENDING', next_attempt_at = ?, failed_at = NULL, locked_at = NULL, locked_by = NULL,
                max_attempts = CASE WHEN attempts > 240 THEN 250 ELSE attempts + {$allowance} END, updated_at = ?
            WHERE id = ? AND status IN ('FAILED_PERMANENT','FAILED_RETRYABLE')
        ");
        $stmt->execute([$now, $now, $id]);
        return $stmt->rowCount() === 1;
    }
    /** @param array<string, mixed>|null $scrubbedPayload */
    public function abandon(int $id, string $now, ?array $scrubbedPayload): bool
    {
        $stmt = $this->pdo()->prepare("
            UPDATE email_outbox
            SET status = 'FAILED_PERMANENT', failed_at = ?, failure_category = 'PERMANENT',
                last_error_code = 'ABANDONED_BY_ADMIN', last_error = 'Abandoned by an administrator.',
                payload_json = ?, locked_at = NULL, locked_by = NULL, updated_at = ?
            WHERE id = ? AND status IN ('PENDING','FAILED_RETRYABLE','FAILED_PERMANENT')
        ");
        $stmt->execute([
            $now,
            $scrubbedPayload === null ? null : json_encode($scrubbedPayload, JSON_UNESCAPED_UNICODE),
            $now,
            $id,
        ]);
        return $stmt->rowCount() === 1;
    }
    /**
     * @return array{counts: array<string,int>, exhausted: int, last_sent_at: ?string, oldest_pending_age_seconds: int, avg_delay_seconds: ?float, total: int}
     */
    public function stats(): array
    {
        $pdo = $this->pdo();
        $counts = [
            self::PENDING => 0, self::PROCESSING => 0, self::SENT => 0,
            self::FAILED_RETRYABLE => 0, self::FAILED_PERMANENT => 0, self::CANCELLED => 0,
        ];
        foreach ($pdo->query('SELECT status, COUNT(*) AS c FROM email_outbox GROUP BY status')->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $counts[(string) $r['status']] = (int) $r['c'];
        }
        $exhausted = (int) $pdo->query("SELECT COUNT(*) FROM email_outbox WHERE status = 'FAILED_PERMANENT' AND attempts >= max_attempts")->fetchColumn();
        $last = $pdo->query("SELECT MAX(sent_at) FROM email_outbox WHERE status = 'SENT'")->fetchColumn();
        $oldestPending = $pdo->query("SELECT MIN(created_at) FROM email_outbox WHERE status IN ('PENDING','FAILED_RETRYABLE')")->fetchColumn();
        $oldestPendingAgeSeconds = 0;
        if ($oldestPending !== false && $oldestPending !== null) {
            $ts = strtotime((string) $oldestPending);
            if ($ts !== false) {
                $oldestPendingAgeSeconds = max(0, time() - $ts);
            }
        }
        $recent = $pdo->query("SELECT created_at, sent_at FROM email_outbox WHERE status = 'SENT' AND sent_at IS NOT NULL ORDER BY id DESC LIMIT 200")->fetchAll(PDO::FETCH_ASSOC);
        $avg = null;
        if ($recent !== []) {
            $sum = 0;
            foreach ($recent as $r) {
                $sum += max(0, strtotime((string) $r['sent_at']) - strtotime((string) $r['created_at']));
            }
            $avg = round($sum / count($recent), 1);
        }
        return [
            'counts' => $counts,
            'exhausted' => $exhausted,
            'last_sent_at' => $last !== false && $last !== null ? (string) $last : null,
            'oldest_pending_age_seconds' => $oldestPendingAgeSeconds,
            'avg_delay_seconds' => $avg,
            'total' => array_sum($counts),
        ];
    }
    /**
     * Counts grouped for metrics. Labels are bounded: event_type and status.
     *
     * @return list<array{event_type: string, status: string, c: int}>
     */
    public function countsByTypeAndStatus(): array
    {
        $rows = $this->pdo()->query("SELECT COALESCE(event_type, 'LEGACY') AS event_type, status, COUNT(*) AS c FROM email_outbox GROUP BY COALESCE(event_type, 'LEGACY'), status")->fetchAll(PDO::FETCH_ASSOC);
        return array_map(static fn(array $r): array => ['event_type' => (string) $r['event_type'], 'status' => (string) $r['status'], 'c' => (int) $r['c']], $rows);
    }
    /**
     * @param array{status?: string, event_type?: string, failures_only?: bool} $filters
     * @return array{data: list<array<string, mixed>>, total: int}
     */
    public function list(array $filters, int $page, int $perPage): array
    {
        $where = [];
        $params = [];
        if (!empty($filters['status'])) {
            $where[] = 'status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['event_type'])) {
            $where[] = 'event_type = ?';
            $params[] = $filters['event_type'];
        }
        if (!empty($filters['failures_only'])) {
            $where[] = "status IN ('FAILED_RETRYABLE','FAILED_PERMANENT')";
        }
        $w = $where === [] ? '' : 'WHERE ' . implode(' AND ', $where);
        $pdo = $this->pdo();
        $count = $pdo->prepare("SELECT COUNT(*) FROM email_outbox {$w}");
        $count->execute($params);
        $total = (int) $count->fetchColumn();
        $perPage = max(1, min($perPage, 100));
        $offset = (max(1, $page) - 1) * $perPage;
        $stmt = $pdo->prepare("
            SELECT id, event_type, recipient_email, status, attempts, max_attempts, failure_category,
                   last_error_code, last_error, next_attempt_at, failed_at, sent_at, created_at, updated_at, appointment_id
            FROM email_outbox {$w} ORDER BY id DESC LIMIT {$perPage} OFFSET {$offset}
        ");
        $stmt->execute($params);
        return ['data' => $stmt->fetchAll(PDO::FETCH_ASSOC), 'total' => $total];
    }
    /**
     * @return list<array{event_type: string, category: string, c: int}>
     */
    public function failureBreakdown(): array
    {
        $rows = $this->pdo()->query("SELECT COALESCE(event_type, 'LEGACY') AS event_type, COALESCE(failure_category, 'UNKNOWN') AS category, COUNT(*) AS c FROM email_outbox WHERE status IN ('FAILED_PERMANENT','FAILED_RETRYABLE') GROUP BY COALESCE(event_type, 'LEGACY'), COALESCE(failure_category, 'UNKNOWN')")->fetchAll(PDO::FETCH_ASSOC);
        return array_map(static fn(array $r): array => ['event_type' => (string) $r['event_type'], 'category' => (string) $r['category'], 'c' => (int) $r['c']], $rows);
    }
    /**
     * Retries performed per event type (attempts beyond the first).
     *
     * @return array<string, int>
     */
    public function retryTotals(): array
    {
        $rows = $this->pdo()->query("SELECT COALESCE(event_type, 'LEGACY') AS event_type, SUM(CASE WHEN attempts > 1 THEN attempts - 1 ELSE 0 END) AS r FROM email_outbox GROUP BY COALESCE(event_type, 'LEGACY')")->fetchAll(PDO::FETCH_ASSOC);
        $out = [];
        foreach ($rows as $r) {
            $out[(string) $r['event_type']] = (int) $r['r'];
        }
        return $out;
    }
    /** @return array{status: string, start_at: string}|null */
    public function appointmentState(int $appointmentId): ?array
    {
        $stmt = $this->pdo()->prepare('SELECT status, start_at FROM appointments WHERE id = ?');
        $stmt->execute([$appointmentId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? ['status' => (string) $row['status'], 'start_at' => (string) $row['start_at']] : null;
    }
    /**
     * Confirmed appointments starting inside (from, until].
     *
     * @return list<int>
     */
    public function reminderCandidateIds(string $from, string $until, int $limit = 500): array
    {
        $limit = max(1, min($limit, 2000));
        $stmt = $this->pdo()->prepare("SELECT id FROM appointments WHERE status = 'CONFIRMED' AND start_at > ? AND start_at <= ? ORDER BY start_at ASC, id ASC LIMIT {$limit}");
        $stmt->execute([$from, $until]);
        return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    }
    /** Cancel queued reminders whose appointment is no longer CONFIRMED. */
    public function cancelRemindersForIneligibleAppointments(string $now): int
    {
        $stmt = $this->pdo()->prepare("
            UPDATE email_outbox
            SET status = 'CANCELLED', last_error_code = 'REMINDER_INELIGIBLE', last_error = 'Appointment is no longer eligible for a reminder.', updated_at = ?
            WHERE event_type = 'APPOINTMENT_REMINDER' AND status IN ('PENDING','FAILED_RETRYABLE')
              AND appointment_id IN (SELECT id FROM appointments WHERE status <> 'CONFIRMED')
        ");
        $stmt->execute([$now]);
        return $stmt->rowCount();
    }
    public function setting(string $key): ?string
    {
        try {
            $stmt = $this->pdo()->prepare('SELECT setting_value FROM clinic_settings WHERE setting_key = ?');
            $stmt->execute([$key]);
            $v = $stmt->fetchColumn();
            return $v === false ? null : (string) $v;
        } catch (\Throwable) {
            return null;
        }
    }
    /**
     * Clinic contact details for template footers.
     *
     * @return array<string, string>
     */
    public function clinicContact(): array
    {
        $out = [];
        try {
            $rows = $this->pdo()->query("SELECT setting_key, setting_value FROM clinic_settings WHERE setting_key IN ('clinic_name','clinic_phone','clinic_email','clinic_address')")->fetchAll(PDO::FETCH_ASSOC);
            $map = ['clinic_name' => 'name', 'clinic_phone' => 'phone', 'clinic_email' => 'email', 'clinic_address' => 'address'];
            foreach ($rows as $r) {
                $out[$map[$r['setting_key']]] = (string) $r['setting_value'];
            }
        } catch (\Throwable) {
            // clinic_settings is optional for rendering
        }
        return $out;
    }
}