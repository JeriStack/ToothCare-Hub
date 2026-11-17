<?php
declare(strict_types=1);
namespace App\Services\Email;
/**
 * A fully rendered message ready for a transport. Held in memory only; never logged.
 */
final class EmailMessage
{
    public function __construct(
        public readonly string $toEmail,
        public readonly string $toName,
        public readonly string $subject,
        public readonly string $htmlBody,
        public readonly string $textBody
    ) {
    }
}