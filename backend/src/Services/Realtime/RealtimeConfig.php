<?php

declare(strict_types=1);

namespace App\Services\Realtime;

/**
 * Configuration loader and validator for Phase 14 Real-Time Notifications.
 * Reads from $_ENV / $_SERVER / getenv() without hardcoding production secrets.
 */
class RealtimeConfig
{
    public readonly bool $enabled;
    public readonly string $internalUrl;
    public readonly string $internalSecret;
    public readonly int $ticketTtlSeconds;
    public readonly float $publishTimeoutSeconds;
    public readonly int $replayWindowSeconds;
    public readonly int $workerBatchSize;
    public readonly int $workerMaxAttempts;
    public readonly int $workerPollIntervalMs;
    public readonly int $workerStaleLockSeconds;
    public readonly string $socketPath;

    /** @var list<string> */
    public readonly array $errors;

    public function __construct(
        bool $enabled,
        string $internalUrl,
        string $internalSecret,
        int $ticketTtlSeconds,
        float $publishTimeoutSeconds,
        int $replayWindowSeconds,
        int $workerBatchSize,
        int $workerMaxAttempts,
        int $workerPollIntervalMs,
        int $workerStaleLockSeconds,
        string $socketPath,
        array $errors = []
    ) {
        $this->enabled = $enabled;
        $this->internalUrl = rtrim($internalUrl, '/');
        $this->internalSecret = $internalSecret;
        $this->ticketTtlSeconds = $ticketTtlSeconds;
        $this->publishTimeoutSeconds = $publishTimeoutSeconds;
        $this->replayWindowSeconds = $replayWindowSeconds;
        $this->workerBatchSize = $workerBatchSize;
        $this->workerMaxAttempts = $workerMaxAttempts;
        $this->workerPollIntervalMs = $workerPollIntervalMs;
        $this->workerStaleLockSeconds = $workerStaleLockSeconds;
        $this->socketPath = $socketPath;
        $this->errors = $errors;
    }

    public static function fromEnvironment(): self
    {
        $enabled = self::parseBool(self::env('REALTIME_ENABLED', 'true'));
        $internalUrl = trim((string) self::env('REALTIME_INTERNAL_URL', 'http://realtime:4000'));
        $internalSecret = trim((string) self::env('REALTIME_INTERNAL_SECRET', ''));
        $ticketTtl = max(15, min(300, (int) self::env('REALTIME_TICKET_TTL_SECONDS', '60')));
        $publishTimeout = max(0.5, min(15.0, (float) self::env('REALTIME_PUBLISH_TIMEOUT_SECONDS', '2.0')));
        $replayWindow = max(30, min(600, (int) self::env('REALTIME_REPLAY_WINDOW_SECONDS', '300')));
        $batchSize = max(1, min(100, (int) self::env('REALTIME_WORKER_BATCH_SIZE', '25')));
        $maxAttempts = max(1, min(20, (int) self::env('REALTIME_WORKER_MAX_ATTEMPTS', '5')));
        $pollIntervalMs = max(250, min(30000, (int) self::env('REALTIME_WORKER_POLL_INTERVAL_MS', '1500')));
        $staleLockSeconds = max(30, min(3600, (int) self::env('REALTIME_WORKER_STALE_LOCK_SECONDS', '120')));
        $socketPath = '/' . trim((string) self::env('REALTIME_SOCKET_PATH', '/socket.io/'), '/') . '/';

        $errors = [];
        $appEnv = strtolower((string) self::env('APP_ENV', 'development'));
        if ($enabled && $internalUrl === '') {
            $errors[] = 'REALTIME_INTERNAL_URL must be configured when REALTIME_ENABLED=true.';
        }
        if ($enabled && $appEnv === 'production' && strlen($internalSecret) < 32) {
            $errors[] = 'REALTIME_INTERNAL_SECRET must be at least 32 characters in production.';
        }

        return new self(
            $enabled,
            $internalUrl,
            $internalSecret,
            $ticketTtl,
            $publishTimeout,
            $replayWindow,
            $batchSize,
            $maxAttempts,
            $pollIntervalMs,
            $staleLockSeconds,
            $socketPath,
            $errors
        );
    }

    public function isValid(): bool
    {
        return $this->errors === [];
    }

    public function hasSecret(): bool
    {
        return $this->internalSecret !== '';
    }

    private static function env(string $key, string $default = ''): string
    {
        $val = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);
        if ($val === false || $val === null || $val === '') {
            return $default;
        }
        return (string) $val;
    }

    private static function parseBool(string $val): bool
    {
        return in_array(strtolower(trim($val)), ['1', 'true', 'yes', 'on'], true);
    }
}
