<?php

/**
 * ToothCare Hub - Backup Integrity Verification CLI
 *
 * Usage:
 *   php database/scripts/verify-backup.php --file=backups/daily/...
 *   php database/scripts/verify-backup.php --file=... --test-restore
 */

declare(strict_types=1);

require_once __DIR__ . '/../../backend/vendor/autoload.php';

use App\Services\DatabaseBackupService;

echo "========================================================\n";
echo "ToothCare Hub — Backup Verification Utility\n";
echo "========================================================\n";

$options = getopt('', ['file:', 'test-restore', 'key:', 'help']);

if (isset($options['help'])) {
    echo "Usage:\n";
    echo "  php database/scripts/verify-backup.php [options]\n\n";
    echo "Options:\n";
    echo "  --file=<path>       Path to backup file (if omitted, verifies latest backup)\n";
    echo "  --test-restore      Perform full isolated restoration into a temporary database\n";
    echo "  --key=<key>         Encryption key if encrypted and not in environment\n";
    echo "  --help              Display this guide\n";
    exit(0);
}

try {
    $service = new DatabaseBackupService();

    $filePath = $options['file'] ?? null;
    if ($filePath === null) {
        $backups = $service->listBackups();
        if (empty($backups)) {
            echo "[ERROR] No backups found in storage to verify.\n";
            exit(1);
        }
        $filePath = $backups[0]['filepath'];
        echo "Auto-selected latest backup: " . basename($filePath) . "\n";
    }

    if (!file_exists($filePath)) {
        $altPath = $service->getStorageDir() . DIRECTORY_SEPARATOR . ltrim($filePath, '\\/');
        if (file_exists($altPath)) {
            $filePath = $altPath;
        } else {
            echo "[ERROR] Backup file not found: {$filePath}\n";
            exit(1);
        }
    }

    $key = $options['key'] ?? null;

    echo "\nVerifying backup file: " . basename($filePath) . "\n";
    echo "Location: {$filePath}\n";

    $result = $service->verifyBackup($filePath, $key);

    if (!$result['valid']) {
        echo "\n[FAILED] Verification Check FAILED:\n";
        echo "  Reason: {$result['error']}\n";
        exit(1);
    }

    echo "\n[PASSED] Static Verification Succeeded:\n";
    echo "  [✓] File existence and non-zero byte check\n";
    echo "  [✓] SHA-256 cryptographic checksum matching\n";
    if (str_ends_with($filePath, '.enc')) {
        echo "  [✓] AES-256-GCM authentication tag verification\n";
    }
    echo "  [✓] GZIP archive decompression check\n";
    echo "  [✓] SQL structure and schema definitions confirmed\n";

    if ($result['metadata']) {
        echo "  Original Table Count: " . ($result['metadata']['table_count'] ?? 'N/A') . "\n";
        echo "  Original Timestamp:   " . ($result['metadata']['created_at'] ?? 'N/A') . "\n";
    }

    // Optional isolated restore test
    if (isset($options['test-restore'])) {
        echo "\nExecuting full isolated restoration test into temporary sandbox...\n";
        $testReport = $service->testRestoreInIsolation($filePath, null, $key);

        if ($testReport['test_status'] === 'PASSED') {
            echo "[PASSED] Isolated Restoration Test Succeeded!\n";
            echo "  Verified Tables: {$testReport['verified_tables_count']}\n";
            echo "  Test Duration:   {$testReport['duration_seconds']}s\n";
        } else {
            echo "[FAILED] Isolated Restoration Test FAILED: " . ($testReport['error'] ?? 'Unknown error') . "\n";
            exit(1);
        }
    }

    echo "========================================================\n";
    exit(0);
} catch (\Throwable $e) {
    echo "\n[FATAL ERROR] Verification failed: " . $e->getMessage() . "\n";
    exit(1);
}
