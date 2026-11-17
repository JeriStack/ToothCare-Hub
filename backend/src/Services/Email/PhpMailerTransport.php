<?php
declare(strict_types=1);
namespace App\Services\Email;
use PHPMailer\PHPMailer\Exception as PhpMailerException;
/**
 * Production transport. Translates PHPMailer failures into sanitized MailTransportException
 * values (no host names, credentials, or server banners are carried).
 */
final class PhpMailerTransport implements MailTransportInterface
{
    public function __construct(private readonly MailerFactory $factory)
    {
    }
    public function deliver(EmailMessage $message): void
    {
        $mail = $this->factory->create();
        try {
            $mail->addAddress($message->toEmail, $message->toName);
            $mail->isHTML(true);
            $mail->Subject = $message->subject;
            $mail->Body = $message->htmlBody;
            $mail->AltBody = $message->textBody;
            $mail->send();
        } catch (PhpMailerException $e) {
            throw $this->translate($e->getMessage(), $this->smtpCode($mail));
        } finally {
            try {
                $mail->smtpClose();
            } catch (\Throwable) {
                // ignore close errors
            }
        }
    }
    private function smtpCode(\PHPMailer\PHPMailer\PHPMailer $mail): ?int
    {
        try {
            $err = $mail->getSMTPInstance()->getError();
            $code = $err['smtp_code'] ?? '';
            return ctype_digit((string) $code) && $code !== '' ? (int) $code : null;
        } catch (\Throwable) {
            return null;
        }
    }
    private function translate(string $raw, ?int $smtpCode): MailTransportException
    {
        $m = strtolower($raw);
        if ($smtpCode === null && preg_match('/\b([45]\d{2})\b/', $raw, $hit) === 1) {
            $smtpCode = (int) $hit[1];
        }
        $reason = MailTransportException::REASON_UNKNOWN;
        if (str_contains($m, 'invalid address') || str_contains($m, 'recipients failed') || str_contains($m, 'you must provide at least one recipient')) {
            $reason = MailTransportException::REASON_RECIPIENT;
        } elseif (str_contains($m, 'authenticate') || str_contains($m, 'auth')) {
            $reason = MailTransportException::REASON_AUTH;
        } elseif (str_contains($m, 'timed out') || str_contains($m, 'timeout')) {
            $reason = MailTransportException::REASON_TIMEOUT;
        } elseif (str_contains($m, 'connect') || str_contains($m, 'network') || str_contains($m, 'dns')) {
            $reason = MailTransportException::REASON_CONNECTION;
        } elseif ($smtpCode !== null) {
            $reason = MailTransportException::REASON_PROTOCOL;
        }
        $safe = 'SMTP delivery failed (' . $reason . ($smtpCode !== null ? ', code ' . $smtpCode : '') . ').';
        return new MailTransportException($safe, $reason, $smtpCode);
    }
}