<?php
declare(strict_types=1);
namespace App\Services\Email;
use RuntimeException;
/**
 * A job that can never succeed as stored (bad template, bad payload, bad recipient).
 * Always classified PERMANENT. The message must be safe to persist and display.
 */
final class OutboxJobException extends RuntimeException
{
    public function __construct(public readonly string $errorCode, string $message)
    {
        parent::__construct($message);
    }
}