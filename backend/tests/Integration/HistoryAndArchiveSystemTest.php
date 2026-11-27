<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Repositories\AuditLogRepository;
use App\Repositories\UserRepository;
use PDO;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Comprehensive History Records & Archive Management Integration Suite (Phases 2–9)
 *
 * Covers:
 * - History Records dashboard KPIs (total, patient, staff, appointment, security, admin)
 * - 9-column History table filtering, pagination, sorting, SQLi rejection, and Asia/Manila timestamps
 * - Before/After diff extraction and redaction of passwords/tokens/clinical notes
 * - Individual Record Timelines (Patient, Dentist, Staff, Appointment) + strict IDOR/ownership isolation
 * - Patient & Dentist unresolved appointment archival guards (409 UNRESOLVED_APPOINTMENTS_EXIST)
 * - Eligibility pre-check endpoint (GET /api/v1/archives/eligibility)
 * - Multi-cycle Archive -> Restore -> Re-Archive ledger (archive_history) without overwriting history
 * - Session/token revocation (SESSION_REVOKED) and last-admin protection (LAST_ADMIN_PROTECTED)
 * - Account Archive Category filtering (PATIENT | DENTIST | RECEPTIONIST | ADMIN) & post-restore review notices
 */
class HistoryAndArchiveSystemTest extends TestCase
{
    private Application $app;
    private PDO $pdo;
    private UserRepository $userRepo;
    private AuditLogRepository $auditRepo;

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
        $this->auditRepo = new AuditLogRepository();

        $hash = password_hash('Password123!', PASSWORD_BCRYPT);

        $adminId = $this->userRepo->create('hist.admin@toothcare.local', $hash, 'ADMIN', 1, 1);
        $this->adminUser = $this->userRepo->findById($adminId);

        $recId = $this->userRepo->create('hist.rec@toothcare.local', $hash, 'RECEPTIONIST', 1, 1);
        $this->receptionistUser = $this->userRepo->findById($recId);

        $d1Uid = $this->userRepo->create('hist.dentist1@toothcare.local', $hash, 'DENTIST', 1, 1);
        $this->dentist1User = $this->userRepo->findById($d1Uid);
        $this->pdo->prepare("INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone, is_active) VALUES (?, 'Clara', 'Mendoza', 'General', 'LIC-H-1', '09171111111', 1)")
            ->execute([$d1Uid]);
        $this->dentist1Id = (int) $this->pdo->lastInsertId();

        $d2Uid = $this->userRepo->create('hist.dentist2@toothcare.local', $hash, 'DENTIST', 1, 1);
        $this->dentist2User = $this->userRepo->findById($d2Uid);
        $this->pdo->prepare("INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone, is_active) VALUES (?, 'Rafael', 'Tan', 'Endodontics', 'LIC-H-2', '09171111112', 1)")
            ->execute([$d2Uid]);
        $this->dentist2Id = (int) $this->pdo->lastInsertId();

        $p1Uid = $this->userRepo->create('hist.patient1@toothcare.local', $hash, 'PATIENT', 1, 1);
        $this->patient1User = $this->userRepo->findById($p1Uid);
        $this->pdo->prepare("INSERT INTO patients (user_id, first_name, last_name, date_of_birth, phone, gender) VALUES (?, 'Liza', 'Ramos', '1994-03-11', '09172221111', 'FEMALE')")
            ->execute([$p1Uid]);
        $this->patient1Id = (int) $this->pdo->lastInsertId();

        $p2Uid = $this->userRepo->create('hist.patient2@toothcare.local', $hash, 'PATIENT', 1, 1);
        $this->patient2User = $this->userRepo->findById($p2Uid);
        $this->pdo->prepare("INSERT INTO patients (user_id, first_name, last_name, date_of_birth, phone, gender) VALUES (?, 'Miguel', 'Torres', '1989-11-22', '09172221112', 'MALE')")
            ->execute([$p2Uid]);
        $this->patient2Id = (int) $this->pdo->lastInsertId();

        $this->pdo->exec("INSERT INTO services (name, category, price, duration_minutes, is_active) VALUES ('Dental Cleaning', 'Preventive', 1500.00, 30, 1)");
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

