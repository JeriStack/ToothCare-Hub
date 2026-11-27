<?php
declare(strict_types=1);
/**
 * ToothCare Hub email outbox worker.
 *
 *   php bin/email-worker.php            run continuously until SIGTERM/SIGINT
 *   php bin/email-worker.php --once     process one batch and exit
 *   php bin/email-worker.php --batches=N  process at most N batches, then exit
 *   php bin/email-worker.php --status   print queue statistics and exit
 *
 * Exit codes: 0 ok, 1 unexpected error, 2 invalid worker configuration,
 *             3 mail disabled or misconfigured (jobs remain queued).
 */
require_once dirname(__DIR__) . '/vendor/autoload.php';
use App\Core\Config;
use App\Core\Logger;
use App\Repositories\EmailOutboxRepository;
use App\Services\Email\EmailFactory;
use App\Services\Email\MailConfig;
use App\Services\Email\OutboxSettings;
Config::getInstance();
$opts = getopt('', ['once', 'batches::', 'status', 'help']);
if (isset($opts['help'])) {
    echo "Usage: php bin/email-worker.php [--once | --batches=N | --status]\n";
    exit(0);
}
$settings = OutboxSettings::fromEnvironment();
if (!$settings->isValid()) {
    fwrite(STDERR, "[email-worker] Invalid configuration:\n  - " . implode("\n  - ", $settings->errors) . "\n");
    exit(2);
}
$mailConfig = MailConfig::fromEnvironment();
$logger = Logger::getInstance();
if (isset($opts['status'])) {
    $s = (new EmailOutboxRepository())->stats();
    echo json_encode(['queue' => $s, 'mail' => $mailConfig->describe()], JSON_PRETTY_PRINT) . "\n";
    exit(0);
}
$once = isset($opts['once']);
$maxBatches = isset($opts['batches']) ? max(1, (int) $opts['batches']) : ($once ? 1 : PHP_INT_MAX);
$running = true;
if (function_exists('pcntl_async_signals') && function_exists('pcntl_signal')) {
    pcntl_async_signals(true);
    $stop = static function (int $signo) use (&$running): void {
        echo "[email-worker] Signal {$signo} received; finishing current batch and stopping.\n";
        $running = false;
    };
    pcntl_signal(SIGTERM, $stop);
    pcntl_signal(SIGINT, $stop);
}
try {
    $worker = EmailFactory::worker();
} catch (Throwable $e) {
    fwrite(STDERR, "[email-worker] Cannot start: " . $e->getMessage() . "\n");
    exit(2);
}
echo "[email-worker] started id={$worker->workerId()} batch={$settings->batchSize} lock_timeout={$settings->lockTimeoutSeconds}s\n";
if (!$settings->workerEnabled) {
    echo "[email-worker] EMAIL_WORKER_ENABLED=false.\n";
    if ($once || $maxBatches !== PHP_INT_MAX) {
        exit(0);
    }
}
$mailProblem = !$mailConfig->isOperational();
if ($mailProblem) {
    $why = $mailConfig->enabled ? implode(' ', $mailConfig->errors) : 'MAIL_ENABLED=false.';
    fwrite(STDERR, "[email-worker] Mail is not operational: {$why} Jobs stay queued.\n");
    $logger->error('Email worker: mail not operational', ['detail' => $why]);
    if ($once || $maxBatches !== PHP_INT_MAX) {
        // Still recover locks so crashed jobs do not stay stuck.
        $worker->runBatch();
        exit(3);
    }
}
$batches = 0;
$exit = 0;
while ($running && $batches < $maxBatches) {
    $batches++;
    try {
        if ($settings->workerEnabled) {
            $stats = $worker->runBatch();
            if ($stats['claimed'] > 0 || $stats['recovered'] > 0) {
                echo '[email-worker] ' . gmdate('c') . ' ' . json_encode($stats) . "\n";
            }
        }
    } catch (Throwable $e) {
        // Reset cached PDO handle so long-running daemons recover after MySQL restarts or wait_timeout disconnects
        App\Core\Database::getInstance()->setConnection(null);
        $logger->error('Email worker batch failed', ['error' => get_class($e)]);
        fwrite(STDERR, "[email-worker] Batch failed: " . get_class($e) . "\n");
        $exit = 1;
        if ($once) {
            break;
        }
    }
    if ($running && $batches < $maxBatches) {
        for ($i = 0; $i < $settings->sleepSeconds && $running; $i++) {
            sleep(1);
        }
    }
}
echo "[email-worker] stopped after {$batches} batch(es).\n";
exit($mailProblem && $exit === 0 ? 3 : $exit);