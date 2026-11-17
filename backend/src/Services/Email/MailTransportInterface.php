<?php
declare(strict_types=1);
namespace App\Services\Email;
/**
 * Delivery transport abstraction. The production implementation uses PHPMailer;
 * tests inject an in-memory fake so no real email is ever sent.
 */
interface MailTransportInterface
{
    /**
     * @throws MailTransportException when the message could not be delivered
     */
    public function deliver(EmailMessage $message): void;
}