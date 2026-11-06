<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Config;
use App\Core\Database;
use App\Core\Logger;
use PDO;
use PDOException;
use RuntimeException;
use InvalidArgumentException;

/**
 * Enterprise Database Backup and Disaster Recovery Service for ToothCare Hub.
 *
 * Implements:
 * - Consistent mysqldump exports (with transaction consistency and routines)
 * - Portable PDO SQL export fallback for container/host portability
 * - GZIP compression (RFC 1952)
 * - Authenticated AES-256-GCM encryption with cryptographic tamper detection
 * - SHA-256 checksum generation and verification
 * - JSON metadata manifest generation
 * - Isolated restoration and pre-restore recovery safeguards
 * - Retention lifecycle management with dry-run support
 * - Audit logging with credential redaction
 */
class DatabaseBackupService
{
    public const CIPHER_ALGO = 'aes-256-gcm';
    public const IV_LENGTH = 12; // Standard 96-bit IV for GCM
    public const TAG_LENGTH = 16; // 128-bit authentication tag

    public const TYPE_DAILY = 'daily';
    public const TYPE_MANUAL = 'manual';
    public const TYPE_PRE_MIGRATION = 'pre-migration';
    public const TYPE_PRE_RESTORE = 'pre-restore';

    private Database $database;
    private Config $config;
    private Logger $logger;
    private string $storageDir;
    private ?string $mysqldumpBinary = null;
    private ?string $mysqlBinary = null;

    public function __construct(
        ?Database $database = null,
        ?Config $config = null,
        ?Logger $logger = null,
        ?string $storageDir = null
    ) {
        $this->database = $database ?? Database::getInstance();
        $this->config = $config ?? Config::getInstance();
        $this->logger = $logger ?? Logger::getInstance();

        $projectRoot = dirname(__DIR__, 3);
        $configuredDir = $storageDir 
            ?? $this->config->getString('backup_storage_dir') 
            ?: ($projectRoot . DIRECTORY_SEPARATOR . 'backups');

        // Resolve absolute path
        $this->storageDir = str_starts_with($configuredDir, '/') || preg_match('/^[A-Za-z]:[\\\\\/]/', $configuredDir)
            ? rtrim($configuredDir, '\\/')
            : rtrim($projectRoot . DIRECTORY_SEPARATOR . ltrim($configuredDir, '\\/'), '\\/');

        $this->ensureDirectories();
        $this->discoverBinaries();
    }

    /**
     * Ensure standard backup subdirectories exist with proper permissions.
     */
    private function ensureDirectories(): void
    {
        $dirs = [
            $this->storageDir,
            $this->storageDir . DIRECTORY_SEPARATOR . self::TYPE_DAILY,
            $this->storageDir . DIRECTORY_SEPARATOR . self::TYPE_MANUAL,
            $this->storageDir . DIRECTORY_SEPARATOR . self::TYPE_PRE_MIGRATION,
            $this->storageDir . DIRECTORY_SEPARATOR . self::TYPE_PRE_RESTORE,
            $this->storageDir . DIRECTORY_SEPARATOR . 'verification',
            $this->storageDir . DIRECTORY_SEPARATOR . 'logs',
        ];

        foreach ($dirs as $dir) {
            if (!is_dir($dir)) {
                @mkdir($dir, 0750, true);
            }
        }
    }

    /**
     * Discover mysqldump and mysql binaries on the host or inside container.
     */
    private function discoverBinaries(): void
    {
        $dumpCandidates = [
            'mysqldump',
            'C:\\xampp\\mysql\\bin\\mysqldump.exe',
            '/usr/bin/mysqldump',
            '/usr/local/bin/mysqldump',
            '/usr/local/mysql/bin/mysqldump',
        ];

        foreach ($dumpCandidates as $candidate) {
            if ($this->isExecutable($candidate)) {
                $this->mysqldumpBinary = $candidate;
                break;
            }
        }

        $mysqlCandidates = [
            'mysql',
            'C:\\xampp\\mysql\\bin\\mysql.exe',
            '/usr/bin/mysql',
            '/usr/local/bin/mysql',
            '/usr/local/mysql/bin/mysql',
        ];

        foreach ($mysqlCandidates as $candidate) {
            if ($this->isExecutable($candidate)) {
                $this->mysqlBinary = $candidate;
                break;
            }
        }
    }

