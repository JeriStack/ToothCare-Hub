<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Config;
use App\Core\Database;
use App\Core\Logger;
use PDO;

/**
 * Transactional Email Notification Service
 * Queues emails into email_outbox for asynchronous, reliable background delivery.
 */
class EmailService
{
    private Database $database;
    private Config $config;
    private Logger $logger;

    public function __construct(?Database $database = null, ?Config $config = null, ?Logger $logger = null)
    {
        $this->database = $database ?? Database::getInstance();
        $this->config = $config ?? Config::getInstance();
        $this->logger = $logger ?? Logger::getInstance();
    }

    public function sendVerificationEmail(string $recipientEmail, string $token, string $recipientName, ?int $userId = null): bool
    {
        $baseUrl = $this->config->getString('app_url', 'http://localhost:8080');
        $verifyUrl = "{$baseUrl}/verify-email?token=" . urlencode($token);

        $subject = 'ToothCare Hub — Please Verify Your Email Address';
        $bodyHtml = "
            <h2>Welcome to ToothCare Hub, " . htmlspecialchars($recipientName) . "!</h2>
            <p>Thank you for creating an account with our dental clinic. Please verify your email address to activate all account features:</p>
            <p><a href=\"{$verifyUrl}\" style=\"background:#0d9488;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;\">Verify Email Address</a></p>
            <p>Or paste this link into your browser:</p>
            <p><code>{$verifyUrl}</code></p>
            <p>This verification link will expire in 24 hours.</p>
        ";
        $bodyText = "Welcome to ToothCare Hub, {$recipientName}!\n\nPlease verify your email by visiting: {$verifyUrl}\n\nThis link will expire in 24 hours.";

        return $this->enqueueEmail($recipientEmail, $recipientName, $subject, $bodyHtml, $bodyText, $userId);
    }

    public function sendPasswordResetEmail(string $recipientEmail, string $token, string $recipientName, ?int $userId = null): bool
    {
        $baseUrl = $this->config->getString('app_url', 'http://localhost:8080');
        $resetUrl = "{$baseUrl}/reset-password?token=" . urlencode($token);

        $subject = 'ToothCare Hub — Password Reset Request';
        $bodyHtml = "
            <h2>Password Reset Request</h2>
            <p>Hello " . htmlspecialchars($recipientName) . ",</p>
            <p>We received a request to reset your password for your ToothCare Hub account. Click the button below to choose a new password:</p>
            <p><a href=\"{$resetUrl}\" style=\"background:#0f172a;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;\">Reset Password</a></p>
            <p>Or paste this link into your browser:</p>
            <p><code>{$resetUrl}</code></p>
            <p>This link is single-use and will expire in 30 minutes.</p>
            <p>If you did not request a password reset, please ignore this email or contact the clinic immediately.</p>
        ";
        $bodyText = "Hello {$recipientName},\n\nA password reset was requested for your ToothCare Hub account. Visit this link to set a new password:\n\n{$resetUrl}\n\nThis link will expire in 30 minutes. If you did not make this request, please ignore this email.";

        return $this->enqueueEmail($recipientEmail, $recipientName, $subject, $bodyHtml, $bodyText, $userId);
    }

    private function enqueueEmail(
        string $recipientEmail,
        string $recipientName,
        string $subject,
        string $bodyHtml,
        string $bodyText,
        ?int $userId = null
    ): bool {
        try {
            $pdo = $this->database->getConnection();
            $stmt = $pdo->prepare('
                INSERT INTO email_outbox (
                    user_id, recipient_email, recipient_name, subject,
                    body_html, body_text, status, attempts, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, "PENDING", 0, NOW(), NOW())
            ');

            return $stmt->execute([
                $userId,
                $recipientEmail,
                $recipientName,
                $subject,
                $bodyHtml,
                $bodyText,
            ]);
        } catch (\Throwable $e) {
            $this->logger->error('Failed to enqueue email into outbox', [
                'recipient' => $recipientEmail,
                'subject' => $subject,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }
}

