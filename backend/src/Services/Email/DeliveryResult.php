<?php
declare(strict_types=1);
namespace App\Services\Email;
/**
 * Safe outcome of a send attempt. Contains no SMTP internals or credentials.
 */
final class DeliveryResult
{
    public const CATEGORY_NONE = 'NONE';
    public const CATEGORY_TEMPORARY = 'TEMPORARY';
    public const CATEGORY_PERMANENT = 'PERMANENT';
    public const CATEGORY_UNKNOWN = 'UNKNOWN';
    private function __construct(
        public readonly bool $success,
        public readonly string $category,
        public readonly string $errorCode,
        public readonly string $message
    ) {
    }
    public static function sent(): self
    {
        return new self(true, self::CATEGORY_NONE, '', 'Delivered to SMTP server.');
    }
    public static function failed(string $category, string $errorCode, string $message): self
    {
        return new self(false, $category, $errorCode, $message);
    }
}