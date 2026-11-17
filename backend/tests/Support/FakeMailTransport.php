<?php
declare(strict_types=1);
namespace Tests\Support;
use App\Services\Email\EmailMessage;
use App\Services\Email\MailTransportException;
use App\Services\Email\MailTransportInterface;
/**
 * In-memory transport. Never touches the network, so tests cannot send real email.
 */
final class FakeMailTransport implements MailTransportInterface
{
    /** @var list<EmailMessage> */
    public array $sent = [];
    /** @var list<\Throwable|null> queued outcomes; null means success. Empty queue means success. */
    private array $script = [];
    public int $calls = 0;
    public function failNext(\Throwable ...$errors): void
    {
        foreach ($errors as $e) {
            $this->script[] = $e;
        }
    }
    public function failAlways(\Throwable $error): void
    {
        $this->script = array_fill(0, 50, $error);
    }
    public function deliver(EmailMessage $message): void
    {
        $this->calls++;
        $next = array_shift($this->script);
        if ($next instanceof \Throwable) {
            throw $next;
        }
        $this->sent[] = $message;
    }
    public static function timeout(): MailTransportException
    {
        return new MailTransportException('SMTP delivery failed (timeout).', MailTransportException::REASON_TIMEOUT);
    }
    public static function refused(): MailTransportException
    {
        return new MailTransportException('SMTP delivery failed (connection).', MailTransportException::REASON_CONNECTION);
    }
    public static function tempReject(): MailTransportException
    {
        return new MailTransportException('SMTP delivery failed (protocol, code 451).', MailTransportException::REASON_PROTOCOL, 451);
    }
    public static function badRecipient(): MailTransportException
    {
        return new MailTransportException('SMTP delivery failed (recipient, code 550).', MailTransportException::REASON_RECIPIENT, 550);
    }
}