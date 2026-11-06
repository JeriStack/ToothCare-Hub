<?php

/**
 * ToothCare Hub - Standalone Database Backup CLI
 *
 * Usage:
 *   php database/scripts/backup.php
 *   php database/scripts/backup.php --type=daily
 *   php database/scripts/backup.php --type=manual --label="before-release-v1"
 *   php database/scripts/backup.php --no-encrypt
 *   php database/scripts/backup.php --list
 */

declare(strict_types=1);

require_once __DIR__ . '/../../backend/vendor/autoload.php';

use App\Core\Config;
use App\Services\DatabaseBackupService;

echo "========================================================\n";
echo "ToothCare Hub — Database Backup Utility\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "========================================================\n";

// Parse CLI options
$options = getopt('', ['type:', 'no-encrypt', 'label:', 'list', 'help']);

if (isset($options['help'])) {
    echo "Usage:\n";
    echo "  php database/scripts/backup.php [options]\n\n";
    echo "Options:\n";
    echo "  --type=<type>       Backup type: daily, manual, pre-migration, pre-restore (default: manual)\n";
    echo "  --label=<string>    Descriptive tag/label appended to filename\n";
    echo "  --no-encrypt        Disable AES-256-GCM encryption\n";
    echo "  --list              List all existing backups across retention folders\n";
    echo "  --help              Display this guide\n";
    exit(0);
}

try {
    $service = new DatabaseBackupService();

    // Handle --list
    if (isset($options['list'])) {
        $backups = $service->listBackups();
        echo "\nDiscovered Backups (" . count($backups) . "):\n";
        echo str_repeat('-', 90) . "\n";
        printf("%-35s %-12s %-10s %-8s %-20s\n", "Filename", "Type", "Size", "Encrypted", "Created At");
        echo str_repeat('-', 90) . "\n";
        foreach ($backups as $b) {
            $sizeKb = round($b['size_bytes'] / 1024, 1) . ' KB';
            $enc = $b['encrypted'] ? 'YES (GCM)' : 'NO';
            printf("%-35s %-12s %-10s %-8s %-20s\n", $b['filename'], $b['type'], $sizeKb, $enc, substr($b['created_at'], 0, 19));
        }
        echo str_repeat('-', 90) . "\n";
        exit(0);
    }

    $type = $options['type'] ?? DatabaseBackupService::TYPE_MANUAL;
    $encrypt = !isset($options['no-encrypt']);
    $label = $options['label'] ?? null;

    echo "Executing [{$type}] database backup (Encryption: " . ($encrypt ? 'ON' : 'OFF') . ")...\n";

    $meta = $service->createBackup($type, $encrypt, $label);

    echo "\n[SUCCESS] Backup Created Successfully!\n";
    echo "  Backup ID:     {$meta['backup_id']}\n";
    echo "  Filename:      {$meta['filename']}\n";
    echo "  Location:      {$meta['filepath']}\n";
    echo "  Size:          " . number_format($meta['size_bytes']) . " bytes (" . round($meta['size_bytes'] / 1024, 1) . " KB)\n";
    echo "  Compression:   {$meta['compression_ratio']} saved\n";
    echo "  Checksum (SHA): {$meta['checksum']}\n";
    echo "  Encrypted:     " . ($meta['encrypted'] ? "YES ({$meta['cipher_algorithm']})" : 'NO') . "\n";
    echo "  Tables Dumped: {$meta['table_count']}\n";
    echo "  Duration:      {$meta['duration_seconds']}s\n";
    echo "  Verified:      " . ($meta['verified'] ? 'PASSED (Cryptographically Validated)' : 'NO') . "\n";
    echo "========================================================\n";
    exit(0);
} catch (\Throwable $e) {
    echo "\n[FATAL ERROR] Backup failed: " . $e->getMessage() . "\n";
    exit(1);
}
