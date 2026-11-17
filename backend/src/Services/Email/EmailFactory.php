<?php
declare(strict_types=1);
namespace App\Services\Email;
use App\Core\Config;
use App\Core\Database;
use App\Core\Logger;
use App\Repositories\AppointmentRepository;
use App\Repositories\EmailOutboxRepository;
/**
 * Composition root for the email subsystem (CLI commands and any non-HTTP entry point).
 */
final class EmailFactory
{
    public static function worker(?string $workerId = null): EmailOutboxWorker
    {
        $config = Config::getInstance();
        $mailConfig = MailConfig::fromEnvironment();
        $settings = OutboxSettings::fromEnvironment();
        $mailer = new EmailService(
            new PhpMailerTransport(new MailerFactory($mailConfig)),
            $mailConfig,
            $settings->retryPolicy
        );
        return new EmailOutboxWorker(
            new EmailOutboxRepository(),
            $mailer,
            new EmailTemplateRenderer(EmailTemplateRenderer::defaultTemplateDir(), $config->getString('app_url', 'http://localhost')),
            PayloadCipher::fromEnvironment(),
            $settings,
            Logger::getInstance(),
            $workerId ?? EmailOutboxWorker::newWorkerId()
        );
    }
    public static function scheduler(): ReminderScheduler
    {
        $database = Database::getInstance();
        return new ReminderScheduler(
            new EmailOutboxRepository($database),
            new AppointmentRepository($database),
            new EmailOutboxService(null, null, null, null, null, $database),
            OutboxSettings::fromEnvironment(),
            $database,
            Logger::getInstance()
        );
    }
}