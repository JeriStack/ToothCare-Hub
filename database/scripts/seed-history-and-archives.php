<?php

declare(strict_types=1);

/**
 * ToothCare Hub — Repeatable Synthetic Seed Script for History Records & Archive Management (Phase 8)
 *
 * Strictly synthetic (`@synthetic.toothcare.example`), idempotent, and non-destructive:
 * never overwrites or deletes existing development records.
 *
 * Seeds:
 *   - 10 Synthetic Patients, 5 Dentists, 4 Receptionists, 3 Administrators
 *   - 105+ realistic history events across Patient, Dentist, Receptionist, Administrator,
 *     Appointment lifecycle, and Security scenarios (with Before/After value diffs)
 *   - 10 realistic Archive & Restoration records across all 4 account categories
 *     (including multi-cycle ARCHIVED -> RESTORED -> REARCHIVED history)
 *
 * Usage:
 *   php database/scripts/seed-history-and-archives.php
 */

$dbHost = getenv('DB_HOST') ?: '127.0.0.1';
$dbPort = (int) (getenv('DB_PORT') ?: 3306);
$dbName = getenv('DB_NAME') ?: 'toothcare_hub';
$dbUser = getenv('DB_USER') ?: 'toothcare_user';
$dbPass = getenv('DB_PASSWORD') ?: 'toothcare_secure_pass';

echo "====================================================================\n";
echo "ToothCare Hub — Synthetic History & Archive Seeder (Idempotent)\n";
echo "Target Database: {$dbName} on {$dbHost}:{$dbPort}\n";
echo "====================================================================\n";

$pdo = new PDO(
    "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4",
    $dbUser,
    $dbPass,
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]
);

$passwordHash = password_hash('SyntheticDemo!2026', PASSWORD_BCRYPT);

