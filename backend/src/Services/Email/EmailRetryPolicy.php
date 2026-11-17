<?php
declare(strict_types=1);
namespace App\Services\Email;
/**
 * Failure classification and exponential backoff for outbox delivery.
 *
 * Attempt semantics: `attempts` counts CLAIMED delivery attempts. The counter is incremented
 * when a worker claims a job, so a worker crash after claiming still consumes an attempt and
 * retries are always bounded.
 */
final class EmailRetryPolicy
{
    /** Default delays in seconds after attempt 1..5: 1m, 5m, 15m, 1h, 6h. */
    public const DEFAULT_DELAYS = [60, 300, 900, 3600, 21600];
    /**
     * @param list<int> $delays seconds to wait after attempt N (index N-1); last value repeats
     */
    public function __construct(
        private readonly array $delays = self::DEFAULT_DELAYS,
        private readonly float $jitterRatio = 0.1
    ) {
    }
    /**
     * Build from a comma-separated list such as "60,300,900". Invalid input falls back to defaults.
     */
    public static function fromString(?string $csv, float $jitterRatio = 0.1): self
    {
        if ($csv === null || trim($csv) === '') {
            return new self(self::DEFAULT_DELAYS, $jitterRatio);
        }
        $delays = [];
        foreach (explode(',', $csv) as $part) {
            $part = trim($part);
            if ($part === '' || !ctype_digit($part) || (int) $part < 1 || (int) $part > 604800) {
                return new self(self::DEFAULT_DELAYS, $jitterRatio);
            }
            $delays[] = (int) $part;
        }
        return new self($delays, max(0.0, min(0.5, $jitterRatio)));
    }
    public static function isValidList(string $csv): bool
    {
        foreach (explode(',', $csv) as $part) {
            $part = trim($part);
            if ($part === '' || !ctype_digit($part) || (int) $part < 1 || (int) $part > 604800) {
                return false;
            }
        }
        return true;
    }

    /**
     * Seconds to wait before the next attempt, given how many attempts have been made.
     *
     * @param (callable(): float)|null $random returns a value in [0,1); injectable for tests
     */
    public function delayAfterAttempt(int $attemptsMade, ?callable $random = null): int
    {
        $index = max(0, min($attemptsMade - 1, count($this->delays) - 1));
        $base = $this->delays[$index];
        if ($this->jitterRatio <= 0.0) {
            return $base;
        }
        $r = $random !== null ? $random() : (mt_rand() / (mt_getrandmax() + 1));
        $factor = 1.0 + (($r * 2.0) - 1.0) * $this->jitterRatio;
        return max(1, (int) round($base * $factor));
    }
    public function isExhausted(int $attemptsMade, int $maxAttempts): bool
    {
        return $attemptsMade >= $maxAttempts;
    }
    /**
     * Classify a failure.
     *
     * Rules:
     *  - SMTP 4xx, connection, timeout, authentication: TEMPORARY (retry with backoff).
     *    Authentication failures are operator-fixable, so the job is retried, not discarded.
     *  - SMTP 5xx and rejected recipients: PERMANENT.
     *  - Anything unrecognized: UNKNOWN. Unknown failures are retried (bounded by max attempts)
     *    so a potentially temporary failure is not discarded without an operational reason.
     *
     * @return array{category: string, code: string}
     */
    public function classify(\Throwable $e): array
    {
        if ($e instanceof OutboxJobException) {
            return ['category' => DeliveryResult::CATEGORY_PERMANENT, 'code' => $e->errorCode];
        }
        if ($e instanceof MailTransportException) {
            $code = $e->smtpCode;
            if ($code !== null && $code >= 400 && $code < 500) {
                return ['category' => DeliveryResult::CATEGORY_TEMPORARY, 'code' => 'SMTP_' . $code];
            }
            if ($e->reason === MailTransportException::REASON_RECIPIENT) {
                return ['category' => DeliveryResult::CATEGORY_PERMANENT, 'code' => 'INVALID_RECIPIENT'];
            }
            if ($e->reason === MailTransportException::REASON_AUTH) {
                return ['category' => DeliveryResult::CATEGORY_TEMPORARY, 'code' => 'SMTP_AUTH_FAILED'];
            }
            if ($code !== null && $code >= 500 && $code < 600) {
                return ['category' => DeliveryResult::CATEGORY_PERMANENT, 'code' => 'SMTP_' . $code];
            }
            return match ($e->reason) {
                MailTransportException::REASON_CONNECTION => ['category' => DeliveryResult::CATEGORY_TEMPORARY, 'code' => 'SMTP_CONNECTION_FAILED'],
                MailTransportException::REASON_TIMEOUT => ['category' => DeliveryResult::CATEGORY_TEMPORARY, 'code' => 'SMTP_TIMEOUT'],
                MailTransportException::REASON_CONFIG => ['category' => DeliveryResult::CATEGORY_PERMANENT, 'code' => 'MAIL_CONFIG_INVALID'],
                default => ['category' => DeliveryResult::CATEGORY_UNKNOWN, 'code' => 'SMTP_UNKNOWN'],
            };
        }
        return ['category' => DeliveryResult::CATEGORY_UNKNOWN, 'code' => 'UNEXPECTED_ERROR'];
    }
}