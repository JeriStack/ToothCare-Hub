<?php

declare(strict_types=1);

namespace App\Services\Realtime;

use App\Core\Database;
use App\Core\Logger;
use App\Repositories\RealtimeOutboxRepository;
use PDO;
use Throwable;

/**
 * Transactional Outbox orchestrator for Phase 14 Real-Time Notifications.
 *
 * Guarantees:
 * - Events are enqueued INSIDE the caller's MySQL transaction (never published before commit).
 * - Payloads strictly conform to the minimal safe event contract (no PII / clinical notes).
 * - At-least-once delivery with exponential backoff, stale lock recovery, and idempotent event IDs.
 * - Real-time outages NEVER fail or roll back committed appointment operations.
 */
class RealtimeOutboxService
{
    public const EVENT_VERSION = '1.0';

    public const EVENT_APPOINTMENT_REQUESTED = 'appointment.requested';
    public const EVENT_APPOINTMENT_CONFIRMED = 'appointment.confirmed';
    public const EVENT_APPOINTMENT_REJECTED = 'appointment.rejected';
    public const EVENT_APPOINTMENT_CANCELLED = 'appointment.cancelled';
    public const EVENT_APPOINTMENT_RESCHEDULED = 'appointment.rescheduled';
    public const EVENT_APPOINTMENT_UPDATED = 'appointment.updated';
    public const EVENT_SCHEDULE_UPDATED = 'schedule.updated';
    public const EVENT_SERVICE_UPDATED = 'service.updated';
    public const EVENT_ACCOUNT_CREATED = 'account.created';
    public const EVENT_ACCOUNT_UPDATED = 'account.updated';
    public const EVENT_NOTIFICATION_CREATED = 'notification.created';
    public const EVENT_MESSAGE_CREATED = 'message.created';
    public const EVENT_MESSAGE_DELIVERED = 'message.delivered';
    public const EVENT_MESSAGE_READ = 'message.read';
    public const EVENT_MESSAGE_TYPING = 'message.typing';

    /** @var list<string> */
    public const ALLOWED_EVENTS = [
        self::EVENT_APPOINTMENT_REQUESTED,
        self::EVENT_APPOINTMENT_CONFIRMED,
        self::EVENT_APPOINTMENT_REJECTED,
        self::EVENT_APPOINTMENT_CANCELLED,
        self::EVENT_APPOINTMENT_RESCHEDULED,
        self::EVENT_APPOINTMENT_UPDATED,
        self::EVENT_SCHEDULE_UPDATED,
        self::EVENT_SERVICE_UPDATED,
        self::EVENT_ACCOUNT_CREATED,
        self::EVENT_ACCOUNT_UPDATED,
        self::EVENT_NOTIFICATION_CREATED,
        self::EVENT_MESSAGE_CREATED,
        self::EVENT_MESSAGE_DELIVERED,
        self::EVENT_MESSAGE_READ,
        self::EVENT_MESSAGE_TYPING,
    ];

    /** @var list<string> Backoff delays in seconds after attempt 1, 2, 3, 4... */
    private const RETRY_DELAYS_SECONDS = [5, 15, 60, 300, 900];

    private RealtimeOutboxRepository $repo;
    private RealtimePublisherClient $publisher;
    private RealtimeConfig $config;
    private Logger $logger;

    public function __construct(
        ?RealtimeOutboxRepository $repo = null,
        ?RealtimePublisherClient $publisher = null,
        ?RealtimeConfig $config = null,
        ?Logger $logger = null,
        ?Database $database = null
    ) {
        $db = $database ?? Database::getInstance();
        $this->config = $config ?? RealtimeConfig::fromEnvironment();
        $this->repo = $repo ?? new RealtimeOutboxRepository($db);
        $this->logger = $logger ?? Logger::getInstance();
        $this->publisher = $publisher ?? new RealtimePublisherClient($this->config, null, $this->logger);
    }

