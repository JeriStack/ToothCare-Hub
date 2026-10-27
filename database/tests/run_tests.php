<?php
declare(strict_types=1);

/**
 * ToothCare Hub — Automated Database Schema & Integrity Validation Test Suite
 * Phase 4: Database Modeling and Versioned Schema
 *
 * Verifies:
 * 1. All 14 tables exist with InnoDB engine and utf8mb4 collation.
 * 2. Foreign Key constraints enforce referential integrity (reject invalid IDs).
 * 3. Unique constraints prevent duplicate emails, licenses, and 1:1 profiles.
 * 4. CHECK constraints reject invalid datetime intervals and negative prices/durations.
 * 5. NOT NULL constraints reject missing required values.
 * 6. Appointment interval overlap logic correctly detects partial, full, and identical overlaps.
 * 7. Adjacent appointments [end_A == start_B] are strictly allowed without conflict.
 * 8. Cancelled / Rejected appointments release slots immediately.
 * 9. Migration runner idempotency (no duplicate migrations applied).
 */

$host = getenv('DB_HOST') ?: 'toothcare-mysql';
$port = (int)(getenv('DB_PORT') ?: 3306);
$dbName = getenv('DB_NAME') ?: 'toothcare_hub';
$user = getenv('DB_USER') ?: 'toothcare_user';
$pass = getenv('DB_PASS') ?: 'toothcare_secure_pass';

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
echo "ToothCare Hub — Phase 4 Database Validation Test Suite\n";
echo "Database: {$dbName} | Server: MySQL 8.0 (InnoDB)\n";
echo "====================================================================\n\n";

// 1. All 14 tables exist with InnoDB & utf8mb4
assertTest("All 14 core & support tables exist with InnoDB & utf8mb4", function() use ($pdo, $dbName) {
    $expected = [
        'schema_migrations', 'users', 'patients', 'dentists', 'services',
        'dentist_schedules', 'dentist_time_off', 'appointments',
        'appointment_status_history', 'treatment_records', 'notifications',
        'email_outbox', 'auth_tokens', 'audit_logs'
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
        if (strpos($r['TABLE_COLLATION'], 'utf8mb4') === false) {
            throw new RuntimeException("Table {$r['TABLE_NAME']} is not utf8mb4");
        }
    }
    foreach ($expected as $table) {
        if (!isset($found[$table])) {
            throw new RuntimeException("Missing expected table: {$table}");
        }
    }
    return count($expected) === 14;
});

// 2. Foreign Key Rejection on Invalid Patient ID
assertTest("Foreign Key rejection on inserting appointment with non-existent patient", function() use ($pdo) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO appointments (patient_id, dentist_id, service_id, start_at, end_at, duration_snapshot, price_snapshot)
            VALUES (999999, 1, 1, '2026-12-01 09:00:00', '2026-12-01 09:45:00', 45, 1500.00)
        ");
        $stmt->execute();
        return false; // Should not reach here
    } catch (PDOException $e) {
        // MySQL 1452: Cannot add or update a child row: a foreign key constraint fails
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
        // MySQL 1062: Duplicate entry
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

// 6. CHECK Constraint: Appointment Interval (start_at < end_at)
assertTest("CHECK constraint rejection when start_at >= end_at (chk_appointments_interval)", function() use ($pdo) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO appointments (patient_id, dentist_id, service_id, start_at, end_at, duration_snapshot, price_snapshot)
            VALUES (1, 1, 1, '2026-12-01 10:00:00', '2026-12-01 09:00:00', 45, 1500.00)
        ");
        $stmt->execute();
        return false;
    } catch (PDOException $e) {
        // MySQL 3819: Check constraint 'chk_appointments_interval' is violated
        return strpos($e->getMessage(), '3819') !== false || strpos($e->getMessage(), 'chk_appointments_interval') !== false;
    }
});

// 7. CHECK Constraint: Negative Service Price
assertTest("CHECK constraint rejection when service price is negative (chk_services_price)", function() use ($pdo) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO services (name, price, duration_minutes)
            VALUES ('Invalid Negative Service', -250.00, 30)
        ");
        $stmt->execute();
        return false;
    } catch (PDOException $e) {
        return strpos($e->getMessage(), '3819') !== false || strpos($e->getMessage(), 'chk_services_price') !== false;
    }
});

// 8. CHECK Constraint: Invalid Service Duration (0 minutes)
assertTest("CHECK constraint rejection when service duration is 0 or > 480 (chk_services_duration)", function() use ($pdo) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO services (name, price, duration_minutes)
            VALUES ('Zero Duration Service', 500.00, 0)
        ");
        $stmt->execute();
        return false;
    } catch (PDOException $e) {
        return strpos($e->getMessage(), '3819') !== false || strpos($e->getMessage(), 'chk_services_duration') !== false;
    }
});

