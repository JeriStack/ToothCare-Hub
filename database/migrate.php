<?php
/**
 * ToothCare Hub - Standalone Database Migration Runner
 * 
 * Executes versioned SQL migrations in sequential dependency order,
 * tracks execution history in `schema_migrations`, and guarantees idempotency.
 * 
 * Usage:
 *   php database/migrate.php
 *   php database/migrate.php --status
 */

declare(strict_types=1);

$dbHost = getenv('DB_HOST') ?: '127.0.0.1';
$dbPort = (int)(getenv('DB_PORT') ?: 3306);
$dbName = getenv('DB_NAME') ?: 'toothcare_hub';
$dbUser = getenv('DB_USER') ?: 'toothcare_user';
$dbPass = getenv('DB_PASSWORD') ?: 'toothcare_secure_pass';

$migrationsDir = __DIR__ . '/migrations';

echo "========================================================\n";
echo "ToothCare Hub — Migration Runner\n";
echo "Target Database: {$dbName} on {$dbHost}:{$dbPort}\n";
echo "========================================================\n";

try {
    $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    echo "[FATAL] Database connection failed: " . $e->getMessage() . "\n";
    exit(1);
}

// 1. Ensure schema_migrations exists
$pdo->exec("
    CREATE TABLE IF NOT EXISTS schema_migrations (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        batch INT UNSIGNED NOT NULL DEFAULT 1,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_schema_migrations_batch (batch)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// 2. Fetch applied migrations
$stmt = $pdo->query("SELECT version FROM schema_migrations ORDER BY id ASC");
$appliedMigrations = $stmt->fetchAll(PDO::FETCH_COLUMN);

// Check for --status flag
if (in_array('--status', $argv, true)) {
    echo "\nApplied Migrations (" . count($appliedMigrations) . "):\n";
    foreach ($appliedMigrations as $m) {
        echo "  [✓] {$m}\n";
    }
    exit(0);
}

// 3. Scan migrations directory
$files = glob($migrationsDir . '/*.sql');
sort($files);

$pending = [];
foreach ($files as $file) {
    $version = basename($file, '.sql');
    if (!in_array($version, $appliedMigrations, true)) {
        $pending[$version] = $file;
    }
}

if (empty($pending)) {
    echo "[INFO] No pending migrations. Database schema is fully up to date!\n";
    exit(0);
}

// Calculate next batch number
$stmt = $pdo->query("SELECT COALESCE(MAX(batch), 0) + 1 FROM schema_migrations");
$nextBatch = (int)$stmt->fetchColumn();

echo "\nDiscovered " . count($pending) . " pending migration(s) for Batch #{$nextBatch}:\n";

$appliedCount = 0;
foreach ($pending as $version => $filePath) {
    $filename = basename($filePath);
    echo "  Applying {$filename}... ";
    $startTime = microtime(true);
    
    $sql = file_get_contents($filePath);
    if ($sql === false) {
        echo "[ERROR] Cannot read file!\n";
        exit(1);
    }

    try {
        // Execute migration statements
        $pdo->exec($sql);

        // Record in ledger
        $recordStmt = $pdo->prepare("
            INSERT INTO schema_migrations (version, name, batch, applied_at)
            VALUES (:version, :name, :batch, NOW())
        ");
        $recordStmt->execute([
            ':version' => $version,
            ':name' => $filename,
            ':batch' => $nextBatch,
        ]);

        $durationMs = round((microtime(true) - $startTime) * 1000, 2);
        echo "DONE ({$durationMs} ms)\n";
        $appliedCount++;
    } catch (PDOException $e) {
        echo "FAILED!\n";
        echo "[FATAL ERROR] Migration {$filename} failed:\n";
        echo "  " . $e->getMessage() . "\n";
        exit(1);
    }
}

echo "\n[SUCCESS] Successfully applied {$appliedCount} migration(s).\n";