    /**
     * Enqueue a real-time notification event inside an active database transaction.
     * Strictly filters payload fields to the approved minimal contract.
     *
     * @param array<string, mixed> $metadata Allowed keys: appointmentId, status, title, notificationType, occurredAt, eventId
     */
    public function enqueue(
        string $eventType,
        int $recipientUserId,
        ?int $notificationId,
        array $metadata = [],
        ?PDO $pdo = null
    ): int {
        if (!in_array($eventType, self::ALLOWED_EVENTS, true)) {
            throw new \InvalidArgumentException("Disallowed realtime event type: {$eventType}");
        }

        if ($recipientUserId <= 0) {
            throw new \InvalidArgumentException('Recipient user ID must be positive.');
        }

        $eventId = isset($metadata['eventId']) && is_string($metadata['eventId']) && $metadata['eventId'] !== ''
            ? $metadata['eventId']
            : self::generateEventId();

        $occurredAt = isset($metadata['occurredAt']) && is_string($metadata['occurredAt'])
            ? $metadata['occurredAt']
            : gmdate('Y-m-d\TH:i:s\Z');

        // Strictly minimal, versioned, non-clinical, non-PII payload contract
        $appointmentId = isset($metadata['appointmentId']) ? (int) $metadata['appointmentId'] : null;
        $conversationId = isset($metadata['conversationId']) && (int) $metadata['conversationId'] > 0
            ? (int) $metadata['conversationId']
            : null;
        $entityType = isset($metadata['entityType']) && is_string($metadata['entityType']) && $metadata['entityType'] !== ''
            ? strtolower(trim($metadata['entityType']))
            : ($conversationId !== null ? 'messages' : ($appointmentId !== null ? 'appointments' : 'notifications'));
        $entityId = isset($metadata['entityId'])
            ? (int) $metadata['entityId']
            : ($appointmentId ?? $conversationId ?? $notificationId);

        $payload = [
            'eventId' => $eventId,
            'eventType' => $eventType,
            'eventVersion' => self::EVENT_VERSION,
            'notificationId' => $notificationId,
            'appointmentId' => $appointmentId,
            'conversationId' => $conversationId,
            'entityType' => $entityType,
            'entityId' => $entityId,
            'status' => isset($metadata['status']) ? strtolower((string) $metadata['status']) : null,
            'occurredAt' => $occurredAt,
        ];

        return $this->repo->insert([
            'event_id' => $eventId,
            'event_type' => $eventType,
            'notification_id' => $notificationId,
            'recipient_user_id' => $recipientUserId,
            'payload' => $payload,
            'status' => RealtimeOutboxRepository::STATUS_PENDING,
            'attempt_count' => 0,
            'max_attempts' => $this->config->workerMaxAttempts,
            'available_at' => date('Y-m-d H:i:s'),
        ], $pdo);
    }

    /**
     * Claim and publish a batch of due outbox records to the Node.js Socket.IO service.
     *
     * @return array{claimed: int, published: int, retried: int, failed_permanent: int, recovered: int}
     */
    public function processPendingBatch(?string $workerId = null, ?int $limit = null, ?int $now = null): array
    {
        $currentTs = $now ?? time();
        $nowStr = date('Y-m-d H:i:s', $currentTs);
        $staleBefore = date('Y-m-d H:i:s', $currentTs - $this->config->workerStaleLockSeconds);

        $recovered = $this->repo->recoverStaleLocks($staleBefore, $nowStr);
        $wId = $workerId ?? ('rt-worker-' . getmypid());
        $batchSize = $limit ?? $this->config->workerBatchSize;

        $rows = $this->repo->claimDueBatch($wId, $batchSize, $nowStr);
        $published = 0;
        $retried = 0;
        $failedPermanent = 0;

        foreach ($rows as $row) {
            $id = (int) $row['id'];
            $attempts = (int) $row['attempt_count'];
            $maxAttempts = (int) $row['max_attempts'];
            $payload = json_decode((string) $row['payload'], true);

            if (!is_array($payload)) {
                $this->repo->markPermanentFailure($id, 'Corrupt JSON payload in realtime_outbox');
                $failedPermanent++;
                continue;
            }

            $envelope = [
                'eventId' => (string) $row['event_id'],
                'eventType' => (string) $row['event_type'],
                'recipientUserId' => (int) $row['recipient_user_id'],
                'payload' => $payload,
            ];

            $result = $this->publisher->publishEvent($envelope);

            if ($result['ok']) {
                $this->repo->markPublished($id, date('Y-m-d H:i:s', $currentTs));
                $published++;
                continue;
            }

            $status = (int) $result['status'];
            $errorMsg = (string) ($result['error'] ?? 'Unknown publish failure');

            // 4xx validation/auth errors except 429 are non-retryable after max or immediately if 400/422
            $isNonRetryableClientError = in_array($status, [400, 422], true);

            if ($isNonRetryableClientError || $attempts >= $maxAttempts) {
                $this->repo->markPermanentFailure($id, $errorMsg);
                $failedPermanent++;
            } else {
                $delayIndex = min(count(self::RETRY_DELAYS_SECONDS) - 1, max(0, $attempts - 1));
                $delay = self::RETRY_DELAYS_SECONDS[$delayIndex];
                $nextAt = date('Y-m-d H:i:s', $currentTs + $delay);
                $this->repo->markRetryableFailure($id, $nextAt, $errorMsg);
                $retried++;
            }
        }

        return [
            'claimed' => count($rows),
            'published' => $published,
            'retried' => $retried,
            'failed_permanent' => $failedPermanent,
            'recovered' => $recovered,
        ];
    }