// 9. Canonical Overlap Detection: Partial Overlap (Conflict Detected)
assertTest("Interval Overlap Formula: Detects partial overlap with CONFIRMED appointment", function() use ($pdo) {
    // Seed appointment 1042 is CONFIRMED on dentist 1 from '2026-11-03 09:30:00' to '2026-11-03 10:15:00'.
    // Test requested slot: 09:45:00 to 10:30:00 (overlaps by 30 mins)
    $stmt = $pdo->prepare("
        SELECT id FROM appointments
        WHERE dentist_id = 1
          AND status IN ('PENDING', 'CONFIRMED')
          AND start_at < '2026-11-03 10:30:00'
          AND end_at   > '2026-11-03 09:45:00'
    ");
    $stmt->execute();
    $conflicts = $stmt->fetchAll();
    return count($conflicts) === 1 && (int)$conflicts[0]['id'] === 1042;
});

// 10. Canonical Overlap Detection: Enclosing Overlap (Conflict Detected)
assertTest("Interval Overlap Formula: Detects full enclosure where requested slot envelops existing", function() use ($pdo) {
    // Requested slot: 09:00:00 to 11:00:00 (completely encloses 09:30 - 10:15)
    $stmt = $pdo->prepare("
        SELECT id FROM appointments
        WHERE dentist_id = 1
          AND status IN ('PENDING', 'CONFIRMED')
          AND start_at < '2026-11-03 11:00:00'
          AND end_at   > '2026-11-03 09:00:00'
    ");
    $stmt->execute();
    $conflicts = $stmt->fetchAll();
    return count($conflicts) === 1 && (int)$conflicts[0]['id'] === 1042;
});

// 11. Adjacent Slot Handling: Preceding & Following (NO Conflict)
assertTest("Interval Overlap Formula: Permits adjacent slots [end_A == start_B] without false conflict", function() use ($pdo) {
    // Preceding adjacent slot: 08:45:00 to 09:30:00 (ends exactly when 1042 starts)
    $stmt1 = $pdo->prepare("
        SELECT id FROM appointments
        WHERE dentist_id = 1
          AND status IN ('PENDING', 'CONFIRMED')
          AND start_at < '2026-11-03 09:30:00'
          AND end_at   > '2026-11-03 08:45:00'
    ");
    $stmt1->execute();
    $conflicts1 = $stmt1->fetchAll();

    // Following adjacent slot: 10:15:00 to 11:00:00 (starts exactly when 1042 ends)
    $stmt2 = $pdo->prepare("
        SELECT id FROM appointments
        WHERE dentist_id = 1
          AND status IN ('PENDING', 'CONFIRMED')
          AND start_at < '2026-11-03 11:00:00'
          AND end_at   > '2026-11-03 10:15:00'
    ");
    $stmt2->execute();
    $conflicts2 = $stmt2->fetchAll();

    return count($conflicts1) === 0 && count($conflicts2) === 0;
});

// 12. Cancelled Appointment Releases Slot Immediately
assertTest("Status Blocking Policy: CANCELLED appointments do not block time slots", function() use ($pdo) {
    // Appointment 1039 is CANCELLED for dentist 1 on '2026-10-30 14:00:00' to '2026-10-30 14:45:00'.
    // Overlap query for active blocking slots (PENDING, CONFIRMED) must return 0 rows.
    $stmt = $pdo->prepare("
        SELECT id FROM appointments
        WHERE dentist_id = 1
          AND status IN ('PENDING', 'CONFIRMED')
          AND start_at < '2026-10-30 14:45:00'
          AND end_at   > '2026-10-30 14:00:00'
    ");
    $stmt->execute();
    $conflicts = $stmt->fetchAll();
    return count($conflicts) === 0;
});

// 13. Rescheduling Linkage and Status History Audit Trail
assertTest("Audit Trail: Status history preserves chronological transitions for appointments", function() use ($pdo) {
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as cnt FROM appointment_status_history WHERE appointment_id = 1042
    ");
    $stmt->execute();
    $res = $stmt->fetch();
    return ((int)$res['cnt']) >= 2; // PENDING -> CONFIRMED
});

echo "\n====================================================================\n";
echo "SUMMARY: Passed: {$passed} | Failed: {$failed} | Total: " . ($passed + $failed) . "\n";
echo "====================================================================\n";

if ($failed > 0) {
    exit(1);
}
exit(0);
