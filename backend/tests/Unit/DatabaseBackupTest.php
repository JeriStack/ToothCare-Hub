<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\Config;
use App\Core\Database;
use App\Core\Logger;
use App\Services\DatabaseBackupService;
use PDO;
use PHPUnit\Framework\TestCase;

class DatabaseBackupTest extends TestCase
{
    private string $testStorageDir;
    private Database $mockDatabase;
    private Config $config;
    private Logger $logger;
    private PDO $sqlitePdo;

    protected function setUp(): void
    {
        parent::setUp();

        $this->testStorageDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'tc_backup_test_' . uniqid();
        @mkdir($this->testStorageDir, 0777, true);

        // In-memory SQLite PDO for isolated testing
        $this->sqlitePdo = new PDO('sqlite::memory:');
        $this->sqlitePdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // Create representative schema tables
        $this->sqlitePdo->exec("
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                role TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1
            );
            CREATE TABLE patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                phone TEXT NOT NULL
            );
            INSERT INTO users (email, role, is_active) VALUES ('test@example.com', 'PATIENT', 1);
            INSERT INTO patients (user_id, first_name, last_name, phone) VALUES (1, 'Maria', 'Santos', '+639171234567');
        ");

        $this->config = new Config();
        $this->config->set('db_database', 'toothcare_test');
        $this->config->set('backup_storage_dir', $this->testStorageDir);
        $this->config->set('backup_encryption_enabled', true);
        $this->config->set('backup_encryption_key', base64_encode(random_bytes(32)));

        $this->logger = new Logger($this->testStorageDir . '/test.log');