    public function testHistoryDashboardSummaryFilteringDiffExtractionAndPrivacyRedaction(): void
    {
        // Seed diverse audit events including sensitive fields & clinical notes that must be redacted
        $e1 = $this->auditRepo->record('PATIENT_PROFILE_UPDATED', 'patients', $this->patient1Id, (int) $this->patient1User['id'], '192.168.10.42', 'TestAgent', [
            'before' => ['phone' => '09170000001'],
            'after' => ['phone' => '09172221111'],
            'password' => 'SecretPass123!',
            'diagnosis' => 'Sensitive clinical diagnosis text',
            'reason' => 'Updated mobile phone.',
        ]);
        $this->auditRepo->record('LOGIN_FAILED', 'security', (int) $this->patient1User['id'], (int) $this->patient1User['id'], '192.168.10.42', 'TestAgent', [
            'reason' => 'Invalid credentials.',
        ]);
        $this->auditRepo->record('ROLE_PERMISSIONS_UPDATED', 'roles', 4, (int) $this->adminUser['id'], '10.0.0.5', 'TestAgent', [
            'before' => ['archives.view' => false],
            'after' => ['archives.view' => true],
            'reason' => 'Enabled archive access for receptionists.',
        ]);

        // 1. Summary KPIs calculated accurately from DB
        $sumRes = $this->app->handle($this->authRequest('GET', '/api/v1/history/summary', $this->adminUser));
        $this->assertSame(200, $sumRes->getStatusCode());
        $sum = $this->decodeBody($sumRes)['data'];
        $this->assertGreaterThanOrEqual(3, $sum['total_activities']);
        $this->assertGreaterThanOrEqual(1, $sum['patient_activities']);
        $this->assertGreaterThanOrEqual(1, $sum['security_activities']);
        $this->assertGreaterThanOrEqual(1, $sum['administrative_activities']);
        $this->assertSame('Asia/Manila', $sum['timezone']);

        // 2. Event detail extracts Before -> After diffs, minimizes IP, and redacts password & clinical diagnosis
        $detRes = $this->app->handle($this->authRequest('GET', "/api/v1/history/{$e1}", $this->adminUser));
        $this->assertSame(200, $detRes->getStatusCode());
        $det = $this->decodeBody($detRes)['data'];
        $this->assertSame('192.168.10.0', $det['ip_address']);
        $this->assertSame('[RESTRICTED]', $det['payload']['password']);
        $this->assertSame('[RESTRICTED]', $det['payload']['diagnosis']);
        $this->assertNotEmpty($det['changes']);
        $this->assertSame('phone', $det['changes'][0]['field']);
        $this->assertSame('09170000001', $det['changes'][0]['before']);
        $this->assertSame('09172221111', $det['changes'][0]['after']);
        $this->assertStringContainsString('PHT', $det['timestamp_manila']);

        // 3. Invalid sort_by SQL injection rejected with 422
        $sqli = $this->app->handle($this->authRequest('GET', '/api/v1/history', $this->adminUser, [
            'sort_by' => 'id; DROP TABLE audit_logs--',
        ]));
        $this->assertSame(422, $sqli->getStatusCode());

        // 4. Category filter returns only security events
        $secRes = $this->app->handle($this->authRequest('GET', '/api/v1/history', $this->adminUser, [
            'category' => 'SECURITY',
        ]));
        $this->assertSame(200, $secRes->getStatusCode());
        $secRows = $this->decodeBody($secRes)['data'];
        $this->assertNotEmpty($secRows);
        $this->assertSame('LOGIN_FAILED', $secRows[0]['action']);
        $this->assertSame('FAILED', $secRows[0]['result']);
    }

