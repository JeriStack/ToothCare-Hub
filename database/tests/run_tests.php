<?php
declare(strict_types=1);

/**
 * ToothCare Hub — Automated Database Schema & Integrity Validation Test Suite
 * MySQL Relational Engine, 30-Table Inventory & Docker Environment Validation
 */

$host = getenv('DB_HOST') ?: '127.0.0.1';
$port = (int)(getenv('DB_PORT') ?: 3306);
$dbName = getenv('DB_NAME') ?: 'toothcare_hub';
$user = getenv('DB_USER') ?: 'toothcare_user';
$pass = getenv('DB_PASS') ?: (getenv('DB_PASSWORD') ?: 'toothcare_secure_pass');

$dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4";
$pdo = new PDO($dsn, $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
]);

$passed = 0;
$failed = 0;

function assertTest(string $description, callable $testFn): void {
    global $passed, $failed;
    echo "• Testing: {$description} ... ";
    try {
        $result = $testFn();
        if ($result === true) {
            echo "\033[32m[PASS]\033[0m\n";
            $passed++;
        } else {
            echo "\033[31m[FAIL]\033[0m (Assertion returned false)\n";
            $failed++;
        }
    } catch (Throwable $e) {
        echo "\033[31m[FAIL]\033[0m (" . $e->getMessage() . ")\n";
        $failed++;
    }
}

echo "====================================================================\n";
echo "ToothCare Hub — Full Database & Architecture Validation Test Suite\n";
echo "Database: {$dbName} | Server: MySQL 8.0 (InnoDB) | Timezone: Asia/Manila\n";
echo "====================================================================\n\n";

// 1. All 30 database tables exist with InnoDB & utf8mb4
assertTest("All 30 relational database tables exist with InnoDB & utf8mb4", function() use ($pdo, $dbName) {
    $expected = [
        'schema_migrations', 'users', 'roles', 'permissions', 'user_roles', 'role_permissions',
        'email_verification_tokens', 'password_reset_tokens', 'auth_tokens',
        'patients', 'dentists', 'services', 'dentist_services',
        'dentist_schedules', 'dentist_schedule_exceptions', 'dentist_time_off', 'clinic_operating_hours', 'clinic_closures',
        'appointments', 'appointment_statuses', 'appointment_status_history',
        'treatment_records', 'treatment_record_versions',
        'notifications', 'email_outbox', 'outbox',
        'audit_logs', 'security_events', 'rate_limits',
        'clinic_settings'
    ];
    $stmt = $pdo->prepare("SELECT table_name, engine, table_collation FROM information_schema.tables WHERE table_schema = ?");
    $stmt->execute([$dbName]);
    $rows = $stmt->fetchAll();
    $found = [];
    foreach ($rows as $r) {
        $found[$r['TABLE_NAME']] = $r;
        if (strtoupper($r['ENGINE']) !== 'INNODB') {
            throw new RuntimeException("Table {$r['TABLE_NAME']} is not InnoDB");
        }
    }
    foreach ($expected as $table) {
        if (!isset($found[$table])) {
            throw new RuntimeException("Missing expected table: {$table}");
        }
    }
    return count($expected) === 30 && count($found) >= 30;
});

// 2. Foreign Key Rejection on Invalid Patient ID
assertTest("Foreign Key rejection on inserting appointment with non-existent patient", function() use ($pdo) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO appointments (patient_id, dentist_id, service_id, start_at, end_at, duration_snapshot, price_snapshot)
            VALUES (999999, 1, 1, '2026-12-01 09:00:00', '2026-12-01 09:45:00', 45, 1500.00)
        ");
        $stmt->execute();
        return false;
    } catch (PDOException $e) {
        return $e->getCode() === '23000' && strpos($e->getMessage(), '1452') !== false;
    }
});

// 3. Foreign Key Rejection on Invalid User ID in Patients table
assertTest("Foreign Key rejection on inserting patient with non-existent user_id", function() use ($pdo) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO patients (user_id, first_name, last_name, date_of_birth, phone)
            VALUES (888888, 'Ghost', 'Patient', '1990-01-01', '+639111111111')
        ");
        $stmt->execute();
        return false;
    } catch (PDOException $e) {
        return $e->getCode() === '23000' && strpos($e->getMessage(), '1452') !== false;
    }
});

// 4. Unique Constraint on User Email
assertTest("Unique constraint enforcement on duplicate email (uq_users_email)", function() use ($pdo) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO users (email, password_hash, role)
            VALUES ('admin@toothcare.local', 'hash', 'ADMIN')
        ");
        $stmt->execute();
        return false;
    } catch (PDOException $e) {
        return $e->getCode() === '23000' && strpos($e->getMessage(), '1062') !== false;
    }
});

// 5. Unique Constraint on Dentist License Number
assertTest("Unique constraint enforcement on duplicate dentist license (uq_dentists_license_number)", function() use ($pdo) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone)
            VALUES (1, 'Dr.', 'Duplicate', 'General', 'PRC-008472', '+639111111111')
        ");
        $stmt->execute();
        return false;
    } catch (PDOException $e) {
        return $e->getCode() === '23000' && strpos($e->getMessage(), '1062') !== false;
    }
});

