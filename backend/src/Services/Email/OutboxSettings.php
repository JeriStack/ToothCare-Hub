<?php
declare(strict_types=1);
namespace App\Services\Email;
/**
 * Validated outbox and worker settings (EMAIL_WORKER_* and EMAIL_RETRY_*).
 * Bounds prevent runaway database load from a bad configuration.
 */
final class OutboxSettings
{
    /** @param list<string> $errors */
    private function __construct(
        public readonly bool $workerEnabled,
        public readonly int $batchSize,
        public readonly int $maxAttempts,
        public readonly int $lockTimeoutSeconds,
        public readonly int $sleepSeconds,
        public readonly int $reminderLeadHoursDefault,
        public readonly EmailRetryPolicy $retryPolicy,
        public readonly array $errors
    ) {
    }
    public static function fromEnvironment(): self
    {
        $keys = ['EMAIL_WORKER_ENABLED', 'EMAIL_WORKER_BATCH_SIZE', 'EMAIL_WORKER_MAX_ATTEMPTS', 'EMAIL_WORKER_LOCK_TIMEOUT',
            'EMAIL_WORKER_SLEEP_SECONDS', 'EMAIL_RETRY_DELAYS', 'EMAIL_RETRY_JITTER', 'EMAIL_REMINDER_LEAD_HOURS'];
        $env = [];
        foreach ($keys as $k) {
            $v = $_ENV[$k] ?? $_SERVER[$k] ?? getenv($k);
            if ($v !== false && $v !== null && $v !== '') {
                $env[$k] = (string) $v;
            }
        }
        return self::fromArray($env);
    }
    /** @param array<string, string> $env */
    public static function fromArray(array $env): self
    {
        $errors = [];
        $int = static function (string $key, int $default, int $min, int $max) use ($env, &$errors): int {
            if (!isset($env[$key])) {
                return $default;
            }
            if (!preg_match('/^-?\d+$/', trim($env[$key]))) {
                $errors[] = "{$key} must be an integer.";
                return $default;
            }
            $v = (int) $env[$key];
            if ($v < $min || $v > $max) {
                $errors[] = "{$key} must be between {$min} and {$max}.";
                return $default;
            }
            return $v;
        };
        $enabled = !isset($env['EMAIL_WORKER_ENABLED'])
            || in_array(strtolower(trim($env['EMAIL_WORKER_ENABLED'])), ['1', 'true', 'yes', 'on'], true);
        $jitter = 0.1;
        if (isset($env['EMAIL_RETRY_JITTER'])) {
            if (is_numeric($env['EMAIL_RETRY_JITTER']) && (float) $env['EMAIL_RETRY_JITTER'] >= 0.0 && (float) $env['EMAIL_RETRY_JITTER'] <= 0.5) {
                $jitter = (float) $env['EMAIL_RETRY_JITTER'];
            } else {
                $errors[] = 'EMAIL_RETRY_JITTER must be between 0 and 0.5.';
            }
        }
        $delays = $env['EMAIL_RETRY_DELAYS'] ?? null;
        if ($delays !== null && !EmailRetryPolicy::isValidList($delays)) {
            $errors[] = 'EMAIL_RETRY_DELAYS must be a comma-separated list of positive seconds (max 604800).';
        }
        return new self(
            $enabled,
            $int('EMAIL_WORKER_BATCH_SIZE', 20, 1, 200),
            $int('EMAIL_WORKER_MAX_ATTEMPTS', 5, 1, 20),
            $int('EMAIL_WORKER_LOCK_TIMEOUT', 300, 60, 3600),
            $int('EMAIL_WORKER_SLEEP_SECONDS', 5, 1, 300),
            $int('EMAIL_REMINDER_LEAD_HOURS', 24, 1, 168),
            EmailRetryPolicy::fromString($delays, $jitter),
            $errors
        );
    }
    public function isValid(): bool
    {
        return $this->errors === [];
    }
}