    public function testIndividualRecordTimelinesAndStrictOwnershipIsolation(): void
    {
        // Create an appointment + status history entry for patient1 & dentist1
        $this->pdo->prepare("
            INSERT INTO appointments (patient_id, dentist_id, service_id, start_at, end_at, duration_snapshot, price_snapshot, status, operatory_chair, created_at, updated_at)
            VALUES (?, ?, ?, '2026-11-28 09:00:00', '2026-11-28 09:30:00', 30, 1500.00, 'CONFIRMED', 'Chair 1', NOW(), NOW())
        ")->execute([$this->patient1Id, $this->dentist1Id, $this->serviceId]);
        $apptId = (int) $this->pdo->lastInsertId();

        $this->pdo->prepare("
            INSERT INTO appointment_status_history (appointment_id, old_status, new_status, actor_user_id, reason, metadata, created_at)
            VALUES (?, 'PENDING', 'CONFIRMED', ?, 'Confirmed by front desk', ?, NOW())
        ")->execute([$apptId, (int) $this->receptionistUser['id'], json_encode(['old_dentist_id' => $this->dentist2Id, 'new_dentist_id' => $this->dentist1Id])]);

        // Patient 1 CAN view own Patient Timeline & Appointment Timeline
        $p1Timeline = $this->app->handle($this->authRequest('GET', "/api/v1/history/patients/{$this->patient1Id}", $this->patient1User));
        $this->assertSame(200, $p1Timeline->getStatusCode());
        $p1Body = $this->decodeBody($p1Timeline)['data'];
        $this->assertGreaterThanOrEqual(1, $p1Body['total_events']);

        $apptTimeline = $this->app->handle($this->authRequest('GET', "/api/v1/history/appointments/{$apptId}", $this->patient1User));
        $this->assertSame(200, $apptTimeline->getStatusCode());
        $apptEvents = $this->decodeBody($apptTimeline)['data']['events'];
        $this->assertNotEmpty($apptEvents);

        // Patient 2 CANNOT view Patient 1's timeline or appointment (403)
        $p2Denied = $this->app->handle($this->authRequest('GET', "/api/v1/history/patients/{$this->patient1Id}", $this->patient2User));
        $this->assertSame(403, $p2Denied->getStatusCode());
        $p2ApptDenied = $this->app->handle($this->authRequest('GET', "/api/v1/history/appointments/{$apptId}", $this->patient2User));
        $this->assertSame(403, $p2ApptDenied->getStatusCode());

        // Dentist 2 (unassigned) CANNOT view Dentist 1's timeline or Patient 1's timeline (403)
        $d2Denied = $this->app->handle($this->authRequest('GET', "/api/v1/history/dentists/{$this->dentist1Id}", $this->dentist2User));
        $this->assertSame(403, $d2Denied->getStatusCode());
        $d2PatDenied = $this->app->handle($this->authRequest('GET', "/api/v1/history/patients/{$this->patient1Id}", $this->dentist2User));
        $this->assertSame(403, $d2PatDenied->getStatusCode());

        // Receptionist CANNOT view Admin's staff timeline (403), but Admin CAN view Receptionist's staff timeline (200)
        $recDenied = $this->app->handle($this->authRequest('GET', "/api/v1/history/staff/{$this->adminUser['id']}", $this->receptionistUser));
        $this->assertSame(403, $recDenied->getStatusCode());
        $admViewRec = $this->app->handle($this->authRequest('GET', "/api/v1/history/staff/{$this->receptionistUser['id']}", $this->adminUser));
        $this->assertSame(200, $admViewRec->getStatusCode());
    }

    public function testUnresolvedAppointmentArchivalBlocksMultiCycleHistoryAndSessionRevocation(): void
    {
        // Insert an active CONFIRMED upcoming appointment for patient1 & dentist1
        $this->pdo->prepare("
            INSERT INTO appointments (patient_id, dentist_id, service_id, start_at, end_at, duration_snapshot, price_snapshot, status, operatory_chair, created_at, updated_at)
            VALUES (?, ?, ?, '2026-12-15 10:00:00', '2026-12-15 10:30:00', 30, 1500.00, 'CONFIRMED', 'Chair 1', NOW(), NOW())
        ")->execute([$this->patient1Id, $this->dentist1Id, $this->serviceId]);
        $apptId = (int) $this->pdo->lastInsertId();

        // 1. Pre-check eligibility detects blocking appointment for both Patient and Dentist
        $patElig = $this->app->handle($this->authRequest('GET', '/api/v1/archives/eligibility', $this->adminUser, [
            'entity_type' => 'patient',
            'entity_id' => $this->patient1Id,
        ]));
        $this->assertSame(200, $patElig->getStatusCode());
        $patEligData = $this->decodeBody($patElig)['data'];
        $this->assertFalse($patEligData['eligible']);
        $this->assertCount(1, $patEligData['blocking_appointments']);

        // 2. Archiving Patient or Dentist while CONFIRMED appointment exists is blocked with 409 UNRESOLVED_APPOINTMENTS_EXIST
        $patBlock = $this->app->handle($this->authRequest('POST', '/api/v1/archives', $this->adminUser, [], [
            'entity_type' => 'patient',
            'entity_id' => $this->patient1Id,
            'reason' => 'Attempting to archive patient with active upcoming visit.',
        ]));
        $this->assertSame(409, $patBlock->getStatusCode());
        $this->assertSame('UNRESOLVED_APPOINTMENTS_EXIST', $this->decodeBody($patBlock)['error']['code']);

        $dntBlock = $this->app->handle($this->authRequest('POST', '/api/v1/archives', $this->adminUser, [], [
            'entity_type' => 'dentist',
            'entity_id' => $this->dentist1Id,
            'reason' => 'Attempting to archive dentist with confirmed visit.',
        ]));
        $this->assertSame(409, $dntBlock->getStatusCode());
        $this->assertSame('UNRESOLVED_APPOINTMENTS_EXIST', $this->decodeBody($dntBlock)['error']['code']);

        // 3. Resolve appointment explicitly -> now Dentist 1 can be archived, restored, and re-archived!
        $this->pdo->prepare("UPDATE appointments SET status = 'COMPLETED' WHERE id = ?")->execute([$apptId]);

        // Cycle 1: Archive Receptionist -> revokes sessions & logs SESSION_REVOKED
        $recArc1 = $this->app->handle($this->authRequest('POST', '/api/v1/archives', $this->adminUser, [], [
            'entity_type' => 'user',
            'entity_id' => (int) $this->receptionistUser['id'],
            'reason' => 'Cycle 1: Seasonal leave archival.',
        ]));
        $this->assertSame(201, $recArc1->getStatusCode());
        $arc1Data = $this->decodeBody($recArc1)['data'];
        $this->assertSame('RECEPTIONIST', $arc1Data['account_type']);
        $this->assertSame('hist.rec@toothcare.local', $arc1Data['archived_email']);

        // Account category filter finds Receptionist archive cleanly
        $catFilter = $this->app->handle($this->authRequest('GET', '/api/v1/archives', $this->adminUser, [
            'account_type' => 'RECEPTIONIST',
            'include_examples' => 'false',
        ]));
        $this->assertSame(200, $catFilter->getStatusCode());
        $this->assertSame(1, $this->decodeBody($catFilter)['meta']['filtered_records']);

        // SESSION_REVOKED recorded in audit_logs
        $revokedCount = (int) $this->pdo->query("SELECT COUNT(*) FROM audit_logs WHERE action = 'SESSION_REVOKED' AND target_id = {$this->receptionistUser['id']}")->fetchColumn();
        $this->assertGreaterThanOrEqual(1, $revokedCount);

        // Cycle 1 Restore -> returns review_notices and preserves original history
        $recRestore = $this->app->handle($this->authRequest('POST', "/api/v1/archives/{$arc1Data['id']}/restore", $this->adminUser, [], [
            'reason' => 'Cycle 1 restored after return from leave.',
        ]));
        $this->assertSame(200, $recRestore->getStatusCode());
        $restoredData = $this->decodeBody($recRestore)['data'];
        $this->assertSame('RESTORED', $restoredData['status']);
        $this->assertNotEmpty($restoredData['review_notices']);

        // Cycle 2: Re-Archive same Receptionist -> recorded as REARCHIVED without erasing Cycle 1!
        $recArc2 = $this->app->handle($this->authRequest('POST', '/api/v1/archives', $this->adminUser, [], [
            'entity_type' => 'user',
            'entity_id' => (int) $this->receptionistUser['id'],
            'reason' => 'Cycle 2: Permanent offboarding.',
        ]));
        $this->assertSame(201, $recArc2->getStatusCode());
        $arc2Id = (int) $this->decodeBody($recArc2)['data']['id'];

        $cyclesRes = $this->app->handle($this->authRequest('GET', "/api/v1/archives/{$arc2Id}/history", $this->adminUser));
        $this->assertSame(200, $cyclesRes->getStatusCode());
        $cycles = $this->decodeBody($cyclesRes)['data']['cycles'];
        $eventTypes = array_column($cycles, 'event_type');
        $this->assertContains('ARCHIVED', $eventTypes);
        $this->assertContains('RESTORED', $eventTypes);
        $this->assertContains('REARCHIVED', $eventTypes);

        // 4. Last active admin protection: add second admin -> archive second admin succeeds; last remaining admin blocked
        $hash = password_hash('Password123!', PASSWORD_BCRYPT);
        $admin2Id = $this->userRepo->create('hist.admin2@toothcare.local', $hash, 'ADMIN', 1, 1);
        $admin2 = $this->userRepo->findById($admin2Id);
        // Archive admin2 (succeeds because admin1 remains active)
        $adm2Arc = $this->app->handle($this->authRequest('POST', '/api/v1/archives', $this->adminUser, [], [
            'entity_type' => 'user',
            'entity_id' => $admin2Id,
            'reason' => 'Retiring secondary administrator account.',
        ]));
        $this->assertSame(201, $adm2Arc->getStatusCode());
        $this->assertSame('ADMIN', $this->decodeBody($adm2Arc)['data']['account_type']);

        // Now only admin1 is active; attempting to archive admin1 from another admin session context fails with LAST_ADMIN_PROTECTED
        $lastAdminBlock = $this->app->handle($this->authRequest('POST', '/api/v1/archives', $admin2, [], [
            'entity_type' => 'user',
            'entity_id' => (int) $this->adminUser['id'],
            'reason' => 'Attempt to archive final remaining active admin.',
        ]));
        $this->assertSame(409, $lastAdminBlock->getStatusCode());
        $this->assertSame('LAST_ADMIN_PROTECTED', $this->decodeBody($lastAdminBlock)['error']['code']);
    }
}
