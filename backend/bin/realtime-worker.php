#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * ToothCare Hub — Real-Time Notification Outbox Worker
 *
 * Continuously polls `realtime_outbox` for committed notification events and
 * delivers them to the Node.js Socket.IO service over the signed internal channel.
 *
 * Usage:
 *   php bin/realtime-worker.php            # Continuous daemon
 *   php bin/realtime-worker.php --once     # Process one batch and exit
 *   php bin/realtime-worker.php --status   # Print queue counts and validate config
 *   php bin/realtime-worker.php --help     # Display usage
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

use App\Core\Config;
use App\Core\Database;
use App\Core\Logger;
use App\Services\Realtime\RealtimeConfig;
use App\Services\Realtime\RealtimeOutboxService;

$args = array_slice($argv, 1);

if (in_array('--help', $args, true) || in_array('-h', $args, true)) {
    echo "ToothCare Hub Real-Time Outbox Worker\n";
    echo "Usage:\n";
    echo "  php bin/realtime-worker.php            Run continuously\n";
    echo "  php bin/realtime-worker.php --once     Process a single batch and exit\n";
    echo "  php bin/realtime-worker.php --status   Validate configuration and print queue stats\n";
    exit(0);
}

Config::getInstance();
$rtConfig = RealtimeConfig::fromEnvironment();

if (in_array('--status', $args, true)) {
    if (!$rtConfig->isValid()) {
        fwrite(STDERR, "Invalid realtime configuration:\n- " . implode("\n- ", $rtConfig->errors) . "\n");
        exit(1);
    }

    try {
        $db = Database::getInstance();
        if (!$db->ping()) {
            fwrite(STDERR, "Database unreachable.\n");
            exit(1);
        }
        $service = new RealtimeOutboxService(null, null, $rtConfig);
        $stats = $service->getStats();
        echo json_encode([
            'status' => 'ok',
            'enabled' => $rtConfig->enabled,
            'queue' => $stats,
        ], JSON_UNESCAPED_SLASHES) . "\n";
        exit(0);
    } catch (Throwable $e) {
        fwrite(STDERR, "Status check failed: {$e->getMessage()}\n");
        exit(1);
    }
}

if (!$rtConfig->isValid()) {
    fwrite(STDERR, "Realtime worker configuration invalid:\n- " . implode("\n- ", $rtConfig->errors) . "\n");
    exit(1);
}

$logger = Logger::getInstance();
$service = new RealtimeOutboxService(null, null, $rtConfig, $logger);
$workerId = sprintf('rt-worker-%s-%d', gethostname() ?: 'node', getmypid() ?: 0);

if (in_array('--once', $args, true)) {
    $result = $service->processPendingBatch($workerId);
    echo json_encode($result, JSON_UNESCAPED_SLASHES) . "\n";
    exit(0);
}

$running = true;
if (function_exists('pcntl_async_signals') && function_exists('pcntl_signal')) {
    pcntl_async_signals(true);
    pcntl_signal(SIGTERM, static function () use (&$running): void {
        $running = false;
    });
    pcntl_signal(SIGINT, static function () use (&$running): void {
        $running = false;
    });
}

$logger->info('Realtime outbox worker started', [
    'worker_id' => $workerId,
    'poll_interval_ms' => $rtConfig->workerPollIntervalMs,
]);

while ($running) {
    try {
        $result = $service->processPendingBatch($workerId);
        if ($result['claimed'] > 0 || $result['recovered'] > 0) {
            $logger->info('Realtime outbox batch processed', array_merge(['worker_id' => $workerId], $result));
        }
    } catch (Throwable $e) {
        $logger->error('Realtime outbox worker cycle failed', [
            'worker_id' => $workerId,
            'error' => $e->getMessage(),
        ]);
    }

    if (!$running) {
        break;
    }

    usleep($rtConfig->workerPollIntervalMs * 1000);
}

$logger->info('Realtime outbox worker stopped cleanly', ['worker_id' => $workerId]);
exit(0);
