<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Database;
use App\Core\Request;
use App\Repositories\DashboardRepository;
use App\Repositories\DentistRepository;
use PDO;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

final class SystemAuditRegressionTest extends TestCase
{
    private PDO $pdo;
    private Application $app;

    /** @var array<string, mixed> */
    private array $adminUser;
    /** @var array<string, mixed> */
    private array $receptionistUser;
    /** @var array<string, mixed> */
    private array $dentist1User;
    /** @var array<string, mixed> */
    private array $dentist2User;
    /** @var array<string, mixed> */
    private array $patientUser;

    private int $dentist1Id;
    private int $dentist2Id;
    private int $patientId;
    private int $serviceId;
    private int $pendingApptD1Id;
    private int $completedApptD1Id;
    private int $treatmentRecordId;

    protected function setUp(): void
    {
        $_SESSION = [];
        $this->pdo = TestDb::create();
        $this->app = new Application(null, false);
        $this->seedFixtures();
    }

    protected function tearDown(): void
    {
        Database::setInstance(null);
    }

    private function seedFixtures(): void
    {
        $hash = password_hash('AuditPass!2026', PASSWORD_BCRYPT);
        $insUser = $this->pdo->prepare('
            INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, email_verified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, 1, datetime("now"), datetime("now"))
        ');

        $insUser->execute(['audit.admin@example.com', $hash, 'Admin', 'One', 'ADMIN']);
        $adminId = (int) $this->pdo->lastInsertId();
        $this->adminUser = ['id' => $adminId, 'email' => 'audit.admin@example.com', 'role' => 'ADMIN', 'is_active' => 1];

        $insUser->execute(['audit.rec@example.com', $hash, 'Rec', 'One', 'RECEPTIONIST']);
        $recId = (int) $this->pdo->lastInsertId();
        $this->receptionistUser = ['id' => $recId, 'email' => 'audit.rec@example.com', 'role' => 'RECEPTIONIST', 'is_active' => 1];

        $insUser->execute(['audit.d1@example.com', $hash, 'Elena', 'Reyes', 'DENTIST']);
        $d1Uid = (int) $this->pdo->lastInsertId();
        $this->dentist1User = ['id' => $d1Uid, 'email' => 'audit.d1@example.com', 'role' => 'DENTIST', 'is_active' => 1];

        $insUser->execute(['audit.d2@example.com', $hash, 'Marco', 'Lim', 'DENTIST']);
        $d2Uid = (int) $this->pdo->lastInsertId();
        $this->dentist2User = ['id' => $d2Uid, 'email' => 'audit.d2@example.com', 'role' => 'DENTIST', 'is_active' => 1];

        $insUser->execute(['audit.pat@example.com', $hash, 'Juan', 'Cruz', 'PATIENT']);
        $patUid = (int) $this->pdo->lastInsertId();
        $this->patientUser = ['id' => $patUid, 'email' => 'audit.pat@example.com', 'role' => 'PATIENT', 'is_active' => 1];

        $this->pdo->prepare('
            INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone, is_active)
            VALUES (?, "Elena", "Reyes", "General", "PRC-AUD-1", "+639170000001", 1)
        ')->execute([$d1Uid]);
        $this->dentist1Id = (int) $this->pdo->lastInsertId();

        $this->pdo->prepare('
            INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone, is_active)
            VALUES (?, "Marco", "Lim", "Orthodontics", "PRC-AUD-2", "+639170000002", 1)
        ')->execute([$d2Uid]);
        $this->dentist2Id = (int) $this->pdo->lastInsertId();

        $this->pdo->prepare('
            INSERT INTO patients (user_id, first_name, last_name, phone, date_of_birth, gender)
            VALUES (?, "Juan", "Cruz", "+639171234567", "1992-05-10", "MALE")
        ')->execute([$patUid]);
        $this->patientId = (int) $this->pdo->lastInsertId();

        $this->pdo->exec('
            INSERT INTO services (name, description, duration_minutes, price, category, is_active)
            VALUES ("Dental Cleaning", "Prophylaxis", 30, 1200, "Preventive", 1)
        ');
        $this->serviceId = (int) $this->pdo->lastInsertId();

        $this->pdo->prepare('
            INSERT INTO appointments (patient_id, dentist_id, service_id, start_at, end_at, duration_snapshot, price_snapshot, status, operatory_chair)
            VALUES (?, ?, ?, "2026-12-10 09:00:00", "2026-12-10 09:30:00", 30, 1200, "PENDING", "Chair 1")
        ')->execute([$this->patientId, $this->dentist1Id, $this->serviceId]);
        $this->pendingApptD1Id = (int) $this->pdo->lastInsertId();

        $this->pdo->prepare('
            INSERT INTO appointments (patient_id, dentist_id, service_id, start_at, end_at, duration_snapshot, price_snapshot, status, operatory_chair)
            VALUES (?, ?, ?, "2026-11-20 10:00:00", "2026-11-20 10:30:00", 30, 1200, "COMPLETED", "Chair 1")
        ')->execute([$this->patientId, $this->dentist1Id, $this->serviceId]);
        $this->completedApptD1Id = (int) $this->pdo->lastInsertId();

        $this->pdo->prepare('
            INSERT INTO treatment_records (appointment_id, patient_id, dentist_id, diagnosis, procedure_notes, teeth_treated)
            VALUES (?, ?, ?, "Routine prophylaxis", "Scaling and polishing completed", ?)
        ')->execute([$this->completedApptD1Id, $this->patientId, $this->dentist1Id, '["11"]']);
        $this->treatmentRecordId = (int) $this->pdo->lastInsertId();
    }

    /**
     * @param array<string, mixed> $user
     * @param array<string, mixed> $body
     * @param array<string, mixed> $query
     */
    private function authRequest(string $method, string $path, array $user, array $body = [], array $query = []): Request
    {
        $req = new Request($method, $path, ['accept' => 'application/json'], $query, $body);
        $req->setUser($user);
        return $req;
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeBody(\App\Core\Response $res): array
    {
        $decoded = json_decode($res->getBody(), true);
        return is_array($decoded) ? $decoded : [];
    }

    public function testDentistCannotAccessClinicWideAdminAppointmentsOrOtherDentistAppointments(): void
    {
        // Dentist 2 cannot list or view /admin/appointments/*
        $listRes = $this->app->handle($this->authRequest('GET', '/api/v1/admin/appointments', $this->dentist2User));
        $this->assertSame(403, $listRes->getStatusCode());

        $showRes = $this->app->handle($this->authRequest('GET', "/api/v1/admin/appointments/{$this->pendingApptD1Id}", $this->dentist2User));
        $this->assertSame(403, $showRes->getStatusCode());

        // Dentist 2 cannot confirm, reject, or complete via /admin/appointments/*
        $confirmRes = $this->app->handle($this->authRequest('PATCH', "/api/v1/admin/appointments/{$this->pendingApptD1Id}/confirm", $this->dentist2User));
        $this->assertSame(403, $confirmRes->getStatusCode());

        $rejectRes = $this->app->handle($this->authRequest('PATCH', "/api/v1/admin/appointments/{$this->pendingApptD1Id}/reject", $this->dentist2User, ['reason' => 'Not yours']));
        $this->assertSame(403, $rejectRes->getStatusCode());

        $completeRes = $this->app->handle($this->authRequest('PATCH', "/api/v1/admin/appointments/{$this->pendingApptD1Id}/complete", $this->dentist2User));
        $this->assertSame(403, $completeRes->getStatusCode());

        // Dentist 2 cannot read Dentist 1's appointment via /appointments/{id} or cancel via /appointments/{id}/cancel
        $otherRead = $this->app->handle($this->authRequest('GET', "/api/v1/appointments/{$this->pendingApptD1Id}", $this->dentist2User));
        $this->assertSame(404, $otherRead->getStatusCode());

        $cancelRes = $this->app->handle($this->authRequest('POST', "/api/v1/appointments/{$this->pendingApptD1Id}/cancel", $this->dentist2User, ['reason' => 'Unauthorized cancel']));
        $this->assertSame(403, $cancelRes->getStatusCode());

        // Dentist 1 CAN read their own assigned appointment via /appointments/{id}
        $ownRead = $this->app->handle($this->authRequest('GET', "/api/v1/appointments/{$this->pendingApptD1Id}", $this->dentist1User));
        $this->assertSame(200, $ownRead->getStatusCode());
    }

    public function testAdminCanListAllClinicalTreatmentRecords(): void
    {
        $res = $this->app->handle($this->authRequest('GET', '/api/v1/treatment-records', $this->adminUser));
        $this->assertSame(200, $res->getStatusCode());

        $body = $this->decodeBody($res);
        $items = $body['data']['items'] ?? [];
        $this->assertGreaterThanOrEqual(1, count($items));
        $this->assertSame($this->treatmentRecordId, (int) $items[0]['id']);
    }

    public function testDentistCanViewAssignedPatientHistoryAndEligibilityChecksEnforceStatusAndOwnership(): void
    {
        // Dentist 1 has an appointment with patient -> 200 OK via history.view_patient
        $d1Hist = $this->app->handle($this->authRequest('GET', "/api/v1/history/patients/{$this->patientId}", $this->dentist1User));
        $this->assertSame(200, $d1Hist->getStatusCode());

        // Dentist 2 has no relationship with patient -> 403 Forbidden
        $d2Hist = $this->app->handle($this->authRequest('GET', "/api/v1/history/patients/{$this->patientId}", $this->dentist2User));
        $this->assertSame(403, $d2Hist->getStatusCode());

        // Eligibility for PENDING appointment returns eligible=false with APPOINTMENT_NOT_RESOLVED
        $eligPending = $this->app->handle($this->authRequest('GET', '/api/v1/archives/eligibility', $this->adminUser, [], [
            'entity_type' => 'appointment',
            'entity_id' => $this->pendingApptD1Id,
        ]));
        $this->assertSame(200, $eligPending->getStatusCode());
        $eligBody = $this->decodeBody($eligPending)['data'];
        $this->assertFalse($eligBody['eligible']);
        $this->assertSame('APPOINTMENT_NOT_RESOLVED', $eligBody['blockers'][0]['code'] ?? null);

        // Dentist 2 cannot probe Dentist 1's appointment or treatment record eligibility -> 403
        $d2Elig = $this->app->handle($this->authRequest('GET', '/api/v1/archives/eligibility', $this->dentist2User, [], [
            'entity_type' => 'appointment',
            'entity_id' => $this->completedApptD1Id,
        ]));
        $this->assertSame(403, $d2Elig->getStatusCode());
    }

    public function testDashboardRepositoryReadsRealEmailOutboxSchemaAndStatuses(): void
    {
        $this->pdo->exec('
            INSERT INTO email_outbox (event_key, event_type, template_key, recipient_email, recipient_name, subject, status, attempts, max_attempts, last_error, created_at, updated_at)
            VALUES
                ("evt-retry-1", "APPOINTMENT_CONFIRMED", "appointment_confirmed", "a@example.com", "Alice", "Confirmed", "FAILED_RETRYABLE", 2, 5, "SMTP 421 busy", datetime("now"), datetime("now")),
                ("evt-perm-1", "APPOINTMENT_CANCELLED", "appointment_cancelled", "b@example.com", "Bob", "Cancelled", "FAILED_PERMANENT", 5, 5, "Mailbox unavailable", datetime("now"), datetime("now"))
        ');

        $repo = new DashboardRepository();
        $summary = $repo->getOutboxSummary();
        $this->assertSame(1, $summary['email_outbox']['failed_retryable']);
        $this->assertSame(1, $summary['email_outbox']['failed_permanent']);
        $this->assertSame(1, $summary['totals']['pending']);
        $this->assertSame(1, $summary['totals']['failed']);

        $jobs = $repo->getOutboxJobs('email', null, 1, 10);
        $this->assertSame(2, $jobs['meta']['total']);
        $this->assertCount(2, $jobs['items']);

        $errors = $repo->getOperationalErrors(1, 10);
        $this->assertGreaterThanOrEqual(2, $errors['meta']['total']);
    }

    public function testClientIpPrefersAuthoritativeXRealIpOverSpoofedXForwardedFor(): void
    {
        $req = new Request('GET', '/api/v1/health', [
            'x-forwarded-for' => '1.2.3.4, 203.0.113.9',
            'x-real-ip' => '198.51.100.42',
        ]);
        $this->assertSame('198.51.100.42', $req->getClientIp());
    }

    public function testWalkInRegistrationBlocksLinkingStaffEmailAndPublicDentistsHideInactiveUsers(): void
    {
        // Staff email cannot be registered as walk-in patient
        $walkInRes = $this->app->handle($this->authRequest('POST', '/api/v1/receptionist/patients', $this->receptionistUser, [
            'first_name' => 'Elena',
            'last_name' => 'Reyes',
            'email' => 'audit.d1@example.com',
            'phone' => '+639171112222',
        ]));
        $this->assertSame(409, $walkInRes->getStatusCode());

        // Deactivating dentist 2's user account hides dentist 2 from public catalog
        $this->pdo->prepare('UPDATE users SET is_active = 0 WHERE id = ?')->execute([$this->dentist2User['id']]);
        $dentistRepo = new DentistRepository();
        $activeIds = array_map(static fn (array $d): int => (int) $d['id'], $dentistRepo->listActive());
        $this->assertContains($this->dentist1Id, $activeIds);
        $this->assertNotContains($this->dentist2Id, $activeIds);

        $publicShow = $this->app->handle(new Request('GET', "/api/v1/dentists/{$this->dentist2Id}"));
        $this->assertSame(404, $publicShow->getStatusCode());
    }
}
