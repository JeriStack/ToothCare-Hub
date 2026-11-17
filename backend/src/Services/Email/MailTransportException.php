<?php
declare(strict_types=1);
namespace App\Services\Email;
use RuntimeException;
/**
 * Raised by a transport when delivery fails. Carries structured hints used for classification
 * so callers never need to parse free-form (and possibly sensitive) server text.
 */
final class MailTransportException extends RuntimeException
{
    public const REASON_CONNECTION = 'connection';
    public const REASON_TIMEOUT = 'timeout';
    public const REASON_AUTH = 'auth';
    public const REASON_RECIPIENT = 'recipient';
    public const REASON_PROTOCOL = 'protocol';
    public const REASON_CONFIG = 'config';
    public const REASON_UNKNOWN = 'unknown';
    public function __construct(
        string $message,
        public readonly string $reason = self::REASON_UNKNOWN,
        public readonly ?int $smtpCode = null,
        ?\Throwable $previous = null
    ) {
        parent::__construct($message, 0, $previous);
    }
}