        $this->mockDatabase = new Database($this->config, $this->logger);
        $this->mockDatabase->setConnection($this->sqlitePdo);
    }

    protected function tearDown(): void
    {
        $this->removeDirectory($this->testStorageDir);
        parent::tearDown();
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) return;
        $files = array_diff(scandir($dir) ?: [], ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . DIRECTORY_SEPARATOR . $file;
            is_dir($path) ? $this->removeDirectory($path) : @unlink($path);
        }
        @rmdir($dir);
    }

    public function testGzipCompressionAndDecompression(): void
    {
        $payload = str_repeat("ToothCare Hub Clinical Procedure Data Record -- Standardized Backup\n", 50);
        $compressed = gzencode($payload, 9);

        $this->assertNotFalse($compressed);
        $this->assertLessThan(strlen($payload), strlen($compressed));

        $decompressed = gzdecode($compressed);
        $this->assertSame($payload, $decompressed);
    }

    public function testAuthenticatedAes256GcmEncryptionAndDecryption(): void
    {
        $service = new DatabaseBackupService($this->mockDatabase, $this->config, $this->logger, $this->testStorageDir);
        $key = base64_encode(random_bytes(32));
        $plaintext = "SUPER_SECRET_PATIENT_MEDICAL_HISTORY: Hypertension, Penicillin Allergy";

        $encrypted = $service->encryptString($plaintext, $key);

        // Header structure check: 12-byte IV + 16-byte Tag + Ciphertext
        $minExpectedLength = DatabaseBackupService::IV_LENGTH + DatabaseBackupService::TAG_LENGTH;
        $this->assertGreaterThan($minExpectedLength, strlen($encrypted));

        $decrypted = $service->decryptString($encrypted, $key);
        $this->assertSame($plaintext, $decrypted);
    }

    public function testDecryptionFailsWithWrongKey(): void
    {
        $service = new DatabaseBackupService($this->mockDatabase, $this->config, $this->logger, $this->testStorageDir);
        $keyA = base64_encode(random_bytes(32));
        $keyB = base64_encode(random_bytes(32));

        $encrypted = $service->encryptString("Confidential Clinic Data", $keyA);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/AES-256-GCM decryption failed/i');

        $service->decryptString($encrypted, $keyB);
    }

    public function testDecryptionFailsOnTamperedCiphertext(): void
    {
        $service = new DatabaseBackupService($this->mockDatabase, $this->config, $this->logger, $this->testStorageDir);
        $key = base64_encode(random_bytes(32));

        $encrypted = $service->encryptString("Untampered Clinical Data", $key);

        // Flip a byte in the ciphertext payload
        $tampered = $encrypted;
        $tampered[strlen($tampered) - 1] = chr(ord($tampered[strlen($tampered) - 1]) ^ 0xFF);

        $this->expectException(\RuntimeException::class);
        $service->decryptString($tampered, $key);
    }

    public function testFullBackupCreationAndVerification(): void
    {
        $service = new DatabaseBackupService($this->mockDatabase, $this->config, $this->logger, $this->testStorageDir);

        $meta = $service->createBackup(DatabaseBackupService::TYPE_MANUAL, true, 'unit-test');

        $this->assertSame('success', $meta['status']);
        $this->assertTrue($meta['verified']);
        $this->assertTrue($meta['encrypted']);
        $this->assertSame('SHA-256', $meta['checksum_algorithm']);
        $this->assertSame(2, $meta['table_count']); // users and patients
        $this->assertFileExists($meta['filepath']);
        $this->assertFileExists($meta['filepath'] . '.sha256');
        $this->assertFileExists($meta['filepath'] . '.backup-meta.json');

        // Run independent verification
        $verification = $service->verifyBackup($meta['filepath']);
        $this->assertTrue($verification['valid']);
        $this->assertNull($verification['error']);
        $this->assertNotNull($verification['metadata']);
    }

    public function testVerificationFailsOnCorruptedBackupFile(): void
    {
        $service = new DatabaseBackupService($this->mockDatabase, $this->config, $this->logger, $this->testStorageDir);

        $meta = $service->createBackup(DatabaseBackupService::TYPE_MANUAL, false, 'unencrypted-test');
        $filePath = $meta['filepath'];

        // Corrupt file by appending garbage
        file_put_contents($filePath, "CORRUPTED_DATA_INJECTION", FILE_APPEND);

        $verification = $service->verifyBackup($filePath);
        $this->assertFalse($verification['valid']);
        $this->assertStringContainsString('Checksum mismatch', (string)$verification['error']);
    }

    public function testRestorationWorkflow(): void
    {
        $service = new DatabaseBackupService($this->mockDatabase, $this->config, $this->logger, $this->testStorageDir);

        // 1. Create verified backup
        $meta = $service->createBackup(DatabaseBackupService::TYPE_DAILY, true, 'restore-test');

        // 2. Drop existing tables to test recovery
        $this->sqlitePdo->exec("DROP TABLE users; DROP TABLE patients;");
        $this->assertEmpty($service->getTableList('toothcare_test'));

        // 3. Perform restoration
        $restoreResult = $service->restoreBackup($meta['filepath'], 'toothcare_test', true);

        $this->assertSame('success', $restoreResult['status']);
        $this->assertContains('users', $restoreResult['table_names']);
        $this->assertContains('patients', $restoreResult['table_names']);

        // 4. Verify patient record was restored
        $stmt = $this->sqlitePdo->query("SELECT * FROM patients WHERE id = 1");
        $patient = $stmt->fetch(PDO::FETCH_ASSOC);
        $this->assertNotEmpty($patient);
        $this->assertSame('Maria', $patient['first_name']);
        $this->assertSame('Santos', $patient['last_name']);
    }

    public function testRetentionCleanupAndDryRun(): void
    {
        $service = new DatabaseBackupService($this->mockDatabase, $this->config, $this->logger, $this->testStorageDir);

        $dailyDir = $this->testStorageDir . DIRECTORY_SEPARATOR . DatabaseBackupService::TYPE_DAILY;

        // Create 1 fresh backup and 1 aged backup (35 days old)
        $freshFile = $dailyDir . DIRECTORY_SEPARATOR . 'toothcare_hub_2026-11-07_02-00-00.sql.gz';
        file_put_contents($freshFile, "FRESH_BACKUP");
        touch($freshFile, time() - (5 * 86400)); // 5 days old

        $agedFile = $dailyDir . DIRECTORY_SEPARATOR . 'toothcare_hub_2026-09-01_02-00-00.sql.gz';
        file_put_contents($agedFile, "AGED_BACKUP");
        file_put_contents($agedFile . '.sha256', "aged-hash");
        touch($agedFile, time() - (35 * 86400)); // 35 days old

        // 1. Dry run cleanup: should identify aged backup without deleting
        $dryRun = $service->cleanupBackups(30, true);
        $this->assertTrue($dryRun['dry_run']);
        $this->assertCount(1, $dryRun['deleted']);
        $this->assertFileExists($agedFile); // Must still exist

        // 2. Enforce cleanup: should delete aged backup and companion sha256
        $enforced = $service->cleanupBackups(30, false);
        $this->assertFalse($enforced['dry_run']);
        $this->assertCount(1, $enforced['deleted']);
        $this->assertFileDoesNotExist($agedFile);
        $this->assertFileDoesNotExist($agedFile . '.sha256');
        $this->assertFileExists($freshFile); // Fresh backup preserved
    }
}
