<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Repositories\UserRepository;
use PDO;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Role-Aware Compliance Archive System Integration & Security Suite
 *
 * Covers:
 * - Seeded example audit records across all 6 domains and role-scoped visibility
 * - Strict RBAC/DRBAC & ownership isolation across Admin, Receptionist, Dentist, and Patient
 * - Live archive creation, SHA-256 tamper verification, source deactivation, and duplicate protection
 * - Admin restoration workflow + immutable LOCKED_RETENTION enforcement on clinical treatment records
 * - Forensic audit_logs recording (RECORD_ARCHIVED, RECORD_RESTORED, ARCHIVE_EXPORTED)
 * - Server-side pagination, allowlist sorting, SQLi rejection, literal LIKE escaping, and CSV export
 */
class ArchiveSystemTest extends TestCase
{
    private Application $app;
    private PDO $pdo;
    private UserRepository $userRepo;

    private array $adminUser;
    private array $receptionistUser;
    private array $dentist1User;
    private array $dentist2User;
    private array $patient1User;
    private array $patient2User;

    private int $dentist1Id;
    private int $dentist2Id;
    private int $patient1Id;
    private int $patient2Id;
    private int $serviceId;

    protected function setUp(): void
    {
        $_SESSION = [];
        TestDb::create();
        $this->app = new Application(null, false);
        $this->pdo = Database::getInstance()->getConnection();
        $this->userRepo = new UserRepository();

        $hash = password_hash('Password123!', PASSWORD_BCRYPT);

        $adminId = $this->userRepo->create('arc.admin@toothcare.local', $hash, 'ADMIN', 1, 1);
        $this->adminUser = $this->userRepo->findById($adminId);

        $recId = $this->userRepo->create('arc.receptionist@toothcare.local', $hash, 'RECEPTIONIST', 1, 1);
        $this->receptionistUser = $this->userRepo->findById($recId);

        $d1UserId = $this->userRepo->create('arc.dentist1@toothcare.local', $hash, 'DENTIST', 1, 1);
        $this->dentist1User = $this->userRepo->findById($d1UserId);
        $this->pdo->prepare("INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone, is_active) VALUES (?, 'Clara', 'Mendoza', 'General', 'LIC-ARC-1', '09171110001', 1)")
            ->execute([$d1UserId]);
        $this->dentist1Id = (int) $this->pdo->lastInsertId();

        $d2UserId = $this->userRepo->create('arc.dentist2@toothcare.local', $hash, 'DENTIST', 1, 1);
        $this->dentist2User = $this->userRepo->findById($d2UserId);
        $this->pdo->prepare("INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone, is_active) VALUES (?, 'Rafael', 'Tan', 'Endodontics', 'LIC-ARC-2', '09171110002', 1)")
            ->execute([$d2UserId]);
        $this->dentist2Id = (int) $this->pdo->lastInsertId();

        $p1UserId = $this->userRepo->create('arc.patient1@toothcare.local', $hash, 'PATIENT', 1, 1);
        $this->patient1User = $this->userRepo->findById($p1UserId);
        $this->pdo->prepare("INSERT INTO patients (user_id, first_name, last_name, date_of_birth, phone, gender) VALUES (?, 'Liza', 'Ramos', '1994-03-11', '09172220001', 'FEMALE')")
            ->execute([$p1UserId]);
        $this->patient1Id = (int) $this->pdo->lastInsertId();

        $p2UserId = $this->userRepo->create('arc.patient2@toothcare.local', $hash, 'PATIENT', 1, 1);
        $this->patient2User = $this->userRepo->findById($p2UserId);
        $this->pdo->prepare("INSERT INTO patients (user_id, first_name, last_name, date_of_birth, phone, gender) VALUES (?, 'Miguel', 'Torres', '1989-11-22', '09172220002', 'MALE')")
            ->execute([$p2UserId]);
        $this->patient2Id = (int) $this->pdo->lastInsertId();

        $this->pdo->exec("INSERT INTO services (name, category, price, duration_minutes, is_active) VALUES ('Porcelain Veneer', 'Cosmetic', 9500.00, 60, 1)");
        $this->serviceId = (int) $this->pdo->lastInsertId();
    }