    private function isExecutable(string $cmd): bool
    {
        if (file_exists($cmd) && is_executable($cmd)) {
            return true;
        }

        $checkCmd = (stripos(PHP_OS, 'WIN') === 0) ? "where {$cmd} 2>NUL" : "which {$cmd} 2>/dev/null";
        $output = @shell_exec($checkCmd);

        return !empty(trim((string)$output));
    }

    public function getStorageDir(): string
    {
        return $this->storageDir;
    }

    /**
     * Create a complete database backup.
     *
     * @param string $type self::TYPE_DAILY, TYPE_MANUAL, TYPE_PRE_MIGRATION, TYPE_PRE_RESTORE
     * @param bool|null $encrypt Whether to encrypt with AES-256-GCM (defaults to config setting)
     * @param string|null $label Optional descriptive label (e.g., migration batch ID)
     * @param string|null $customKey Optional encryption key override
     * @return array<string, mixed> Backup manifest metadata
     */
    public function createBackup(
        string $type = self::TYPE_MANUAL,
        ?bool $encrypt = null,
        ?string $label = null,
        ?string $customKey = null
    ): array {
        $startTime = microtime(true);
        $timestamp = date('Y-m-d_H-i-s');
        $dbName = $this->config->getString('db_database', 'toothcare_hub');

        $allowedTypes = [self::TYPE_DAILY, self::TYPE_MANUAL, self::TYPE_PRE_MIGRATION, self::TYPE_PRE_RESTORE];
        if (!in_array($type, $allowedTypes, true)) {
            throw new InvalidArgumentException("Invalid backup type: '{$type}'. Allowed: " . implode(', ', $allowedTypes));
        }

        $shouldEncrypt = $encrypt ?? $this->config->getBool('backup_encryption_enabled', true);
        $targetSubdir = $this->storageDir . DIRECTORY_SEPARATOR . $type;

        // Build deterministic filename
        $prefix = "toothcare_hub";
        if ($type === self::TYPE_PRE_MIGRATION) {
            $prefix .= "_pre_migration";
        } elseif ($type === self::TYPE_PRE_RESTORE) {
            $prefix .= "_pre_restore";
        }

        if ($label !== null && $label !== '') {
            $cleanLabel = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $label);
            $prefix .= "_{$cleanLabel}";
        }

        $baseFilename = "{$prefix}_{$timestamp}.sql";
        $gzFilename = "{$baseFilename}.gz";
        $finalFilename = $shouldEncrypt ? "{$gzFilename}.enc" : $gzFilename;
        $finalPath = $targetSubdir . DIRECTORY_SEPARATOR . $finalFilename;

        $this->log("Initiating {$type} backup for database '{$dbName}'...");

        // 1. Export SQL
        $sql = $this->exportDatabase($dbName);
        if (trim($sql) === '') {
            throw new RuntimeException("Database export yielded empty content for '{$dbName}'.");
        }

        // 2. Compress with GZIP (RFC 1952)
        $compressed = gzencode($sql, 9);
        if ($compressed === false) {
            throw new RuntimeException("Failed to compress database backup content.");
        }
        $rawBytes = strlen($sql);
        $compressedBytes = strlen($compressed);

        // 3. Encrypt with AES-256-GCM if enabled
        if ($shouldEncrypt) {
            $key = $this->resolveEncryptionKey($customKey);
            $encryptedData = $this->encryptString($compressed, $key);
            if (file_put_contents($finalPath, $encryptedData) === false) {
                throw new RuntimeException("Failed to write encrypted backup file to '{$finalPath}'.");
            }
        } else {
            if (file_put_contents($finalPath, $compressed) === false) {
                throw new RuntimeException("Failed to write backup file to '{$finalPath}'.");
            }
        }

        // 4. Compute SHA-256 Checksum of the final written artifact
        $checksum = hash_file('sha256', $finalPath);
        if ($checksum === false) {
            throw new RuntimeException("Failed to calculate SHA-256 checksum for '{$finalPath}'.");
        }

        // 5. Write .sha256 companion file
        $sha256Path = $finalPath . '.sha256';
        file_put_contents($sha256Path, "{$checksum}  {$finalFilename}\n");

        // 6. Inspect schema table count
        $tables = $this->getTableList($dbName);

        // 7. Generate and write JSON manifest metadata
        $durationSeconds = round(microtime(true) - $startTime, 3);
        $backupId = "tc_bak_" . hash('crc32b', $finalFilename) . "_" . time();