$ensureUser = static function (PDO $pdo, string $email, string $first, string $last, string $role, int $isActive) use ($passwordHash): int {
    $find = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $find->execute([$email]);
    $existing = $find->fetchColumn();
    if ($existing) {
        return (int) $existing;
    }

    $ins = $pdo->prepare('
        INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, email_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
    ');
    $ins->execute([$email, $passwordHash, $first, $last, $role, $isActive]);
    return (int) $pdo->lastInsertId();
};

// 1. Seed 3 Synthetic Administrators (1 archived to demonstrate archived-admin audit attribution)
$adminSpecs = [
    ['syn.admin1@synthetic.toothcare.example', 'Clarissa', 'Bautista', 1],
    ['syn.admin2@synthetic.toothcare.example', 'Eduardo', 'Salazar', 1],
    ['syn.admin3.archived@synthetic.toothcare.example', 'Nora', 'Villanueva', 0],
];
$adminIds = [];
foreach ($adminSpecs as [$email, $fn, $ln, $active]) {
    $adminIds[] = $ensureUser($pdo, $email, $fn, $ln, 'ADMIN', $active);
}

// 2. Seed 4 Synthetic Receptionists (1 archived, 1 restored)
$recSpecs = [
    ['syn.rec1@synthetic.toothcare.example', 'Camille', 'Aquino', 1],
    ['syn.rec2@synthetic.toothcare.example', 'Jerome', 'Pascual', 1],
    ['syn.rec3.archived@synthetic.toothcare.example', 'Bianca', 'Soriano', 0],
    ['syn.rec4.restored@synthetic.toothcare.example', 'Paolo', 'Mercado', 1],
];
$recIds = [];
foreach ($recSpecs as [$email, $fn, $ln, $active]) {
    $recIds[] = $ensureUser($pdo, $email, $fn, $ln, 'RECEPTIONIST', $active);
}

// 3. Seed 5 Synthetic Dentists (1 archived after appointment resolution)
$dentistSpecs = [
    ['syn.dentist1@synthetic.toothcare.example', 'Marisol', 'Del Rosario', 'General Dentistry', 'PRC-SYN-1001', 1],
    ['syn.dentist2@synthetic.toothcare.example', 'Lorenzo', 'Castillo', 'Orthodontics', 'PRC-SYN-1002', 1],
    ['syn.dentist3@synthetic.toothcare.example', 'Teresa', 'Ocampo', 'Endodontics', 'PRC-SYN-1003', 1],
    ['syn.dentist4@synthetic.toothcare.example', 'Gabriel', 'Navarro', 'Periodontics', 'PRC-SYN-1004', 1],
    ['syn.dentist5.archived@synthetic.toothcare.example', 'Hector', 'Dizon', 'Prosthodontics', 'PRC-SYN-1005', 0],
];
$dentistIds = [];
$dentistUserIds = [];
foreach ($dentistSpecs as $idx => [$email, $fn, $ln, $spec, $lic, $active]) {
    $uid = $ensureUser($pdo, $email, $fn, $ln, 'DENTIST', $active);
    $dentistUserIds[] = $uid;
    $find = $pdo->prepare('SELECT id FROM dentists WHERE user_id = ? LIMIT 1');
    $find->execute([$uid]);
    $did = $find->fetchColumn();
    if (!$did) {
        $ins = $pdo->prepare('
            INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ');
        $ins->execute([$uid, $fn, $ln, $spec, $lic, '+63 917 500 100' . ($idx + 1), $active]);
        $did = $pdo->lastInsertId();
    }
    $dentistIds[] = (int) $did;
}

// 4. Seed 10 Synthetic Patients (2 archived, 1 restored)
$patientSpecs = [
    ['syn.pat01@synthetic.toothcare.example', 'Andrea', 'Lopez', 'FEMALE', '1993-04-12', 1],
    ['syn.pat02@synthetic.toothcare.example', 'Mateo', 'Fernandez', 'MALE', '1988-09-21', 1],
    ['syn.pat03@synthetic.toothcare.example', 'Sofia', 'Reyes', 'FEMALE', '1996-02-05', 1],
    ['syn.pat04@synthetic.toothcare.example', 'Daniel', 'Gomez', 'MALE', '1990-11-18', 1],
    ['syn.pat05@synthetic.toothcare.example', 'Isabella', 'Cruz', 'FEMALE', '1995-07-30', 1],
    ['syn.pat06@synthetic.toothcare.example', 'Lucas', 'Mendoza', 'MALE', '1984-12-03', 1],
    ['syn.pat07@synthetic.toothcare.example', 'Mia', 'Torres', 'FEMALE', '1999-06-15', 1],
    ['syn.pat08.restored@synthetic.toothcare.example', 'Rafael', 'Rivera', 'MALE', '1991-01-25', 1],
    ['syn.pat09.archived@synthetic.toothcare.example', 'Patricia', 'Velasco', 'FEMALE', '1986-08-19', 0],
    ['syn.pat10.archived@synthetic.toothcare.example', 'Vicente', 'Morales', 'MALE', '1979-03-08', 0],
];
$patientIds = [];
$patientUserIds = [];
foreach ($patientSpecs as $idx => [$email, $fn, $ln, $gender, $dob, $active]) {
    $uid = $ensureUser($pdo, $email, $fn, $ln, 'PATIENT', $active);
    $patientUserIds[] = $uid;
    $find = $pdo->prepare('SELECT id FROM patients WHERE user_id = ? LIMIT 1');
    $find->execute([$uid]);
    $pid = $find->fetchColumn();
    if (!$pid) {
        $ins = $pdo->prepare('
            INSERT INTO patients (user_id, first_name, last_name, date_of_birth, phone, gender, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        ');
        $ins->execute([$uid, $fn, $ln, $dob, '+63 917 600 20' . sprintf('%02d', $idx + 1), $gender]);
        $pid = $pdo->lastInsertId();
    }
    $patientIds[] = (int) $pid;
}

// 5. Idempotency Marker Check for Synthetic History Events (uses JSON_EXTRACT so MySQL JSON whitespace normalization matches)
$markerStmt = $pdo->query("SELECT COUNT(*) FROM audit_logs WHERE JSON_UNQUOTE(JSON_EXTRACT(sanitized_payload, '$.synthetic_seed')) = 'phase8_v1'");
$existingEvents = (int) $markerStmt->fetchColumn();

$insertedEvents = 0;
if ($existingEvents === 0) {
    $insAudit = $pdo->prepare('
        INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, ip_address, user_agent, sanitized_payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ');

    $emit = static function (
        ?int $actorUid,
        string $action,
        string $targetType,
        ?int $targetId,
        array $payload,
        string $createdAt
    ) use ($insAudit, &$insertedEvents): void {
        $payload['synthetic_seed'] = 'phase8_v1';
        $insAudit->execute([
            $actorUid,
            $action,
            $targetType,
            $targetId,
            '10.0.8.0',
            'ToothCare-SyntheticSeeder/1.0',
            json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            $createdAt,
        ]);
        $insertedEvents++;
    };

    // 20 Patient History Events (registrations & profile updates with before/after)
    for ($i = 0; $i < 10; $i++) {
        $day = sprintf('2026-10-%02d 09:%02d:00', $i + 1, ($i * 5) % 60);
        $emit($patientUserIds[$i], 'ACCOUNT_REGISTERED', 'patients', $patientIds[$i], [
            'reason' => 'Self-service patient portal registration.',
            'after' => ['email' => $patientSpecs[$i][0], 'status' => 'ACTIVE'],
        ], $day);

        $dayUpd = sprintf('2026-10-%02d 14:%02d:00', $i + 11, ($i * 4) % 60);
        $emit($patientUserIds[$i], 'PATIENT_PROFILE_UPDATED', 'patients', $patientIds[$i], [
            'before' => ['phone' => '+63 917 600 0000'],
            'after' => ['phone' => '+63 917 600 20' . sprintf('%02d', $i + 1)],
            'reason' => 'Updated mobile contact number for appointment reminders.',
        ], $dayUpd);
    }

    // 15 Dentist History Events (schedules, leave, profile updates)
    for ($i = 0; $i < 5; $i++) {
        $emit($dentistUserIds[$i], 'DENTIST_SCHEDULE_UPDATED', 'dentist_schedules', $dentistIds[$i], [
            'before' => ['start_time' => '08:00', 'end_time' => '17:00'],
            'after' => ['start_time' => '09:00', 'end_time' => '18:00'],
            'reason' => 'Adjusted clinic shift hours for Q4 rotation.',
        ], sprintf('2026-10-%02d 08:30:00', $i + 3));

        $emit($dentistUserIds[$i], 'DENTIST_LEAVE_CREATED', 'dentist_time_off', $dentistIds[$i], [
            'after' => ['leave_date' => sprintf('2026-11-%02d', $i + 10), 'type' => 'CONFERENCE'],
            'reason' => 'Continuing dental education seminar.',
        ], sprintf('2026-10-%02d 10:15:00', $i + 6));

        $emit($adminIds[0], 'DENTIST_PROFILE_UPDATED', 'dentists', $dentistIds[$i], [
            'before' => ['default_operatory_chair' => 'Chair 1'],
            'after' => ['default_operatory_chair' => 'Operatory Chair ' . (($i % 3) + 1)],
            'reason' => 'Assigned primary operatory suite.',
        ], sprintf('2026-10-%02d 11:45:00', $i + 9));
    }

    // 15 Receptionist History Events (including actions performed by archived receptionist syn.rec3!)
    for ($i = 0; $i < 15; $i++) {
        $actorRec = $recIds[$i % 4];
        $action = $i % 3 === 0 ? 'APPOINTMENT_APPROVED' : ($i % 3 === 1 ? 'APPOINTMENT_RESCHEDULED' : 'PATIENT_RECORD_UPDATED');
        $emit($actorRec, $action, $i % 3 === 2 ? 'patients' : 'appointments', $i % 3 === 2 ? $patientIds[$i % 10] : (500 + $i), [
            'before' => $i % 3 === 1 ? ['start_at' => '2026-11-01 09:00:00', 'dentist_id' => $dentistIds[0]] : ['status' => 'PENDING'],
            'after' => $i % 3 === 1 ? ['start_at' => '2026-11-02 10:30:00', 'dentist_id' => $dentistIds[1]] : ['status' => 'CONFIRMED'],
            'reason' => $i % 4 === 2 ? 'Front-desk operational action performed prior to receptionist offboarding.' : 'Verified slot and patient availability.',
        ], sprintf('2026-11-%02d 09:%02d:00', ($i % 15) + 1, ($i * 3) % 60));
    }

    // 15 Administrator History Events (user provisioning, DRBAC permission changes, config updates — including archived admin)
    for ($i = 0; $i < 15; $i++) {
        $actorAdm = $adminIds[$i % 3];
        $action = $i % 3 === 0 ? 'ROLE_PERMISSIONS_UPDATED' : ($i % 3 === 1 ? 'CLINIC_SETTINGS_UPDATED' : 'USER_STATUS_UPDATED');
        $emit($actorAdm, $action, $i % 3 === 0 ? 'roles' : ($i % 3 === 1 ? 'clinic_settings' : 'users'), $i % 3 === 2 ? $recIds[$i % 4] : ($i + 1), [
            'before' => $i % 3 === 1 ? ['booking_advance_days_max' => 90] : ['is_active' => 1],
            'after' => $i % 3 === 1 ? ['booking_advance_days_max' => 60] : ['is_active' => 1],
            'reason' => 'Quarterly governance and access review.',
        ], sprintf('2026-11-%02d 15:%02d:00', ($i % 15) + 1, ($i * 4) % 60));
    }

    // 30 Appointment Lifecycle Events (requested, confirmed, reassigned, rescheduled, cancelled, completed)
    $apptActions = ['APPOINTMENT_REQUESTED', 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_REASSIGNED', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_COMPLETED'];
    for ($i = 0; $i < 30; $i++) {
        $act = $apptActions[$i % count($apptActions)];
        $actor = $act === 'APPOINTMENT_REQUESTED' ? $patientUserIds[$i % 10] : ($act === 'APPOINTMENT_COMPLETED' ? $dentistUserIds[$i % 4] : $recIds[$i % 4]);
        $emit($actor, $act, 'appointments', 600 + $i, [
            'before' => ['status' => 'PENDING', 'dentist_id' => $dentistIds[$i % 4]],
            'after' => ['status' => str_replace('APPOINTMENT_', '', $act), 'dentist_id' => $dentistIds[($i + 1) % 4]],
            'reason' => "Synthetic appointment lifecycle stage ({$act}).",
        ], sprintf('2026-11-%02d 11:%02d:00', ($i % 20) + 1, ($i * 2) % 60));
    }

    // 10 Security Events (failed logins, authorization denied, session revocation, password reset)
    $secActions = ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'AUTHORIZATION_FAILED', 'SESSION_REVOKED', 'PASSWORD_RESET_REQUESTED'];
    for ($i = 0; $i < 10; $i++) {
        $act = $secActions[$i % count($secActions)];
        $emit($patientUserIds[$i % 5], $act, 'security', $patientUserIds[$i % 5], [
            'result' => in_array($act, ['LOGIN_FAILED', 'AUTHORIZATION_FAILED'], true) ? 'DENIED' : 'SUCCESS',
            'reason' => "Synthetic security telemetry event ({$act}).",
        ], sprintf('2026-11-%02d 19:%02d:00', ($i % 10) + 10, ($i * 5) % 60));
    }
}

// 6. Seed 10 Idempotent Synthetic Archive & Restoration Records across all 4 account categories
$archiveSeeds = [
    ['patient', $patientIds[8], 'PATIENT', 'ARC-SYN-PAT-001', 'Patient Profile — Patricia Velasco (Synthetic)', 'Relocated patient archived after completing all visits.', 'syn.pat09.archived@synthetic.toothcare.example', $patientIds[8], null, $patientUserIds[8], 'ARCHIVED', 'ACCOUNT_5Y', '2031-11-01', 'Patient relocated abroad after completing dental care.', $adminIds[0], 'ADMIN', '2026-11-01 10:00:00', null, null, null],
    ['patient', $patientIds[9], 'PATIENT', 'ARC-SYN-PAT-002', 'Patient Profile — Vicente Morales (Synthetic)', 'Long-inactive patient profile archived cleanly.', 'syn.pat10.archived@synthetic.toothcare.example', $patientIds[9], null, $patientUserIds[9], 'ARCHIVED', 'ACCOUNT_5Y', '2031-11-02', 'Account inactive for 24+ months; preserved clinical history.', $adminIds[0], 'ADMIN', '2026-11-02 10:30:00', null, null, null],
    ['patient', $patientIds[7], 'PATIENT', 'ARC-SYN-PAT-003', 'Patient Profile — Rafael Rivera (Synthetic)', 'Restored returning patient with preserved archive cycle.', 'syn.pat08.restored@synthetic.toothcare.example', $patientIds[7], null, $patientUserIds[7], 'RESTORED', 'ACCOUNT_5Y', '2031-10-15', 'Temporary account suspension requested during travel.', $adminIds[0], 'ADMIN', '2026-10-15 09:00:00', $adminIds[1], '2026-11-12 11:00:00', 'Patient returned and requested account restoration.'],
    ['dentist', $dentistIds[4], 'DENTIST', 'ARC-SYN-DNT-001', 'Practitioner — Dr. Hector Dizon (Synthetic)', 'Prosthodontist archived after reassigning future appointments.', 'syn.dentist5.archived@synthetic.toothcare.example', null, $dentistIds[4], $dentistUserIds[4], 'ARCHIVED', 'ACCOUNT_5Y', '2031-11-05', 'Practitioner retired; all future visits reassigned prior to archival.', $adminIds[0], 'ADMIN', '2026-11-05 17:00:00', null, null, null],
    ['dentist', $dentistIds[3], 'DENTIST', 'ARC-SYN-DNT-002', 'Practitioner — Dr. Gabriel Navarro (Synthetic)', 'Dentist archived during fellowship leave and restored.', 'syn.dentist4@synthetic.toothcare.example', null, $dentistIds[3], $dentistUserIds[3], 'RESTORED', 'ACCOUNT_5Y', '2031-09-20', '6-month clinical fellowship sabbatical.', $adminIds[1], 'ADMIN', '2026-09-20 16:00:00', $adminIds[0], '2026-11-08 08:45:00', 'Completed fellowship; PRC license and schedule verified.'],
    ['user', $recIds[2], 'RECEPTIONIST', 'ARC-SYN-REC-001', 'Receptionist — Bianca Soriano (Synthetic)', 'Offboarded front-desk staff; historical approvals retained.', 'syn.rec3.archived@synthetic.toothcare.example', null, null, $recIds[2], 'ARCHIVED', 'ACCOUNT_5Y', '2031-11-07', 'Front-desk employee offboarding; sessions revoked.', $adminIds[0], 'ADMIN', '2026-11-07 18:00:00', null, null, null],
    ['user', $recIds[3], 'RECEPTIONIST', 'ARC-SYN-REC-002', 'Receptionist — Paolo Mercado (Synthetic)', 'Seasonal staff archived and restored with DRBAC review.', 'syn.rec4.restored@synthetic.toothcare.example', null, null, $recIds[3], 'RESTORED', 'ACCOUNT_5Y', '2031-10-01', 'End of Q3 front-desk rotation.', $adminIds[0], 'ADMIN', '2026-10-01 17:30:00', $adminIds[1], '2026-11-10 08:30:00', 'Re-hired for Q4 peak clinic schedule; permissions reviewed.'],
    ['user', $adminIds[2], 'ADMIN', 'ARC-SYN-ADM-001', 'Administrator — Nora Villanueva (Synthetic)', 'Former administrator archived with active super-admin remaining.', 'syn.admin3.archived@synthetic.toothcare.example', null, null, $adminIds[2], 'ARCHIVED', 'ACCOUNT_5Y', '2031-11-09', 'Administrator role transition completed; two active admins remain.', $adminIds[0], 'ADMIN', '2026-11-09 17:15:00', null, null, null],
    ['user', $recIds[2], 'RECEPTIONIST', 'ARC-SYN-REC-000', 'Receptionist — Bianca Soriano (Prior Cycle)', 'Earlier leave archive restored before final offboarding.', 'syn.rec3.archived@synthetic.toothcare.example', null, null, $recIds[2], 'RESTORED', 'ACCOUNT_5Y', '2031-06-01', 'Extended personal leave (Cycle 1).', $adminIds[1], 'ADMIN', '2026-06-01 12:00:00', $adminIds[0], '2026-08-01 09:00:00', 'Returned from leave (Cycle 1 restored).'],
    ['patient', $patientIds[0], 'PATIENT', 'ARC-SYN-PAT-004', 'Patient Profile — Andrea Lopez (Prior Cycle)', 'Previous duplicate-account pause resolved and restored.', 'syn.pat01@synthetic.toothcare.example', $patientIds[0], null, $patientUserIds[0], 'RESTORED', 'ACCOUNT_5Y', '2031-08-10', 'Temporary hold during email verification update.', $adminIds[0], 'ADMIN', '2026-08-10 13:00:00', $adminIds[0], '2026-08-12 09:30:00', 'Identity verified and account restored cleanly.'],
];

$insArc = $pdo->prepare('
    INSERT INTO archive_records (
        entity_type, entity_id, account_type, reference_code, title, summary, archived_email,
        owner_patient_id, owner_dentist_id, owner_user_id,
        status, retention_category, retention_until,
        archive_reason, archived_by_user_id, archived_by_role, archived_at,
        restored_by_user_id, restored_at, restore_reason,
        snapshot_json, snapshot_sha256, is_example
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON DUPLICATE KEY UPDATE updated_at = archive_records.updated_at
');

$findArc = $pdo->prepare('SELECT id FROM archive_records WHERE reference_code = ? LIMIT 1');
$findHist = $pdo->prepare('SELECT id FROM archive_history WHERE archive_record_id = ? AND event_type = ? LIMIT 1');
$insHist = $pdo->prepare('
    INSERT INTO archive_history (
        archive_record_id, entity_type, entity_id, account_type,
        event_type, actor_user_id, actor_role, reason, metadata, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
');

$seededArchives = 0;
foreach ($archiveSeeds as $s) {
    $snap = json_encode([
        'entity_type' => $s[0],
        'entity_id' => $s[1],
        'account_type' => $s[2],
        'email' => $s[6],
        'title' => $s[4],
        'synthetic_seed' => 'phase8_v1',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
    $sha = hash('sha256', $snap);

    $insArc->execute([
        $s[0], $s[1], $s[2], $s[3], $s[4], $s[5], $s[6],
        $s[7], $s[8], $s[9],
        $s[10], $s[11], $s[12],
        $s[13], $s[14], $s[15], $s[16],
        $s[17], $s[18], $s[19],
        $snap, $sha,
    ]);
    $seededArchives++;

    $findArc->execute([$s[3]]);
    $arcId = (int) $findArc->fetchColumn();
    if ($arcId > 0) {
        $evType = $s[3] === 'ARC-SYN-REC-001' ? 'REARCHIVED' : 'ARCHIVED';
        $findHist->execute([$arcId, $evType]);
        if (!$findHist->fetchColumn()) {
            $insHist->execute([
                $arcId, $s[0], $s[1], $s[2],
                $evType, $s[14], $s[15], $s[13],
                json_encode(['reference_code' => $s[3], 'synthetic_seed' => 'phase8_v1']),
                $s[16],
            ]);
        }
        if ($s[18] !== null) {
            $findHist->execute([$arcId, 'RESTORED']);
            if (!$findHist->fetchColumn()) {
                $insHist->execute([
                    $arcId, $s[0], $s[1], $s[2],
                    'RESTORED', $s[17], 'ADMIN', $s[19],
                    json_encode(['reference_code' => $s[3], 'sessions_restored' => false]),
                    $s[18],
                ]);
            }
        }
    }
}

echo "[DONE] Synthetic accounts ensured: 10 Patients, 5 Dentists, 4 Receptionists, 3 Admins\n";
echo "[DONE] Synthetic history events inserted: {$insertedEvents} (prior existing: {$existingEvents})\n";
echo "[DONE] Synthetic archive & restoration cycle records ensured: {$seededArchives}\n";