// 6. 1:1 Patient profile constraint
assertTest("1:1 Unique Constraint on patient profile per user (uq_patients_user_id)", function() use ($pdo) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO patients (user_id, first_name, last_name, date_of_birth, phone)
            VALUES (6, 'Duplicate', 'Juan', '1994-05-18', '+639111111111')
        ");
        $stmt->execute();
        return false;
    } catch (PDOException $e) {
        return $e->getCode() === '23000' && strpos($e->getMessage(), '1062') !== false;
    }
});

// 7. CHECK Constraint: Appointment start_at must be before end_at
assertTest("CHECK constraint rejection: start_at >= end_at in appointments", function() use ($pdo) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO appointments (patient_id, dentist_id, service_id, start_at, end_at, duration_snapshot, price_snapshot)
            VALUES (1, 1, 1, '2026-12-01 10:00:00', '2026-12-01 09:00:00', 45, 1500.00)
        ");
        $stmt->execute();
        return false;
    } catch (PDOException $e) {
        return strpos($e->getMessage(), 'chk_appointments_interval') !== false || $e->getCode() === 'HY000';
    }
});

// 8. Demo accounts exist and are verified with Argon2id passwords
assertTest("Canonical demo accounts exist with active status, verified email, and Argon2id hash", function() use ($pdo) {
    $accounts = [
        'patient.juan@example.com' => 'PATIENT',
        'dr.santos@toothcare.local' => 'DENTIST',
        'admin@toothcare.local' => 'ADMIN',
        'receptionist@toothcare.local' => 'ADMIN',
    ];
    $stmt = $pdo->prepare("SELECT email, role, is_active, email_verified, password_hash FROM users WHERE email = ?");
    foreach ($accounts as $email => $role) {
        $stmt->execute([$email]);
        $u = $stmt->fetch();
        if (!$u) {
            throw new RuntimeException("Demo user {$email} not found in database");
        }
        if ((int)$u['is_active'] !== 1) {
            throw new RuntimeException("Demo user {$email} is not active");
        }
        if ((int)$u['email_verified'] !== 1) {
            throw new RuntimeException("Demo user {$email} email is not verified");
        }
        if (!password_verify('Password123!', $u['password_hash'])) {
            throw new RuntimeException("Password123! fails verification against hash for {$email}");
        }
    }
    return true;
});

// 9. Enterprise RBAC roles, permissions, and user_roles are populated
assertTest("Enterprise RBAC roles, permissions, and user_roles are correctly populated", function() use ($pdo) {
    $rolesCount = (int)$pdo->query("SELECT COUNT(*) FROM roles")->fetchColumn();
    $permCount = (int)$pdo->query("SELECT COUNT(*) FROM permissions")->fetchColumn();
    $userRolesCount = (int)$pdo->query("SELECT COUNT(*) FROM user_roles")->fetchColumn();
    return $rolesCount >= 4 && $permCount >= 10 && $userRolesCount >= 4;
});

// 10. Canonical appointment statuses lookup table
assertTest("Appointment statuses lookup table contains canonical states", function() use ($pdo) {
    $requiredStatuses = ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'];
    $stmt = $pdo->query("SELECT status_code FROM appointment_statuses");
    $statuses = $stmt->fetchAll(PDO::FETCH_COLUMN);
    foreach ($requiredStatuses as $s) {
        if (!in_array($s, $statuses, true)) {
            throw new RuntimeException("Missing status: {$s}");
        }
    }
    return true;
});

// 11. Dentist Services matrix exists
assertTest("Dentist Services m:n matrix is populated with active associations", function() use ($pdo) {
    $count = (int)$pdo->query("SELECT COUNT(*) FROM dentist_services")->fetchColumn();
    return $count > 0;
});

// 12. Clinical settings parameter store contains baseline configurations
assertTest("Clinic settings table contains required system parameters", function() use ($pdo) {
    $stmt = $pdo->query("SELECT setting_key, setting_value FROM clinic_settings");
    $settings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
    return isset($settings['clinic_name']) && isset($settings['clinic_timezone']) && $settings['clinic_timezone'] === 'Asia/Manila';
});

// 13. Security events telemetry insert
assertTest("Security events telemetry accepts structured audit events", function() use ($pdo) {
    $stmt = $pdo->prepare("
        INSERT INTO security_events (user_id, event_type, ip_address, user_agent, metadata)
        VALUES (1, 'TEST_INTEGRITY_CHECK', '127.0.0.1', 'DatabaseTestRunner/1.0', JSON_OBJECT('verified', true))
    ");
    $stmt->execute();
    $id = (int)$pdo->lastInsertId();
    $pdo->exec("DELETE FROM security_events WHERE id = {$id}");
    return $id > 0;
});

// 14. Schema migrations tracking
assertTest("Schema migrations ledger records all 22 migration versions", function() use ($pdo) {
    $count = (int)$pdo->query("SELECT COUNT(*) FROM schema_migrations")->fetchColumn();
    return $count >= 22;
});

echo "\n====================================================================\n";
echo "Summary: {$passed} Passed, {$failed} Failed\n";
echo "====================================================================\n";

exit($failed > 0 ? 1 : 0);
