<?php

declare(strict_types=1);

/**
 * ToothCare Hub - Development Seed Dataset Runner
 *
 * SAFETY GUARD:
 * This script is strictly restricted to 'development' and 'testing' environments.
 * It will immediately abort if executed in 'production' or 'staging'.
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

use App\Core\Config;
use App\Core\Database;

$baseDir = dirname(__DIR__);

// 1. Load Environment Configuration
$config = Config::getInstance();
$env = strtolower((string) ($config->get('app_env') ?? $_ENV['APP_ENV'] ?? 'development'));

if ($env === 'production' || $env === 'staging') {
    fwrite(STDERR, "[CRITICAL ERROR] Database seeders are STRICTLY PROHIBITED in '{$env}' environment.\n");
    fwrite(STDERR, "Seeding aborted to prevent data loss or overwriting production credentials.\n");
    exit(1);
}

echo "====================================================================\n";
echo "ToothCare Hub - Database Development Seeder\n";
echo "Environment: {$env} (Verified non-production)\n";
echo "====================================================================\n";

// 2. Locate Seed SQL File
$seedSqlPath = realpath($baseDir . '/../database/seeds/development_seed.sql');
if ($seedSqlPath === false || !file_exists($seedSqlPath)) {
    // Check fallback relative path
    $seedSqlPath = realpath($baseDir . '/database/seeds/development_seed.sql');
}

if ($seedSqlPath === false || !file_exists($seedSqlPath)) {
    fwrite(STDERR, "[ERROR] Seed SQL file not found at database/seeds/development_seed.sql\n");
    exit(1);
}

echo "Found seed dataset: {$seedSqlPath}\n";

try {
    $database = Database::getInstance();
    $pdo = $database->getConnection();

    $sqlContent = file_get_contents($seedSqlPath);
    if ($sqlContent === false) {
        throw new \RuntimeException("Unable to read seed SQL file.");
    }

    echo "Executing idempotent development seeds...\n";

    // Split SQL statements safely
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    
    // Execute full script
    $pdo->exec($sqlContent);
    
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

    echo "\n[SUCCESS] Development dataset seeded successfully!\n\n";
    echo "Configured Development Accounts (Password configured via environment/seeder):\n";
    echo "  - Administrator: admin@toothcare.local\n";
    echo "  - Receptionist:  receptionist@toothcare.local\n";
    echo "  - Dentist:       dr.santos@toothcare.local\n";
    echo "  - Dentist:       dr.reyes@toothcare.local\n";
    echo "  - Dentist:       dr.lim@toothcare.local\n";
    echo "  - Patient:       patient.juan@example.com\n";
    echo "  - Patient:       patient.maria@example.com\n";
    echo "  - Patient:       patient.elena@example.com\n";
    echo "  - Patient:       patient.roberto@example.com\n";
    echo "====================================================================\n";
    exit(0);
} catch (\Throwable $e) {
    fwrite(STDERR, "\n[ERROR] Seeding failed: " . $e->getMessage() . "\n");
    exit(1);
}
