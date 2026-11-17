<?php
declare(strict_types=1);
namespace App\Services\Email;
use PHPMailer\PHPMailer\PHPMailer;
/**
 * Creates configured PHPMailer instances. The only place PHPMailer is constructed.
 */
final class MailerFactory
{
    public function __construct(private readonly MailConfig $config)
    {
    }
    public function config(): MailConfig
    {
        return $this->config;
    }
    /**
     * @throws MailTransportException when mail is disabled or misconfigured
     */
    public function create(): PHPMailer
    {
        if (!$this->config->isOperational()) {
            throw new MailTransportException('Mail is disabled or misconfigured.', MailTransportException::REASON_CONFIG);
        }
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = $this->config->host;
        $mail->Port = $this->config->port;
        $mail->Timeout = $this->config->timeout;
        $mail->CharSet = PHPMailer::CHARSET_UTF8;
        $mail->Encoding = PHPMailer::ENCODING_BASE64;
        $mail->SMTPKeepAlive = false;
        $mail->SMTPDebug = 0;
        if ($this->config->hasCredentials()) {
            $mail->SMTPAuth = true;
            $mail->Username = $this->config->username;
            $mail->Password = $this->config->password();
        } else {
            $mail->SMTPAuth = false;
        }
        switch ($this->config->encryption) {
            case MailConfig::ENCRYPTION_TLS:
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
                $mail->SMTPAutoTLS = true;
                break;
            case MailConfig::ENCRYPTION_SSL:
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
                break;
            default:
                $mail->SMTPSecure = '';
                $mail->SMTPAutoTLS = false;
        }
        if (!$this->config->verifyPeer) {
            // Explicit opt-out for local development only. Rejected by MailConfig in production.
            $mail->SMTPOptions = ['ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true,
            ]];
        }
        $mail->setFrom($this->config->fromAddress, $this->config->fromName);
        if ($this->config->replyToAddress !== '') {
            $mail->addReplyTo($this->config->replyToAddress, $this->config->fromName);
        }
        return $mail;
    }
}