<?php

/**
 * ToothCare Hub - Pre-Migration Snapshot Utility
 *
 * Automatically triggered before database migrations to safeguard state.
 *
 * Usage:
 *   php database/scripts/pre-migration-backup.php --batch=2
 */

declare(strict_types=1);

require_once __DIR__ . '/../../backend/vendor/autoload.php';

use App\Services\DatabaseBackupService;

$options = getopt('', ['batch:', 'label:', 'help']);

if (isset($options['help'])) {
    echo "Usage:\n";
    echo "  php database/scripts/pre-migration-backup.php [--batch=<number>] [--label=<string>]\n";
    exit(0);
}

$label = $options['label'] ?? null;
if ($label === null && isset($options['batch'])) {
    $label = "batch_" . $options['batch'];
}

try {
    $service = new DatabaseBackupService();
    echo "[PRE-MIGRATION] Generating safety database snapshot before applying schema changes...\n";

    $meta = $service->createBackup(
        DatabaseBackupService::TYPE_PRE_MIGRATION,
        true,
        $label
    );

    echo "[PRE-MIGRATION] Snapshot secured: {$meta['filename']} ({$meta['size_bytes']} bytes, SHA: " . substr($meta['checksum'], 0, 16) . "...)\n";
    exit(0);
} catch (\Throwable $e) {
    echo "[PRE-MIGRATION ERROR] Failed to create pre-migration snapshot: " . $e->getMessage() . "\n";
    echo "[CRITICAL] Aborting migration to prevent unrecoverable database modifications.\n";
    exit(1);
}