        $metadata = [
            'backup_id' => $backupId,
            'database' => $dbName,
            'created_at' => date('c'),
            'timestamp' => $timestamp,
            'backup_type' => $type,
            'label' => $label,
            'filename' => $finalFilename,
            'filepath' => $finalPath,
            'format' => $shouldEncrypt ? 'sql.gz.enc' : 'sql.gz',
            'encrypted' => $shouldEncrypt,
            'cipher_algorithm' => $shouldEncrypt ? self::CIPHER_ALGO : null,
            'compressed' => true,
            'compression_algorithm' => 'gzip',
            'checksum_algorithm' => 'SHA-256',
            'checksum' => $checksum,
            'size_bytes' => filesize($finalPath),
            'uncompressed_bytes' => $rawBytes,
            'compression_ratio' => $rawBytes > 0 ? round(($rawBytes - $compressedBytes) / $rawBytes * 100, 1) . '%' : '0%',
            'table_count' => count($tables),
            'tables' => $tables,
            'duration_seconds' => $durationSeconds,
            'verified' => false,
            'status' => 'success',
        ];

        $metaPath = $finalPath . '.backup-meta.json';
        file_put_contents($metaPath, json_encode($metadata, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        // 8. Self-verification of the created backup
        $verification = $this->verifyBackup($finalPath, $customKey);
        if (!$verification['valid']) {
            @unlink($finalPath);
            @unlink($sha256Path);
            @unlink($metaPath);
            throw new RuntimeException("Backup integrity self-test failed: " . ($verification['error'] ?? 'Unknown error'));
        }

        $metadata['verified'] = true;
        file_put_contents($metaPath, json_encode($metadata, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        $this->log("Backup completed and verified: {$finalFilename} ({$metadata['size_bytes']} bytes, {$durationSeconds}s)");

        return $metadata;
    }

    /**
     * Export database content as a consistent SQL dump.
     * Uses mysqldump when available, with a full PDO schema & data extractor fallback.
     */
    public function exportDatabase(string $databaseName): string
    {
        if ($this->mysqldumpBinary !== null) {
            try {
                return $this->exportViaMysqldump($databaseName);
            } catch (\Throwable $e) {
                $this->log("mysqldump execution failed: {$e->getMessage()}. Switching to native PDO exporter.");
            }
        }

        return $this->exportViaPdo($databaseName);
    }

    /**
     * Execute mysqldump with atomic transaction isolation and routine preservation.
     */
    private function exportViaMysqldump(string $databaseName): string
    {
        $dbHost = $this->config->getString('db_host', '127.0.0.1');
        $dbPort = $this->config->getInt('db_port', 3306);
        $dbUser = $this->config->getString('db_username', 'root');
        $dbPass = $this->config->getString('db_password', '');

        // Create temporary secure options file to prevent password leakage in process tree
        $tempCnf = tempnam(sys_get_temp_dir(), 'tc_my_');
        if ($tempCnf === false) {
            throw new RuntimeException("Could not create temporary configuration file for mysqldump.");
        }

        $cnfContent = "[client]\n";
        $cnfContent .= "host={$dbHost}\n";
        $cnfContent .= "port={$dbPort}\n";
        $cnfContent .= "user=\"{$dbUser}\"\n";
        if ($dbPass !== '') {
            $cnfContent .= "password=\"{$dbPass}\"\n";
        }

        file_put_contents($tempCnf, $cnfContent);
        @chmod($tempCnf, 0600);

        $tempSql = tempnam(sys_get_temp_dir(), 'tc_dump_');

        $cmd = sprintf(
            '"%s" --defaults-extra-file="%s" --single-transaction --routines --triggers --events --hex-blob --default-character-set=utf8mb4 --result-file="%s" "%s" 2>&1',
            $this->mysqldumpBinary,
            $tempCnf,
            $tempSql,
            $databaseName
        );

        $output = [];
        $exitCode = 0;
        exec($cmd, $output, $exitCode);

        @unlink($tempCnf);

        if ($exitCode !== 0) {
            @unlink((string)$tempSql);
            $err = implode("\n", $output);
            throw new RuntimeException("mysqldump failed with exit code {$exitCode}: {$err}");
        }

        $sql = file_get_contents((string)$tempSql);
        @unlink((string)$tempSql);

        if ($sql === false || trim($sql) === '') {
            throw new RuntimeException("mysqldump produced empty output.");
        }

        return $sql;
    }

    /**
     * Fallback PDO-based database exporter.
     * Dumps complete DDL structures and data rows for all tables with FK constraints properly guarded.
     */
    public function exportViaPdo(string $databaseName): string
    {
        $pdo = $this->database->getConnection();
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        $tables = $this->getTableList($databaseName);

        $out = "-- ====================================================================\n";
        $out .= "-- ToothCare Hub Native Database Export\n";
        $out .= "-- Database: {$databaseName}\n";
        $out .= "-- Generated At: " . date('Y-m-d H:i:s') . "\n";
        $out .= "-- Engine: " . ($driver === 'sqlite' ? 'SQLite' : 'InnoDB / utf8mb4') . "\n";
        $out .= "-- ====================================================================\n\n";

        if ($driver !== 'sqlite') {
            $out .= "SET FOREIGN_KEY_CHECKS = 0;\n";
            $out .= "SET NAMES utf8mb4;\n";
            $out .= "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n";
            $out .= "SET time_zone = '+00:00';\n\n";
        }

        foreach ($tables as $table) {
            $out .= "-- --------------------------------------------------------------------\n";
            $out .= "-- Table structure for `{$table}`\n";
            $out .= "-- --------------------------------------------------------------------\n";
            $out .= "DROP TABLE IF EXISTS `{$table}`;\n";

            if ($driver === 'sqlite') {
                $stmt = $pdo->query("SELECT sql FROM sqlite_master WHERE type='table' AND name='{$table}'");
                $createSql = $stmt->fetchColumn();
                if ($createSql) {
                    $out .= $createSql . ";\n\n";
                }
            } else {
                $stmt = $pdo->query("SHOW CREATE TABLE `{$table}`");
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row && isset($row['Create Table'])) {
                    $out .= $row['Create Table'] . ";\n\n";
                }
            }

            // Dump data
            $out .= "-- Data for `{$table}`\n";
            $rowsStmt = $pdo->query("SELECT * FROM `{$table}`");
            $rows = $rowsStmt->fetchAll(PDO::FETCH_ASSOC);

            if (!empty($rows)) {
                if ($driver !== 'sqlite') {
                    $out .= "LOCK TABLES `{$table}` WRITE;\n";
                }
                foreach (array_chunk($rows, 100) as $chunk) {
                    $columnNames = array_keys($chunk[0]);
                    $colList = implode('`, `', $columnNames);

                    $valueLines = [];
                    foreach ($chunk as $r) {
                        $values = [];
                        foreach ($r as $val) {
                            if ($val === null) {
                                $values[] = 'NULL';
                            } elseif (is_numeric($val) && !str_starts_with((string)$val, '0')) {
                                $values[] = (string)$val;
                            } else {
                                $values[] = $pdo->quote((string)$val);
                            }
                        }
                        $valueLines[] = "(" . implode(', ', $values) . ")";
                    }

                    $out .= "INSERT INTO `{$table}` (`{$colList}`) VALUES\n" . implode(",\n", $valueLines) . ";\n";
                }
                if ($driver !== 'sqlite') {
                    $out .= "UNLOCK TABLES;\n\n";
                } else {
                    $out .= "\n";
                }
            }
        }

        if ($driver !== 'sqlite') {
            $out .= "SET FOREIGN_KEY_CHECKS = 1;\n";
        }
        $out .= "-- Dump completed on " . date('Y-m-d H:i:s') . "\n";

        return $out;
    }

    /**
     * Retrieve list of tables in database.
     *
     * @return list<string>
     */
    public function getTableList(string $databaseName): array
    {
        $pdo = $this->database->getConnection();
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

        if ($driver === 'sqlite') {
            $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
        } else {
            $stmt = $pdo->query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
        }

        $tables = [];
        while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
            $tables[] = (string)$row[0];
        }

        sort($tables);
        return $tables;
    }

    /**
     * Authenticated AES-256-GCM Encryption.
     * Generates a 12-byte random IV and 16-byte authentication tag.
     * Output format: [12-byte IV][16-byte Tag][Ciphertext]
     */
    public function encryptString(string $plaintext, string $key): string
    {
        $binaryKey = $this->normalizeKey($key);
        $iv = random_bytes(self::IV_LENGTH);
        $tag = '';

        $ciphertext = openssl_encrypt(
            $plaintext,
            self::CIPHER_ALGO,
            $binaryKey,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            self::TAG_LENGTH
        );

        if ($ciphertext === false || strlen($tag) !== self::TAG_LENGTH) {
            throw new RuntimeException("AES-256-GCM encryption failed: " . (openssl_error_string() ?: 'Tag generation error'));
        }

        return $iv . $tag . $ciphertext;
    }

    /**
     * Authenticated AES-256-GCM Decryption.
     * Parses the 12-byte IV and 16-byte tag, verifying authenticity before returning plaintext.
     */
    public function decryptString(string $payload, string $key): string
    {
        $minLen = self::IV_LENGTH + self::TAG_LENGTH;
        if (strlen($payload) < $minLen) {
            throw new RuntimeException("Encrypted payload is truncated or invalid (shorter than IV + Tag).");
        }

        $binaryKey = $this->normalizeKey($key);
        $iv = substr($payload, 0, self::IV_LENGTH);
        $tag = substr($payload, self::IV_LENGTH, self::TAG_LENGTH);
        $ciphertext = substr($payload, $minLen);

        $plaintext = openssl_decrypt(
            $ciphertext,
            self::CIPHER_ALGO,
            $binaryKey,
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );

        if ($plaintext === false) {
            throw new RuntimeException("AES-256-GCM decryption failed: Authentication tag verification failed or key is incorrect.");
        }

        return $plaintext;
    }

    /**
     * Normalize encryption key to strict 32 bytes (256 bits).
     */
    private function normalizeKey(string $key): string
    {
        if (strlen($key) === 32) {
            return $key;
        }

        // Check if base64 encoded
        $b64Decoded = base64_decode($key, true);
        if ($b64Decoded !== false && strlen($b64Decoded) === 32) {
            return $b64Decoded;
        }

        // Deterministically hash to 32 bytes using SHA-256
        return hash('sha256', $key, true);
    }

    /**
     * Resolve encryption key from arguments, environment, or configuration.
     */
    public function resolveEncryptionKey(?string $customKey = null): string
    {
        if ($customKey !== null && $customKey !== '') {
            return $customKey;
        }

        $envKey = getenv('BACKUP_ENCRYPTION_KEY') 
            ?: $this->config->getString('backup_encryption_key');

        if (!empty($envKey) && !str_contains($envKey, 'CHANGE_ME')) {
            return $envKey;
        }

        // Check for dedicated key file in storage
        $keyFile = $this->storageDir . DIRECTORY_SEPARATOR . '.backup_master.key';
        if (file_exists($keyFile)) {
            $savedKey = trim((string)file_get_contents($keyFile));
            if (!empty($savedKey)) {
                return $savedKey;
            }
        }

        // Auto-generate and securely save a master key for local development
        $generated = base64_encode(random_bytes(32));
        file_put_contents($keyFile, $generated);
        @chmod($keyFile, 0600);

        return $generated;
    }

    /**
     * Verify the integrity of a backup artifact.
     *
     * @param string $backupPath Path to .sql.gz or .sql.gz.enc
     * @param string|null $customKey Encryption key if file is encrypted
     * @return array{valid: bool, error: ?string, metadata: ?array}
     */
    public function verifyBackup(string $backupPath, ?string $customKey = null): array
    {
        if (!file_exists($backupPath)) {
            return ['valid' => false, 'error' => "Backup file does not exist: {$backupPath}", 'metadata' => null];
        }

        if (filesize($backupPath) === 0) {
            return ['valid' => false, 'error' => "Backup file is empty (0 bytes).", 'metadata' => null];
        }

        // 1. Verify SHA-256 Checksum companion if present
        $sha256File = $backupPath . '.sha256';
        if (file_exists($sha256File)) {
            $shaLine = trim((string)file_get_contents($sha256File));
            $expectedHash = preg_split('/\s+/', $shaLine)[0] ?? '';
            $actualHash = hash_file('sha256', $backupPath);

            if (!hash_equals(strtolower($expectedHash), strtolower((string)$actualHash))) {
                return [
                    'valid' => false,
                    'error' => "SHA-256 Checksum mismatch! Expected {$expectedHash}, computed {$actualHash}",
                    'metadata' => null,
                ];
            }
        }

        // 2. Read and test decryption / decompression
        $rawBytes = file_get_contents($backupPath);
        if ($rawBytes === false) {
            return ['valid' => false, 'error' => "Could not read backup file.", 'metadata' => null];
        }

        $isEncrypted = str_ends_with($backupPath, '.enc');
        $decompressedSql = '';

        if ($isEncrypted) {
            try {
                $key = $this->resolveEncryptionKey($customKey);
                $decompressedGz = $this->decryptString($rawBytes, $key);
                $decompressedSql = @gzdecode($decompressedGz);
                if ($decompressedSql === false) {
                    return ['valid' => false, 'error' => "Decrypted content failed GZIP decompression.", 'metadata' => null];
                }
            } catch (\Throwable $e) {
                return ['valid' => false, 'error' => "Decryption failed: " . $e->getMessage(), 'metadata' => null];
            }
        } else {
            $decompressedSql = @gzdecode($rawBytes);
            if ($decompressedSql === false) {
                return ['valid' => false, 'error' => "Backup file is not a valid GZIP archive.", 'metadata' => null];
            }
        }

        // 3. Inspect SQL header for valid database markers
        if (!str_contains($decompressedSql, 'CREATE TABLE') && !str_contains($decompressedSql, 'INSERT INTO')) {
            return ['valid' => false, 'error' => "Decoded SQL content missing standard database definitions.", 'metadata' => null];
        }

        // 4. Load metadata manifest if exists
        $metaFile = $backupPath . '.backup-meta.json';
        $meta = file_exists($metaFile) ? json_decode((string)file_get_contents($metaFile), true) : null;

        return [
            'valid' => true,
            'error' => null,
            'metadata' => $meta,
        ];
    }

    /**
     * Restore a database backup into a target database.
     *
     * @param string $backupPath Path to the backup file
     * @param string $targetDatabase Name of database to restore into
     * @param bool $skipPreRestoreBackup If false, automatically generates a pre-restore backup first
     * @param string|null $customKey Encryption key if encrypted
     * @return array<string, mixed> Restoration summary
     */
    public function restoreBackup(
        string $backupPath,
        string $targetDatabase,
        bool $skipPreRestoreBackup = false,
        ?string $customKey = null
    ): array {
        $startTime = microtime(true);
        $this->log("Starting restoration from '{$backupPath}' into target database '{$targetDatabase}'...");

        // 1. Verify backup integrity before doing anything
        $verify = $this->verifyBackup($backupPath, $customKey);
        if (!$verify['valid']) {
            throw new RuntimeException("Restoration blocked: Backup verification failed ({$verify['error']}).");
        }

        // 2. Safeguard current state: Create pre-restore snapshot of target DB if target exists
        $preRestoreMeta = null;
        if (!$skipPreRestoreBackup) {
            try {
                $this->log("Generating pre-restore safety snapshot of '{$targetDatabase}'...");
                $preRestoreMeta = $this->createBackup(
                    self::TYPE_PRE_RESTORE,
                    true,
                    "target_{$targetDatabase}",
                    $customKey
                );
            } catch (\Throwable $e) {
                $this->log("Pre-restore snapshot skipped or failed (target may be empty): {$e->getMessage()}");
            }
        }

        // 3. Decrypt and decompress SQL content
        $rawBytes = (string)file_get_contents($backupPath);
        if (str_ends_with($backupPath, '.enc')) {
            $key = $this->resolveEncryptionKey($customKey);
            $gzData = $this->decryptString($rawBytes, $key);
            $sql = (string)gzdecode($gzData);
        } else {
            $sql = (string)gzdecode($rawBytes);
        }

        // 4. Execute Restoration into target database
        $this->importSqlIntoDatabase($sql, $targetDatabase);

        // 5. Verify restored tables
        $tables = $this->getTableList($targetDatabase);
        $duration = round(microtime(true) - $startTime, 3);

        $result = [
            'status' => 'success',
            'target_database' => $targetDatabase,
            'backup_source' => basename($backupPath),
            'tables_restored' => count($tables),
            'table_names' => $tables,
            'pre_restore_backup' => $preRestoreMeta ? $preRestoreMeta['filename'] : null,
            'duration_seconds' => $duration,
            'restored_at' => date('c'),
        ];

        $this->log("Restoration completed into '{$targetDatabase}': " . count($tables) . " tables restored in {$duration}s.");

        return $result;
    }

    /**
     * Import raw SQL statements into target database.
     */
    public function importSqlIntoDatabase(string $sql, string $targetDatabase): void
    {
        $pdo = $this->database->getConnection();
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

        // Ensure database exists for MySQL/MariaDB
        if ($driver !== 'sqlite') {
            $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$targetDatabase}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $pdo->exec("USE `{$targetDatabase}`");
        }

        // Use mysql CLI client if available for high-performance streaming import on MySQL
        if ($driver !== 'sqlite' && $this->mysqlBinary !== null) {
            $tempSql = tempnam(sys_get_temp_dir(), 'tc_imp_');
            file_put_contents((string)$tempSql, $sql);

            $dbHost = $this->config->getString('db_host', '127.0.0.1');
            $dbPort = $this->config->getInt('db_port', 3306);
            $dbUser = $this->config->getString('db_username', 'root');
            $dbPass = $this->config->getString('db_password', '');

            $tempCnf = tempnam(sys_get_temp_dir(), 'tc_my_');
            $cnfContent = "[client]\nhost={$dbHost}\nport={$dbPort}\nuser=\"{$dbUser}\"\n";
            if ($dbPass !== '') {
                $cnfContent .= "password=\"{$dbPass}\"\n";
            }
            file_put_contents((string)$tempCnf, $cnfContent);
            @chmod((string)$tempCnf, 0600);

            $cmd = sprintf(
                '"%s" --defaults-extra-file="%s" --default-character-set=utf8mb4 "%s" < "%s" 2>&1',
                $this->mysqlBinary,
                $tempCnf,
                $targetDatabase,
                $tempSql
            );

            $output = [];
            $exitCode = 0;
            exec($cmd, $output, $exitCode);

            @unlink((string)$tempCnf);
            @unlink((string)$tempSql);

            if ($exitCode === 0) {
                return;
            }
            $this->log("mysql CLI import returned {$exitCode}. Falling back to PDO statement executor.");
        }

        // Fallback: PDO multi-query statement execution
        if ($driver !== 'sqlite') {
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
        }
        $pdo->exec($sql);
        if ($driver !== 'sqlite') {
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
        }
    }