    /**
     * Best-effort post-commit immediate dispatch.
     * Never throws; if Node.js is down, the outbox record stays queued for realtime-worker.php.
     */
    public function dispatchPendingBestEffort(int $limit = 10): void
    {
        if (!$this->config->enabled || !$this->config->hasSecret()) {
            return;
        }

        try {
            $this->processPendingBatch('api-post-commit', $limit);
        } catch (Throwable $e) {
            $this->logger->warning('Best-effort realtime dispatch skipped; worker will retry', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Best-effort ephemeral real-time event dispatch (used for transient typing signals).
     * Never persists to realtime_outbox and never throws.
     *
     * @param array<string, mixed> $metadata
     */
    public function publishEphemeralBestEffort(string $eventType, int $recipientUserId, array $metadata = []): void
    {
        if (!$this->config->enabled || !$this->config->hasSecret() || $recipientUserId <= 0) {
            return;
        }

        if (!in_array($eventType, self::ALLOWED_EVENTS, true)) {
            return;
        }

        $eventId = self::generateEventId();
        $occurredAt = gmdate('Y-m-d\TH:i:s\Z');
        $conversationId = isset($metadata['conversationId']) && (int) $metadata['conversationId'] > 0
            ? (int) $metadata['conversationId']
            : null;

        $envelope = [
            'eventId' => $eventId,
            'eventType' => $eventType,
            'recipientUserId' => $recipientUserId,
            'payload' => [
                'eventId' => $eventId,
                'eventType' => $eventType,
                'eventVersion' => self::EVENT_VERSION,
                'notificationId' => null,
                'appointmentId' => null,
                'conversationId' => $conversationId,
                'entityType' => 'messages',
                'entityId' => $conversationId,
                'status' => isset($metadata['status']) ? strtolower((string) $metadata['status']) : null,
                'occurredAt' => $occurredAt,
            ],
        ];

        try {
            $this->publisher->publishEvent($envelope);
        } catch (Throwable $e) {
            $this->logger->debug('Ephemeral realtime dispatch skipped', [
                'eventType' => $eventType,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Query online presence for a bounded list of user IDs from the realtime server.
     *
     * @param list<int> $userIds
     * @return list<int>
     */
    public function queryOnlineUserIds(array $userIds): array
    {
        if (!$this->config->enabled || !$this->config->hasSecret() || empty($userIds)) {
            return [];
        }

        $clean = array_values(array_unique(array_filter(array_map('intval', $userIds), static fn (int $id): bool => $id > 0)));
        if (empty($clean)) {
            return [];
        }

        try {
            return $this->publisher->queryPresence($clean);
        } catch (Throwable $e) {
            return [];
        }
    }

    /**
     * Best-effort revocation broadcast to Node.js on logout, deactivation, or role/permission updates.
     */
    public function notifyRevocationBestEffort(array $payload): void
    {
        if (!$this->config->enabled || !$this->config->hasSecret()) {
            return;
        }

        try {
            $this->publisher->revokeAuthorization($payload);
        } catch (Throwable $e) {
            $this->logger->warning('Best-effort realtime revocation notification failed', [
                'reason' => $payload['reason'] ?? 'unknown',
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function getStats(): array
    {
        return $this->repo->stats();
    }

    public static function generateEventId(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