    private function authRequest(string $method, string $uri, ?array $user, array $query = [], array $body = []): Request
    {
        $rawBody = !empty($body) ? (json_encode($body) ?: '') : '';
        $headers = !empty($body) ? ['content-type' => 'application/json'] : [];
        $req = Request::create($method, $uri, $headers, $rawBody, $query);
        if ($user !== null) {
            $req->setUser($user);
        }
        return $req;
    }

    private function decodeBody(Response $res): array
    {
        $decoded = json_decode($res->getBody(), true);
        $this->assertIsArray($decoded);
        return $decoded;
    }

    public function testSeededExampleRecordsRespectRoleScopedVisibility(): void
    {
        // Admin sees all 6 seeded example archive domains
        $adminRes = $this->app->handle($this->authRequest('GET', '/api/v1/archives', $this->adminUser));
        $this->assertSame(200, $adminRes->getStatusCode());
        $adminBody = $this->decodeBody($adminRes);
        $this->assertSame(6, $adminBody['meta']['total_records']);

        // Receptionist sees only 3 operational domains (appointment, patient, service)
        $recRes = $this->app->handle($this->authRequest('GET', '/api/v1/archives', $this->receptionistUser));
        $this->assertSame(200, $recRes->getStatusCode());
        $recBody = $this->decodeBody($recRes);
        $this->assertSame(3, $recBody['meta']['total_records']);
        $recTypes = array_column($recBody['data'], 'entity_type');
        $this->assertNotContains('user', $recTypes);
        $this->assertNotContains('treatment_record', $recTypes);

        // Dentist sees only 2 clinical domains (appointment, treatment_record)
        $dentistRes = $this->app->handle($this->authRequest('GET', '/api/v1/archives', $this->dentist1User));
        $this->assertSame(200, $dentistRes->getStatusCode());
        $this->assertSame(2, $this->decodeBody($dentistRes)['meta']['total_records']);

        // Patient sees only 2 personal example domains (appointment, treatment_record) & read-only capabilities
        $patientSummary = $this->app->handle($this->authRequest('GET', '/api/v1/archives/summary', $this->patient1User));
        $this->assertSame(200, $patientSummary->getStatusCode());
        $pSummaryData = $this->decodeBody($patientSummary)['data'];
        $this->assertSame(2, $pSummaryData['total_records']);
        $this->assertFalse($pSummaryData['capabilities']['can_archive']);
        $this->assertFalse($pSummaryData['capabilities']['can_restore']);
        $this->assertFalse($pSummaryData['capabilities']['can_export']);

        // Patient requesting unauthorized domain filter ('user') is blocked with 403
        $patientForbidden = $this->app->handle($this->authRequest('GET', '/api/v1/archives', $this->patient1User, [
            'entity_type' => 'user',
        ]));
        $this->assertSame(403, $patientForbidden->getStatusCode());
    }

    public function testArchiveRestoreLifecycleIntegrityVerificationAndAuditTrail(): void
    {
        // Admin archives an active service
        $createRes = $this->app->handle($this->authRequest('POST', '/api/v1/archives', $this->adminUser, [], [
            'entity_type' => 'service',
            'entity_id' => $this->serviceId,
            'reason' => 'Discontinued cosmetic SKU for Q4 catalog cleanup.',
        ]));
        $this->assertSame(201, $createRes->getStatusCode());
        $created = $this->decodeBody($createRes)['data'];
        $this->assertSame('ARCHIVED', $created['status']);
        $this->assertSame('CATALOG_LEGACY', $created['retention_category']);
        $this->assertTrue($created['integrity_verified']);
        $this->assertTrue($created['can_restore']);

        // Source service was automatically deactivated (soft-archive, never deleted)
        $svcActive = (int) $this->pdo->query("SELECT is_active FROM services WHERE id = {$this->serviceId}")->fetchColumn();
        $this->assertSame(0, $svcActive);

        // Duplicate archive of same active service is blocked with 409
        $dupRes = $this->app->handle($this->authRequest('POST', '/api/v1/archives', $this->adminUser, [], [
            'entity_type' => 'service',
            'entity_id' => $this->serviceId,
            'reason' => 'Duplicate attempt should fail cleanly.',
        ]));
        $this->assertSame(409, $dupRes->getStatusCode());

        // Receptionist cannot restore (403 separation of duties)
        $recRestore = $this->app->handle($this->authRequest('POST', "/api/v1/archives/{$created['id']}/restore", $this->receptionistUser, [], [
            'reason' => 'Receptionist attempt to restore service.',
        ]));
        $this->assertSame(403, $recRestore->getStatusCode());

        // Admin restores service with mandatory reason
        $restoreRes = $this->app->handle($this->authRequest('POST', "/api/v1/archives/{$created['id']}/restore", $this->adminUser, [], [
            'reason' => 'Re-introduced cosmetic veneer package for holiday promotion.',
        ]));
        $this->assertSame(200, $restoreRes->getStatusCode());
        $restored = $this->decodeBody($restoreRes)['data'];
        $this->assertSame('RESTORED', $restored['status']);
        $this->assertFalse($restored['can_restore']);

        // Source service is re-activated
        $svcReactivated = (int) $this->pdo->query("SELECT is_active FROM services WHERE id = {$this->serviceId}")->fetchColumn();
        $this->assertSame(1, $svcReactivated);

        // Forensic audit_logs contains both RECORD_ARCHIVED and RECORD_RESTORED
        $auditActions = $this->pdo->query("SELECT action FROM audit_logs WHERE target_type = 'archives' ORDER BY id ASC")->fetchAll(PDO::FETCH_COLUMN);
        $this->assertContains('RECORD_ARCHIVED', $auditActions);
        $this->assertContains('RECORD_RESTORED', $auditActions);
    }