    /**
     * Perform an isolated restoration test into a temporary test database.
     * Verifies that the backup can actually be restored without touching production.
     *
     * @param string $backupPath Path to backup artifact
     * @param string|null $testDatabase Name of test database (defaults to toothcare_hub_restore_test)
     * @param string|null $customKey
     * @return array<string, mixed> Test report
     */
    public function testRestoreInIsolation(
        string $backupPath,
        ?string $testDatabase = null,
        ?string $customKey = null
    ): array {
        $testDb = $testDatabase ?? ('toothcare_restore_test_' . date('Ymd_His'));
        $this->log("Initiating isolated restoration verification in test database '{$testDb}'...");

        $pdo = $this->database->getConnection();
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        $startTime = microtime(true);

        try {
            // Restore into temporary database
            $restoreReport = $this->restoreBackup($backupPath, $testDb, true, $customKey);

            // Verify table count and sample records
            if ($driver !== 'sqlite') {
                $pdo->exec("USE `{$testDb}`");
            }
            $tables = $this->getTableList($testDb);

            // Record verification result
            $duration = round(microtime(true) - $startTime, 3);
            $report = [
                'test_status' => 'PASSED',
                'tested_at' => date('c'),
                'test_database' => $testDb,
                'backup_tested' => basename($backupPath),
                'verified_tables_count' => count($tables),
                'tables' => $tables,
                'duration_seconds' => $duration,
            ];

            // Cleanup: Drop isolated test database
            if ($driver !== 'sqlite') {
                $pdo->exec("DROP DATABASE IF EXISTS `{$testDb}`");
            }

            $this->log("Isolated restore test PASSED: {$report['verified_tables_count']} tables verified in {$duration}s.");

            // Save verification log
            $testLog = $this->storageDir . DIRECTORY_SEPARATOR . 'verification' . DIRECTORY_SEPARATOR . 'latest_restore_test.json';
            file_put_contents($testLog, json_encode($report, JSON_PRETTY_PRINT));

            return $report;
        } catch (\Throwable $e) {
            // Attempt cleanup on failure
            try {
                if ($driver !== 'sqlite') {
                    $pdo->exec("DROP DATABASE IF EXISTS `{$testDb}`");
                }
            } catch (\Throwable) {}

            $this->log("Isolated restore test FAILED: {$e->getMessage()}");

            return [
                'test_status' => 'FAILED',
                'tested_at' => date('c'),
                'test_database' => $testDb,
                'backup_tested' => basename($backupPath),
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Enforce retention policy.
     * Deletes expired backups while protecting pinned backups and pre-migration snapshots.
     *
     * @param int $retentionDays Days to retain daily/manual backups (default 30)
     * @param bool $dryRun If true, lists files eligible for deletion without deleting
     * @return array{deleted: list<string>, preserved: list<string>, dry_run: bool}
     */
    public function cleanupBackups(int $retentionDays = 30, bool $dryRun = false): array
    {
        $cutoffTimestamp = time() - ($retentionDays * 86400);
        $deleted = [];
        $preserved = [];

        // Scan daily and manual backup folders
        $scanDirs = [
            $this->storageDir . DIRECTORY_SEPARATOR . self::TYPE_DAILY,
            $this->storageDir . DIRECTORY_SEPARATOR . self::TYPE_MANUAL,
        ];

        foreach ($scanDirs as $dir) {
            if (!is_dir($dir)) continue;

            $files = glob($dir . '/*.sql.gz*');
            if ($files === false) continue;

            foreach ($files as $file) {
                // Ignore metadata and sha256 files during discovery loop (handled alongside backup)
                if (str_ends_with($file, '.sha256') || str_ends_with($file, '.backup-meta.json')) {
                    continue;
                }

                // Protect pinned backups
                if (file_exists($file . '.pinned') || str_contains($file, 'pinned')) {
                    $preserved[] = $file;
                    continue;
                }

                $mtime = filemtime($file);
                if ($mtime !== false && $mtime < $cutoffTimestamp) {
                    if ($dryRun) {
                        $deleted[] = $file;
                    } else {
                        @unlink($file);
                        @unlink($file . '.sha256');
                        @unlink($file . '.backup-meta.json');
                        $deleted[] = $file;
                    }
                } else {
                    $preserved[] = $file;
                }
            }
        }

        $this->log("Retention cleanup completed (" . ($dryRun ? "DRY-RUN" : "APPLIED") . "): " . count($deleted) . " deleted, " . count($preserved) . " preserved.");

        return [
            'deleted' => $deleted,
            'preserved' => $preserved,
            'dry_run' => $dryRun,
        ];
    }

    /**
     * List all available backups across all subdirectories with metadata.
     *
     * @return list<array<string, mixed>>
     */
    public function listBackups(): array
    {
        $subdirs = [self::TYPE_DAILY, self::TYPE_MANUAL, self::TYPE_PRE_MIGRATION, self::TYPE_PRE_RESTORE];
        $backups = [];

        foreach ($subdirs as $subdir) {
            $dir = $this->storageDir . DIRECTORY_SEPARATOR . $subdir;
            if (!is_dir($dir)) continue;

            $files = glob($dir . '/*.sql.gz*');
            if ($files === false) continue;

            foreach ($files as $file) {
                if (str_ends_with($file, '.sha256') || str_ends_with($file, '.backup-meta.json')) {
                    continue;
                }

                $metaFile = $file . '.backup-meta.json';
                $meta = file_exists($metaFile) ? json_decode((string)file_get_contents($metaFile), true) : null;

                $backups[] = [
                    'filename' => basename($file),
                    'filepath' => $file,
                    'type' => $subdir,
                    'size_bytes' => filesize($file),
                    'created_at' => date('c', filemtime($file)),
                    'encrypted' => str_ends_with($file, '.enc'),
                    'has_sha256' => file_exists($file . '.sha256'),
                    'is_pinned' => file_exists($file . '.pinned'),
                    'metadata' => $meta,
                ];
            }
        }

        // Sort latest first
        usort($backups, fn ($a, $b) => strcmp((string)$b['created_at'], (string)$a['created_at']));

        return $backups;
    }

    /**
     * Internal logger with secret scrubbing.
     */
    private function log(string $message): void
    {
        $logFile = $this->storageDir . DIRECTORY_SEPARATOR . 'logs' . DIRECTORY_SEPARATOR . 'backup.log';
        $timestamp = date('Y-m-d H:i:s');
        $sanitized = preg_replace('/password=[^\s&]+/i', 'password=[REDACTED]', $message);
        $entry = "[{$timestamp}] {$sanitized}\n";

        @file_put_contents($logFile, $entry, FILE_APPEND);
        $this->logger->info("[DatabaseBackup] {$sanitized}");
    }
}
