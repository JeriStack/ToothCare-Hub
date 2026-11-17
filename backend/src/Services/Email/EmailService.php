<?php
declare(strict_types=1);
namespace App\Services\Email;
/**
 * Sends one prepared message through the configured transport and returns a safe result.
 * Never opens or controls a database transaction; it is only called by the outbox worker.
 */
final class EmailService
{
    public function __construct(
        private readonly MailTransportInterface $transport,
        private readonly MailConfig $config,
        private readonly EmailRetryPolicy $retryPolicy
    ) {
    }
    public function isOperational(): bool
    {
        return $this->config->isOperational();
    }
    public function send(EmailMessage $message): DeliveryResult
    {
        if (!$this->config->isOperational()) {
            return DeliveryResult::failed(DeliveryResult::CATEGORY_TEMPORARY, 'MAIL_NOT_OPERATIONAL', 'Mail is disabled or misconfigured.');
        }
        if (!self::isDeliverableAddress($message->toEmail)) {
            return DeliveryResult::failed(DeliveryResult::CATEGORY_PERMANENT, 'INVALID_RECIPIENT', 'Recipient address is invalid.');
        }
        if (self::hasHeaderInjection($message->subject) || self::hasHeaderInjection($message->toName)) {
            return DeliveryResult::failed(DeliveryResult::CATEGORY_PERMANENT, 'INVALID_HEADER', 'Message headers contain illegal characters.');
        }
        try {
            $this->transport->deliver($message);
            return DeliveryResult::sent();
        } catch (\Throwable $e) {
            $c = $this->retryPolicy->classify($e);
            $safe = $e instanceof MailTransportException ? $e->getMessage() : 'Unexpected error while sending email.';
            return DeliveryResult::failed($c['category'], $c['code'], $safe);
        }
    }
    public static function isDeliverableAddress(string $email): bool
    {
        return strlen($email) <= 254
            && !self::hasHeaderInjection($email)
            && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }
    private static function hasHeaderInjection(string $value): bool
    {
        return preg_match('/[\r\n\0]/', $value) === 1;
    }
}