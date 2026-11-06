<?php

/**
 * ToothCare Hub - Database Restoration CLI
 *
 * Usage:
 *   php database/scripts/restore.php --file=backups/manual/toothcare_hub_2026-11-07_02-00-00.sql.gz.enc
 *   php database/scripts/restore.php --file=... --target-db=toothcare_hub_test --force
 */

declare(strict_types=1);

require_once __DIR__ . '/../../backend/vendor/autoload.php';

use App\Core\Config;
use App\Services\DatabaseBackupService;

echo "========================================================\n";
echo "ToothCare Hub — Database Restoration Engine\n";
echo "========================================================\n";

$options = getopt('', ['file:', 'target-db:', 'skip-pre-restore', 'force', 'key:', 'help']);

if (isset($options['help']) || !isset($options['file'])) {
    echo "Usage:\n";
    echo "  php database/scripts/restore.php --file=<path-to-backup> [options]\n\n";
    echo "Options:\n";
    echo "  --file=<path>           Path to the .sql.gz or .sql.gz.enc backup file (Required)\n";
    echo "  --target-db=<dbname>    Target database name (default: current configured db)\n";
    echo "  --skip-pre-restore      Skip creating a safety pre-restore snapshot of current database\n";
    echo "  --force                 Bypass interactive confirmation prompt\n";
    echo "  --key=<key>             Encryption key if not set in environment\n";
    echo "  --help                  Display this guide\n";
    exit(isset($options['help']) ? 0 : 1);
}

$filePath = $options['file'];
if (!file_exists($filePath)) {
    // Try resolving relative to storage dir
    $service = new DatabaseBackupService();
    $altPath = $service->getStorageDir() . DIRECTORY_SEPARATOR . ltrim($filePath, '\\/');
    if (file_exists($altPath)) {
        $filePath = $altPath;
    } else {
        echo "[ERROR] Backup file not found: {$filePath}\n";
        exit(1);
    }
}

$config = Config::getInstance();
$targetDb = $options['target-db'] ?? $config->getString('db_database', 'toothcare_hub');
$skipPreRestore = isset($options['skip-pre-restore']);
$force = isset($options['force']);
$key = $options['key'] ?? null;

echo "\nTarget Database:  {$targetDb}\n";
echo "Source Backup:    " . basename($filePath) . " (" . round(filesize($filePath) / 1024, 1) . " KB)\n";
echo "Safety Snapshot:  " . ($skipPreRestore ? "DISABLED" : "ENABLED (Automated Pre-Restore Snapshot)") . "\n";
echo "Encrypted Source: " . (str_ends_with($filePath, '.enc') ? "YES (AES-256-GCM)" : "NO") . "\n";

if (!$force) {
    echo "\n[WARNING] This operation will OVERWRITE existing data in database '{$targetDb}'.\n";
    echo "Type 'CONFIRM' to proceed with restoration: ";
    $handle = fopen("php://stdin", "r");
    $line = trim((string)fgets($handle));
    fclose($handle);

    if ($line !== 'CONFIRM') {
        echo "[ABORTED] Restoration cancelled by operator.\n";
        exit(0);
    }
}

try {
    $service = new DatabaseBackupService();

    echo "\nExecuting database restoration...\n";
    $result = $service->restoreBackup($filePath, $targetDb, $skipPreRestore, $key);

    echo "\n[SUCCESS] Database Restoration Completed Successfully!\n";
    echo "  Target Database:   {$result['target_database']}\n";
    echo "  Backup Source:     {$result['backup_source']}\n";
    echo "  Tables Restored:   {$result['tables_restored']}\n";
    if ($result['pre_restore_backup']) {
        echo "  Pre-Restore Safety: {$result['pre_restore_backup']}\n";
    }
    echo "  Duration:          {$result['duration_seconds']}s\n";
    echo "  Restored At:       {$result['restored_at']}\n";
    echo "========================================================\n";
    exit(0);
} catch (\Throwable $e) {
    echo "\n[FATAL ERROR] Restoration failed: " . $e->getMessage() . "\n";
    exit(1);
}
