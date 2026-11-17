<?php
declare(strict_types=1);
/**
 * Queue appointment reminders. Safe to run repeatedly (idempotent) and concurrently.
 *
 *   php bin/schedule-reminders.php
 *
 * Exit codes: 0 ok, 1 unexpected error, 2 invalid configuration, 4 another scheduler instance holds the lock.
 */
require_once dirname(__DIR__) . '/vendor/autoload.php';
use App\Core\Config;
use App\Services\Email\EmailFactory;
use App\Services\Email\OutboxSettings;
Config::getInstance();
$settings = OutboxSettings::fromEnvironment();
if (!$settings->isValid()) {
    fwrite(STDERR, "[reminders] Invalid configuration:\n  - " . implode("\n  - ", $settings->errors) . "\n");
    exit(2);
}
try {
    $scheduler = EmailFactory::scheduler();
    $r = $scheduler->run();
} catch (Throwable $e) {
    fwrite(STDERR, '[reminders] Failed: ' . get_class($e) . "\n");
    exit(1);
}
if ($r['locked']) {
    echo "[reminders] Another scheduler instance is running; nothing to do.\n";
    exit(4);
}
echo sprintf("[reminders] %s created=%d skipped=%d invalidated=%d lead_hours=%d\n", gmdate('c'), $r['created'], $r['skipped'], $r['invalidated'], $scheduler->leadHours());
exit(0);