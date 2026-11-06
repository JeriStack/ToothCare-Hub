<?php

/**
 * ToothCare Hub - Backup Retention Lifecycle & Cleanup CLI
 *
 * Usage:
 *   php database/scripts/cleanup-backups.php --dry-run
 *   php database/scripts/cleanup-backups.php --days=30
 */

declare(strict_types=1);

require_once __DIR__ . '/../../backend/vendor/autoload.php';

use App\Services\DatabaseBackupService;

echo "========================================================\n";
echo "ToothCare Hub — Backup Retention Lifecycle Manager\n";
echo "========================================================\n";

$options = getopt('', ['days:', 'dry-run', 'help']);

if (isset($options['help'])) {
    echo "Usage:\n";
    echo "  php database/scripts/cleanup-backups.php [options]\n\n";
    echo "Options:\n";
    echo "  --days=<int>    Retention threshold in days (default: 30)\n";
    echo "  --dry-run       Preview expired backups without actually deleting them\n";
    echo "  --help          Display this guide\n";
    exit(0);
}

try {
    $service = new DatabaseBackupService();
    $days = isset($options['days']) ? (int)$options['days'] : 30;
    $dryRun = isset($options['dry-run']);

    echo "Retention Policy: " . ($dryRun ? "[DRY-RUN] " : "") . "Purging backups older than {$days} days...\n\n";

    $result = $service->cleanupBackups($days, $dryRun);

    echo "Summary:\n";
    echo "  Mode:      " . ($result['dry_run'] ? "DRY-RUN (Simulated)" : "ENFORCED (Deleted)") . "\n";
    echo "  Eligible:  " . count($result['deleted']) . " backup(s)\n";
    echo "  Preserved: " . count($result['preserved']) . " backup(s)\n\n";

    if (!empty($result['deleted'])) {
        echo ($result['dry_run'] ? "Files that would be deleted:\n" : "Files deleted:\n");
        foreach ($result['deleted'] as $f) {
            echo "  [-] " . basename($f) . "\n";
        }
    } else {
        echo "[INFO] No expired backups found beyond the {$days}-day threshold.\n";
    }

    echo "========================================================\n";
    exit(0);
} catch (\Throwable $e) {
    echo "\n[FATAL ERROR] Retention cleanup failed: " . $e->getMessage() . "\n";
    exit(1);
}
