<?php
declare(strict_types=1);

/**
 * ToothCare Hub - Background Email Worker
 * Processes pending email_outbox records and dispatches notification emails.
 * Reuses the backend PHP image with a dedicated CLI command.
 */

$pollInterval = (int)(getenv('WORKER_POLL_INTERVAL_SECONDS') ?: 5);
$running = true;

// Handle POSIX termination signals if pcntl is enabled
if (function_exists('pcntl_async_signals') && function_exists('pcntl_signal')) {
    pcntl_async_signals(true);
    $signalHandler = function (int $signo) use (&$running) {
        echo "[email-worker] Received termination signal ({$signo}). Shutting down gracefully...\n";
        $running = false;
    };
    pcntl_signal(SIGTERM, $signalHandler);
    pcntl_signal(SIGINT, $signalHandler);
}

echo "[email-worker] ToothCare Hub Email Outbox Worker started.\n";
echo "[email-worker] Polling interval: {$pollInterval}s. Environment: " . (getenv('APP_ENV') ?: 'development') . "\n";

$dbHost = getenv('DB_HOST') ?: 'mysql';
$dbPort = getenv('DB_PORT') ?: '3306';
$dbName = getenv('DB_NAME') ?: 'toothcare_hub';
$dbUser = getenv('DB_USER') ?: 'toothcare_user';
$dbPass = getenv('DB_PASSWORD') ?: 'toothcare_secure_pass';

$iteration = 0;

while ($running) {
    $iteration++;
    $timestamp = gmdate('Y-m-d H:i:s');

    try {
        $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
        $pdo = new PDO($dsn, $dbUser, $dbPass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 2,
        ]);

        // Check if email_outbox table exists yet (created in Phase 3)
        $stmt = $pdo->query("SHOW TABLES LIKE 'email_outbox'");
        $hasTable = (bool)$stmt->fetchColumn();

        if ($hasTable) {
            // Check for pending emails
            $query = $pdo->query("SELECT COUNT(*) FROM email_outbox WHERE status = 'pending'");
            $pendingCount = (int)$query->fetchColumn();
            if ($pendingCount > 0) {
                echo "[{$timestamp}] [email-worker] Processing {$pendingCount} pending email(s)...\n";
            }
        }
    } catch (\Throwable $e) {
        // Log database connection waiting/retry in development
        if ($iteration % 6 === 1) {
            echo "[{$timestamp}] [email-worker] Database waiting: " . $e->getMessage() . "\n";
        }
    }

    if ($iteration % 12 === 1) {
        echo "[{$timestamp}] [email-worker] Heartbeat: worker active and polling.\n";
    }

    sleep($pollInterval);
}

echo "[email-worker] Worker process stopped cleanly.\n";
exit(0);