    public function testClinicalLockImmutabilityAndStrictOwnershipIsolation(): void
    {
        // Insert a COMPLETED appointment + clinical treatment record owned by patient1 & dentist1
        $this->pdo->prepare("
            INSERT INTO appointments (patient_id, dentist_id, service_id, start_at, end_at, duration_snapshot, price_snapshot, status, operatory_chair, created_at, updated_at)
            VALUES (?, ?, ?, '2026-10-10 09:00:00', '2026-10-10 10:00:00', 60, 9500.00, 'COMPLETED', 'Chair 1', NOW(), NOW())
        ")->execute([$this->patient1Id, $this->dentist1Id, $this->serviceId]);
        $apptId = (int) $this->pdo->lastInsertId();

        $this->pdo->prepare("
            INSERT INTO treatment_records (appointment_id, dentist_id, patient_id, teeth_treated, diagnosis, procedure_notes, locked_at, created_at, updated_at)
            VALUES (?, ?, ?, '[\"11\"]', 'Enamel fracture', 'Porcelain veneer cemented.', NOW(), NOW(), NOW())
        ")->execute([$apptId, $this->dentist1Id, $this->patient1Id]);
        $trId = (int) $this->pdo->lastInsertId();

        // Dentist 2 CANNOT archive Dentist 1's treatment record (403)
        $wrongDentistRes = $this->app->handle($this->authRequest('POST', '/api/v1/archives', $this->dentist2User, [], [
            'entity_type' => 'treatment_record',
            'entity_id' => $trId,
            'reason' => 'Unauthorized cross-dentist archive attempt.',
        ]));
        $this->assertSame(403, $wrongDentistRes->getStatusCode());

        // Dentist 1 archives own clinical record => LOCKED_RETENTION (CLINICAL_7Y)
        $trArchiveRes = $this->app->handle($this->authRequest('POST', '/api/v1/archives', $this->dentist1User, [], [
            'entity_type' => 'treatment_record',
            'entity_id' => $trId,
            'reason' => 'Preserving signed clinical chart under 7-year dental retention policy.',
        ]));
        $this->assertSame(201, $trArchiveRes->getStatusCode());
        $trArchived = $this->decodeBody($trArchiveRes)['data'];
        $this->assertSame('LOCKED_RETENTION', $trArchived['status']);
        $this->assertSame('CLINICAL_7Y', $trArchived['retention_category']);

        // Even Admin CANNOT restore an immutable LOCKED_RETENTION clinical archive (409)
        $immutableRes = $this->app->handle($this->authRequest('POST', "/api/v1/archives/{$trArchived['id']}/restore", $this->adminUser, [], [
            'reason' => 'Attempt to modify immutable clinical record.',
        ]));
        $this->assertSame(409, $immutableRes->getStatusCode());

        // Patient 1 CAN inspect their own archived clinical record (200), Patient 2 CANNOT (403)
        $p1Show = $this->app->handle($this->authRequest('GET', "/api/v1/archives/{$trArchived['id']}", $this->patient1User));
        $this->assertSame(200, $p1Show->getStatusCode());
        $this->assertNull($this->decodeBody($p1Show)['data']['archived_by_email'], 'Staff email must be redacted for patients');

        $p2Show = $this->app->handle($this->authRequest('GET', "/api/v1/archives/{$trArchived['id']}", $this->patient2User));
        $this->assertSame(403, $p2Show->getStatusCode());

        // Patient 2 listing total_records MUST remain 2 (examples only) and NEVER leak Patient 1's record
        $p2List = $this->app->handle($this->authRequest('GET', '/api/v1/archives', $this->patient2User));
        $this->assertSame(2, $this->decodeBody($p2List)['meta']['total_records']);
    }

    public function testReceptionistRulesPaginationValidationAndCsvExport(): void
    {
        // Pending appointment cannot be archived (409)
        $this->pdo->prepare("
            INSERT INTO appointments (patient_id, dentist_id, service_id, start_at, end_at, duration_snapshot, price_snapshot, status, operatory_chair, created_at, updated_at)
            VALUES (?, ?, ?, '2026-12-20 09:00:00', '2026-12-20 10:00:00', 60, 9500.00, 'PENDING', 'Chair 1', NOW(), NOW())
        ")->execute([$this->patient1Id, $this->dentist1Id, $this->serviceId]);
        $pendingId = (int) $this->pdo->lastInsertId();

        $pendingRes = $this->app->handle($this->authRequest('POST', '/api/v1/archives', $this->receptionistUser, [], [
            'entity_type' => 'appointment',
            'entity_id' => $pendingId,
            'reason' => 'Attempting to archive unresolved pending booking.',
        ]));
        $this->assertSame(409, $pendingRes->getStatusCode());

        // Invalid sort_by SQL injection rejected with 422
        $sqliRes = $this->app->handle($this->authRequest('GET', '/api/v1/archives', $this->adminUser, [
            'sort_by' => 'archived_at; DROP TABLE archive_records--',
        ]));
        $this->assertSame(422, $sqliRes->getStatusCode());

        // CSV Export succeeds for Admin and logs ARCHIVE_EXPORTED
        $csvRes = $this->app->handle($this->authRequest('GET', '/api/v1/archives/export', $this->adminUser));
        $this->assertSame(200, $csvRes->getStatusCode());
        $this->assertStringContainsString('Reference Code', $csvRes->getBody());
        $this->assertStringContainsString('ARC-EX-APT-001', $csvRes->getBody());

        // Patient blocked from CSV export (403)
        $patientCsv = $this->app->handle($this->authRequest('GET', '/api/v1/archives/export', $this->patient1User));
        $this->assertSame(403, $patientCsv->getStatusCode());
    }

    public function testEntityLifecycleGuardsTamperDetectionClinicalRetentionAndCsvFormulaSafety(): void
    {
        // 1. Admin cannot archive own account (409 SELF_ARCHIVE_BLOCKED)
        $selfArc = $this->app->handle($this->authRequest('POST', '/api/v1/archives', $this->adminUser, [], [
            'entity_type' => 'user',
            'entity_id' => (int) $this->adminUser['id'],
            'reason' => 'Attempting to archive own active admin account.',
        ]));
        $this->assertSame(409, $selfArc->getStatusCode());

        // 2. Admin archives and restores a Dentist (synchronizes dentists.is_active AND users.is_active)
        $dentistArc = $this->app->handle($this->authRequest('POST', '/api/v1/archives', $this->adminUser, [], [
            'entity_type' => 'dentist',
            'entity_id' => $this->dentist2Id,
            'reason' => '=HYPERLINK("http://evil.example","Offboarded practitioner")',
        ]));
        $this->assertSame(201, $dentistArc->getStatusCode());
        $dentistArcData = $this->decodeBody($dentistArc)['data'];
        $this->assertSame(0, (int) $this->pdo->query("SELECT is_active FROM dentists WHERE id = {$this->dentist2Id}")->fetchColumn());
        $this->assertSame(0, (int) $this->pdo->query("SELECT is_active FROM users WHERE id = {$this->dentist2User['id']}")->fetchColumn());

        // CSV Export neutralizes formula injection with a leading apostrophe
        $formulaCsv = $this->app->handle($this->authRequest('GET', '/api/v1/archives/export', $this->adminUser, [
            'entity_type' => 'dentist',
        ]));
        $this->assertSame(200, $formulaCsv->getStatusCode());
        $this->assertStringContainsString("'=HYPERLINK", $formulaCsv->getBody());

        // Restore Dentist re-activates both dentist profile and user login atomically
        $dentistRestore = $this->app->handle($this->authRequest('POST', "/api/v1/archives/{$dentistArcData['id']}/restore", $this->adminUser, [], [
            'reason' => 'Practitioner returned from sabbatical.',
        ]));
        $this->assertSame(200, $dentistRestore->getStatusCode());
        $this->assertSame(1, (int) $this->pdo->query("SELECT is_active FROM dentists WHERE id = {$this->dentist2Id}")->fetchColumn());
        $this->assertSame(1, (int) $this->pdo->query("SELECT is_active FROM users WHERE id = {$this->dentist2User['id']}")->fetchColumn());

        // 3. Admin archives and restores a Patient (synchronizes users.is_active)
        $patientArc = $this->app->handle($this->authRequest('POST', '/api/v1/archives', $this->adminUser, [], [
            'entity_type' => 'patient',
            'entity_id' => $this->patient2Id,
            'reason' => 'Inactive patient moved out of region.',
        ]));
        $this->assertSame(201, $patientArc->getStatusCode());
        $patientArcId = (int) $this->decodeBody($patientArc)['data']['id'];
        $this->assertSame(0, (int) $this->pdo->query("SELECT is_active FROM users WHERE id = {$this->patient2User['id']}")->fetchColumn());

        $patientRestore = $this->app->handle($this->authRequest('POST', "/api/v1/archives/{$patientArcId}/restore", $this->adminUser, [], [
            'reason' => 'Patient resumed care at Manila clinic.',
        ]));
        $this->assertSame(200, $patientRestore->getStatusCode());
        $this->assertSame(1, (int) $this->pdo->query("SELECT is_active FROM users WHERE id = {$this->patient2User['id']}")->fetchColumn());

        // 4. Shortened retention category on clinical treatment_record is rejected (422)
        $this->pdo->prepare("
            INSERT INTO appointments (patient_id, dentist_id, service_id, start_at, end_at, duration_snapshot, price_snapshot, status, operatory_chair, created_at, updated_at)
            VALUES (?, ?, ?, '2026-10-12 09:00:00', '2026-10-12 10:00:00', 60, 9500.00, 'COMPLETED', 'Chair 2', NOW(), NOW())
        ")->execute([$this->patient1Id, $this->dentist1Id, $this->serviceId]);
        $apptId = (int) $this->pdo->lastInsertId();
        $this->pdo->prepare("
            INSERT INTO treatment_records (appointment_id, dentist_id, patient_id, teeth_treated, diagnosis, procedure_notes, locked_at, created_at, updated_at)
            VALUES (?, ?, ?, '[\"21\"]', 'Caries', 'Composite placed.', NOW(), NOW(), NOW())
        ")->execute([$apptId, $this->dentist1Id, $this->patient1Id]);
        $trId = (int) $this->pdo->lastInsertId();

        $shortRetRes = $this->app->handle($this->authRequest('POST', '/api/v1/archives', $this->dentist1User, [], [
            'entity_type' => 'treatment_record',
            'entity_id' => $trId,
            'retention_category' => 'OPERATIONAL_3Y',
            'reason' => 'Attempting to shorten mandatory 7-year clinical retention.',
        ]));
        $this->assertSame(422, $shortRetRes->getStatusCode());

        // 5. Restoring a seeded example record is blocked (409 EXAMPLE_RECORD_READ_ONLY)
        $exampleId = (int) $this->pdo->query("SELECT id FROM archive_records WHERE reference_code = 'ARC-EX-APT-001'")->fetchColumn();
        $exampleRestore = $this->app->handle($this->authRequest('POST', "/api/v1/archives/{$exampleId}/restore", $this->adminUser, [], [
            'reason' => 'Trying to mutate read-only example template.',
        ]));
        $this->assertSame(409, $exampleRestore->getStatusCode());

        // 6. Tampering with snapshot_json in storage is immediately flagged as integrity_verified = false
        $this->pdo->prepare('UPDATE archive_records SET snapshot_json = ? WHERE id = ?')
            ->execute(['{"tampered":true}', $patientArcId]);
        $tamperedRes = $this->app->handle($this->authRequest('GET', "/api/v1/archives/{$patientArcId}", $this->adminUser));
        $this->assertSame(200, $tamperedRes->getStatusCode());
        $this->assertFalse($this->decodeBody($tamperedRes)['data']['integrity_verified']);
    }
}
