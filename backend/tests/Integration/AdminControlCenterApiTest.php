<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Database;
use App\Core\Request;
use App\Middleware\AuthorizationMiddleware;
use App\Repositories\AuditLogRepository;
use App\Repositories\RoleRepository;
use App\Repositories\UserRepository;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Integration Tests for Administrator Control Center, User Management,
 * Dynamic Role-Based Access Control (DRBAC), Audit Trail, Clinic Settings,
 * Reports, and System Health.
 */
class AdminControlCenterApiTest extends TestCase
{
    private Application $app;
    private UserRepository $userRepo;
    private RoleRepository $roleRepo;
    private AuditLogRepository $auditRepo;

    private array $adminUser;
    private array $receptionistUser;
    private array $patientUser;

    protected function setUp(): void
    {
        $_SESSION = [];
        TestDb::create();
        $this->app = new Application(null, false);

        $this->userRepo = new UserRepository();
        $this->roleRepo = new RoleRepository();
        $this->auditRepo = new AuditLogRepository();

        $adminId = $this->userRepo->create(
            'super.admin@toothcare.local',
            password_hash('Password123!', PASSWORD_BCRYPT),
            'ADMIN',
            1,
            1
        );
        $this->adminUser = $this->userRepo->findById($adminId);

        $recId = $this->userRepo->create(
            'frontdesk.staff@toothcare.local',
            password_hash('Password123!', PASSWORD_BCRYPT),
            'RECEPTIONIST',
            1,
            1
        );
        $this->receptionistUser = $this->userRepo->findById($recId);

        $patId = $this->userRepo->create(
            'patient.viewer@toothcare.local',
            password_hash('Password123!', PASSWORD_BCRYPT),
            'PATIENT',
            1,
            1
        );
        $this->patientUser = $this->userRepo->findById($patId);
    }

    private function createAuthRequest(
        string $method,
        string $uri,
        array $user,
        array $body = [],
        array $query = []
    ): Request {
        $rawBody = !empty($body) ? json_encode($body) : '';
        $headers = !empty($body) ? ['content-type' => 'application/json'] : [];
        $req = Request::create($method, $uri, $headers, $rawBody, $query);
        $req->setUser($user);
        return $req;
    }

    public function testAdminExecutiveDashboardReturnsMetricsAndOperationalStreams(): void
    {
        $req = $this->createAuthRequest('GET', '/api/v1/admin/dashboard', $this->adminUser);
        $res = $this->app->handle($req);

        $this->assertSame(200, $res->getStatusCode());
        $body = json_decode($res->getBody(), true);
        $data = $body['data'];

        $this->assertArrayHasKey('counts', $data);
        $this->assertArrayHasKey('patients', $data['counts']);
        $this->assertArrayHasKey('dentists', $data['counts']);
        $this->assertArrayHasKey('services', $data['counts']);
        $this->assertArrayHasKey('appointments', $data['counts']);
        $this->assertArrayHasKey('today_schedule', $data);
        $this->assertArrayHasKey('review_queue_peek', $data);
        $this->assertArrayHasKey('recent_activity', $data);
        $this->assertArrayHasKey('system_alerts', $data);
    }

    public function testNonAdminCannotAccessAdminUsersOrDrbac(): void
    {
        // Patient denied
        $resPat = $this->app->handle($this->createAuthRequest('GET', '/api/v1/admin/users', $this->patientUser));
        $this->assertSame(403, $resPat->getStatusCode());

        // Receptionist denied from DRBAC permissions matrix
        $resRec = $this->app->handle($this->createAuthRequest('GET', '/api/v1/admin/roles', $this->receptionistUser));
        $this->assertSame(403, $resRec->getStatusCode());
    }

    public function testAdminCanListFilterAndProvisionStaffAccounts(): void
    {
        // 1. Provision a new Dentist staff account
        $resCreate = $this->app->handle($this->createAuthRequest('POST', '/api/v1/admin/users', $this->adminUser, [
            'email' => 'dr.new@toothcare.local',
            'password' => 'StrongPass123!',
            'role' => 'DENTIST',
            'first_name' => 'Elena',
            'last_name' => 'Mendoza',
            'phone' => '+639175551122',
            'specialization' => 'Orthodontics',
            'license_number' => 'PRC-998877',
        ]));

        $this->assertSame(201, $resCreate->getStatusCode());
        $created = json_decode($resCreate->getBody(), true)['data'];
        $this->assertSame('DENTIST', $created['role']);
        $this->assertNotNull($created['dentist']);
        $this->assertSame('Orthodontics', $created['dentist']['specialization']);

        // 2. Duplicate email conflict rejected with 409
        $resDup = $this->app->handle($this->createAuthRequest('POST', '/api/v1/admin/users', $this->adminUser, [
            'email' => 'dr.new@toothcare.local',
            'password' => 'StrongPass123!',
            'role' => 'RECEPTIONIST',
            'first_name' => 'Dup',
            'last_name' => 'Test',
        ]));
        $this->assertSame(409, $resDup->getStatusCode());

        // 3. List and filter users by role
        $resList = $this->app->handle($this->createAuthRequest(
            'GET',
            '/api/v1/admin/users',
            $this->adminUser,
            [],
            ['role' => 'DENTIST']
        ));
        $this->assertSame(200, $resList->getStatusCode());
        $listBody = json_decode($resList->getBody(), true);
        $this->assertGreaterThanOrEqual(1, count($listBody['data']));
    }

    public function testSuperAdminLockoutPreventionEnforcedOnStatusAndRoleChange(): void
    {
        // Only 1 active ADMIN exists (super.admin@toothcare.local)
        $resDeactivate = $this->app->handle($this->createAuthRequest(
            'PATCH',
            "/api/v1/admin/users/{$this->adminUser['id']}/status",
            $this->adminUser,
            ['is_active' => 0]
        ));
        $this->assertSame(403, $resDeactivate->getStatusCode());
        $err1 = json_decode($resDeactivate->getBody(), true)['error'];
        $this->assertSame('ADMIN_LOCKOUT_PREVENTED', $err1['code']);

        // Demoting the last active ADMIN must also be blocked
        $resDemote = $this->app->handle($this->createAuthRequest(
            'PATCH',
            "/api/v1/admin/users/{$this->adminUser['id']}/role",
            $this->adminUser,
            ['role' => 'RECEPTIONIST']
        ));
        $this->assertSame(403, $resDemote->getStatusCode());
        $err2 = json_decode($resDemote->getBody(), true)['error'];
        $this->assertSame('ADMIN_LOCKOUT_PREVENTED', $err2['code']);

        // Deactivating a non-last user succeeds cleanly
        $resDeactRec = $this->app->handle($this->createAuthRequest(
            'PATCH',
            "/api/v1/admin/users/{$this->receptionistUser['id']}/status",
            $this->adminUser,
            ['is_active' => 0]
        ));
        $this->assertSame(200, $resDeactRec->getStatusCode());
        $updatedRec = json_decode($resDeactRec->getBody(), true)['data'];
        $this->assertFalse($updatedRec['is_active']);
    }

    public function testDrbacMatrixSyncAndDynamicAuthorizationMiddleware(): void
    {
        // 1. Fetch roles & permissions catalog
        $resRoles = $this->app->handle($this->createAuthRequest('GET', '/api/v1/admin/roles', $this->adminUser));
        $this->assertSame(200, $resRoles->getStatusCode());
        $roles = json_decode($resRoles->getBody(), true)['data'];
        $this->assertCount(4, $roles);

        $resPerms = $this->app->handle($this->createAuthRequest('GET', '/api/v1/admin/permissions', $this->adminUser));
        $this->assertSame(200, $resPerms->getStatusCode());
        $permData = json_decode($resPerms->getBody(), true)['data'];
        $this->assertArrayHasKey('grouped', $permData);

        // 2. Sync permissions for Receptionist (role id = 4): remove 'patients.manage'
        $resSync = $this->app->handle($this->createAuthRequest(
            'PUT',
            '/api/v1/admin/roles/4/permissions',
            $this->adminUser,
            ['permissions' => ['patients.view', 'appointments.view']]
        ));
        $this->assertSame(200, $resSync->getStatusCode());
        $this->assertTrue($this->roleRepo->roleHasPermission('RECEPTIONIST', 'patients.view'));
        $this->assertFalse($this->roleRepo->roleHasPermission('RECEPTIONIST', 'patients.manage'));

        // 3. Test dynamic AuthorizationMiddleware::hasPermission()
        $middleware = AuthorizationMiddleware::hasPermission('patients.manage');
        $reqAllowed = $this->createAuthRequest('GET', '/test', $this->adminUser);
        $nextCalled = false;
        $middleware->handle($reqAllowed, function () use (&$nextCalled) {
            $nextCalled = true;
            return \App\Core\Response::success(['ok' => true]);
        });
        $this->assertTrue($nextCalled);

        // Receptionist now lacks patients.manage dynamically
        $reqDenied = $this->createAuthRequest('GET', '/test', $this->receptionistUser);
        $this->expectException(\App\Core\HttpException::class);
        $middleware->handle($reqDenied, fn() => \App\Core\Response::success([]));
    }

    public function testDrbacProtectsCoreAdminPermissionsFromLockout(): void
    {
        // Attempt to strip ALL permissions from Admin role (id = 1)
        $resSync = $this->app->handle($this->createAuthRequest(
            'PUT',
            '/api/v1/admin/roles/1/permissions',
            $this->adminUser,
            ['permissions' => []]
        ));
        $this->assertSame(200, $resSync->getStatusCode());
        $updated = json_decode($resSync->getBody(), true)['data'];

        // Core permissions must still remain enforced
        foreach (RoleRepository::PROTECTED_ADMIN_PERMISSIONS as $protected) {
            $this->assertContains($protected, $updated['permissions']);
        }
    }

    public function testAuditLogFilteringCsvExportAndSecurityEvents(): void
    {
        $this->auditRepo->record('AUTH_LOGIN_FAILED', 'users', $this->patientUser['id'], null, '192.168.1.10', 'TestAgent', ['reason' => 'INVALID_CREDENTIALS']);
        $this->auditRepo->record('PATIENT_PROFILE_UPDATED', 'patients', 1, $this->adminUser['id'], '10.0.0.1', 'AdminAgent', ['field' => 'phone']);

        // 1. Filter audit logs by target_type
        $resFiltered = $this->app->handle($this->createAuthRequest(
            'GET',
            '/api/v1/admin/audit-logs',
            $this->adminUser,
            [],
            ['target_type' => 'patients']
        ));
        $this->assertSame(200, $resFiltered->getStatusCode());
        $logs = json_decode($resFiltered->getBody(), true)['data'];
        $this->assertCount(1, $logs);
        $this->assertSame('PATIENT_PROFILE_UPDATED', $logs[0]['action']);

        // 2. Security events endpoint
        $resSec = $this->app->handle($this->createAuthRequest('GET', '/api/v1/admin/security/events', $this->adminUser));
        $this->assertSame(200, $resSec->getStatusCode());
        $secEvents = json_decode($resSec->getBody(), true)['data'];
        $this->assertGreaterThanOrEqual(1, count($secEvents));
        $this->assertSame('AUTH_LOGIN_FAILED', $secEvents[0]['action']);

        // 3. CSV export
        $resExport = $this->app->handle($this->createAuthRequest('GET', '/api/v1/admin/audit-logs/export', $this->adminUser));
        $this->assertSame(200, $resExport->getStatusCode());
        $this->assertStringContainsString('Timestamp (UTC)', $resExport->getBody());
        $this->assertStringContainsString('AUTH_LOGIN_FAILED', $resExport->getBody());
    }

    public function testClinicSettingsReportsAndSystemHealthEndpoints(): void
    {
        // 1. Settings fetch & update
        $resGetSet = $this->app->handle($this->createAuthRequest('GET', '/api/v1/admin/clinic/settings', $this->adminUser));
        $this->assertSame(200, $resGetSet->getStatusCode());

        $resUpdSet = $this->app->handle($this->createAuthRequest('PUT', '/api/v1/admin/clinic/settings', $this->adminUser, [
            'clinic_name' => 'ToothCare Premier Clinic',
            'cancellation_cutoff_hours' => 48,
        ]));
        $this->assertSame(200, $resUpdSet->getStatusCode());
        $updatedSettings = json_decode($resUpdSet->getBody(), true)['data'];
        $this->assertSame('ToothCare Premier Clinic', $updatedSettings['clinic_name']['value']);

        // 2. Reports
        $resApptRep = $this->app->handle($this->createAuthRequest('GET', '/api/v1/admin/reports/appointments', $this->adminUser));
        $this->assertSame(200, $resApptRep->getStatusCode());

        $resRevRep = $this->app->handle($this->createAuthRequest('GET', '/api/v1/admin/reports/revenue', $this->adminUser));
        $this->assertSame(200, $resRevRep->getStatusCode());

        $resDentRep = $this->app->handle($this->createAuthRequest('GET', '/api/v1/admin/reports/dentists', $this->adminUser));
        $this->assertSame(200, $resDentRep->getStatusCode());

        // 3. System Health
        $resHealth = $this->app->handle($this->createAuthRequest('GET', '/api/v1/admin/system/health', $this->adminUser));
        $this->assertSame(200, $resHealth->getStatusCode());
        $health = json_decode($resHealth->getBody(), true)['data'];
        $this->assertSame('operational', $health['system_status']);
        $this->assertArrayHasKey('database', $health['services']);
        $this->assertArrayHasKey('php_fpm', $health['services']);
    }

    public function testLiveRouteDrbacEnforcementAuthMeHydrationAndBeforeAfterDiffs(): void
    {
        // 1. /auth/me hydrates effective DRBAC permissions for user roles
        $resMeAdmin = $this->app->handle($this->createAuthRequest('GET', '/api/v1/auth/me', $this->adminUser));
        $this->assertSame(200, $resMeAdmin->getStatusCode());
        $meAdmin = json_decode($resMeAdmin->getBody(), true)['data'];
        $this->assertIsArray($meAdmin['permissions'] ?? null);
        $this->assertContains('roles.manage', $meAdmin['permissions']);

        $resMeRec = $this->app->handle($this->createAuthRequest('GET', '/api/v1/auth/me', $this->receptionistUser));
        $this->assertSame(200, $resMeRec->getStatusCode());
        $meRec = json_decode($resMeRec->getBody(), true)['data'];
        $this->assertIsArray($meRec['permissions'] ?? null);
        $this->assertContains('patients.manage', $meRec['permissions']);
        $this->assertNotContains('reports.view', $meRec['permissions']);

        // 2. Receptionist lacks reports.view initially -> 403 FORBIDDEN
        $resRepDenied = $this->app->handle($this->createAuthRequest('GET', '/api/v1/admin/reports/appointments', $this->receptionistUser));
        $this->assertSame(403, $resRepDenied->getStatusCode());
        $this->assertSame('FORBIDDEN', json_decode($resRepDenied->getBody(), true)['error']['code'] ?? null);

        // 3. Grant reports.view + patients.view + patients.manage to Receptionist (role id = 4) -> reports immediately allowed (200)
        $resGrant = $this->app->handle($this->createAuthRequest(
            'PUT',
            '/api/v1/admin/roles/4/permissions',
            $this->adminUser,
            ['permissions' => ['patients.view', 'patients.manage', 'reports.view']]
        ));
        $this->assertSame(200, $resGrant->getStatusCode());

        $resRepAllowed = $this->app->handle($this->createAuthRequest('GET', '/api/v1/admin/reports/appointments', $this->receptionistUser));
        $this->assertSame(200, $resRepAllowed->getStatusCode());

        // 4. Create patient profile and confirm Receptionist can update while holding patients.manage
        $pdo = Database::getInstance()->getConnection();
        $stmt = $pdo->prepare('
            INSERT INTO patients (user_id, first_name, last_name, date_of_birth, phone, gender)
            VALUES (?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([$this->patientUser['id'], 'Elena', 'Reyes', '1994-05-10', '+63 917 000 1111', 'FEMALE']);
        $patientId = (int) $pdo->lastInsertId();

        $resPatUpdOk = $this->app->handle($this->createAuthRequest(
            'PUT',
            "/api/v1/admin/patients/{$patientId}",
            $this->receptionistUser,
            ['phone' => '+63 917 555 0199']
        ));
        $this->assertSame(200, $resPatUpdOk->getStatusCode());

        // 5. Revoke patients.manage from Receptionist -> PUT /admin/patients/{id} immediately blocked (403) while GET still works (200)
        $resRevoke = $this->app->handle($this->createAuthRequest(
            'PUT',
            '/api/v1/admin/roles/4/permissions',
            $this->adminUser,
            ['permissions' => ['patients.view']]
        ));
        $this->assertSame(200, $resRevoke->getStatusCode());

        $resPatUpdDenied = $this->app->handle($this->createAuthRequest(
            'PUT',
            "/api/v1/admin/patients/{$patientId}",
            $this->receptionistUser,
            ['phone' => '+63 917 999 8888']
        ));
        $this->assertSame(403, $resPatUpdDenied->getStatusCode());
        $this->assertSame('FORBIDDEN', json_decode($resPatUpdDenied->getBody(), true)['error']['code'] ?? null);

        $resPatReadOk = $this->app->handle($this->createAuthRequest('GET', "/api/v1/admin/patients/{$patientId}", $this->receptionistUser));
        $this->assertSame(200, $resPatReadOk->getStatusCode());

        // 6. Verify Before/After audit diffs for role changes, role permission sync, and settings
        $this->app->handle($this->createAuthRequest(
            'PATCH',
            "/api/v1/admin/users/{$this->receptionistUser['id']}/role",
            $this->adminUser,
            ['role' => 'DENTIST']
        ));
        $this->app->handle($this->createAuthRequest(
            'PUT',
            '/api/v1/admin/clinic/settings',
            $this->adminUser,
            ['clinic_name' => 'ToothCare Diff Clinic']
        ));

        $resRoleLogs = $this->app->handle($this->createAuthRequest(
            'GET',
            '/api/v1/admin/audit-logs',
            $this->adminUser,
            [],
            ['action' => 'ROLE_PERMISSIONS_UPDATED']
        ));
        $roleLogPayload = json_decode($resRoleLogs->getBody(), true)['data'][0]['payload'] ?? [];
        $this->assertArrayHasKey('before', $roleLogPayload);
        $this->assertArrayHasKey('after', $roleLogPayload);

        $resSetLogs = $this->app->handle($this->createAuthRequest(
            'GET',
            '/api/v1/admin/audit-logs',
            $this->adminUser,
            [],
            ['action' => 'CLINIC_SETTINGS_UPDATED']
        ));
        $setLogPayload = json_decode($resSetLogs->getBody(), true)['data'][0]['payload'] ?? [];
        $this->assertSame('ToothCare Hub', $setLogPayload['before']['clinic_name'] ?? null);
        $this->assertSame('ToothCare Diff Clinic', $setLogPayload['after']['clinic_name'] ?? null);

        // 7. Verify Security Events stream captures multi-type auth & permission events
        $this->auditRepo->record('AUTH_LOGIN_FAILED', 'users', $this->patientUser['id'], null, '192.168.1.20', 'TestAgent', ['reason' => 'BAD_PW']);
        $this->auditRepo->record('AUTH_LOGIN_RATE_LIMITED', 'users', $this->patientUser['id'], null, '192.168.1.20', 'TestAgent', ['hits' => 5]);
        $resSecStream = $this->app->handle($this->createAuthRequest('GET', '/api/v1/admin/security/events', $this->adminUser));
        $this->assertSame(200, $resSecStream->getStatusCode());
        $secActions = array_column(json_decode($resSecStream->getBody(), true)['data'], 'action');
        $this->assertContains('AUTH_LOGIN_FAILED', $secActions);
        $this->assertContains('AUTH_LOGIN_RATE_LIMITED', $secActions);
        $this->assertContains('ROLE_PERMISSIONS_UPDATED', $secActions);
        $this->assertContains('USER_ROLE_UPDATED', $secActions);
    }

    public function testStaffAccountsStoreAndExposeFullNamesInAuthAndDirectory(): void
    {
        $resCreateRec = $this->app->handle($this->createAuthRequest('POST', '/api/v1/admin/users', $this->adminUser, [
            'email' => 'clarisse.mendoza@toothcare.local',
            'password' => 'StrongPass123!',
            'role' => 'RECEPTIONIST',
            'first_name' => 'Clarisse',
            'last_name' => 'Mendoza',
        ]));

        $this->assertSame(201, $resCreateRec->getStatusCode());
        $createdRec = json_decode($resCreateRec->getBody(), true)['data'];
        $this->assertSame('Clarisse', $createdRec['first_name']);
        $this->assertSame('Mendoza', $createdRec['last_name']);
        $this->assertSame('Clarisse Mendoza', $createdRec['display_name']);

        // AuthService::login and AuthService::getCurrentUser expose resolved display_name rather than raw email
        $authService = new \App\Services\AuthService();
        $loginPayload = $authService->login([
            'email' => 'clarisse.mendoza@toothcare.local',
            'password' => 'StrongPass123!',
        ]);
        $this->assertSame('Clarisse', $loginPayload['first_name']);
        $this->assertSame('Mendoza', $loginPayload['last_name']);
        $this->assertSame('Clarisse Mendoza', $loginPayload['display_name']);

        $mePayload = $authService->getCurrentUser((int) $createdRec['id']);
        $this->assertSame('Clarisse Mendoza', $mePayload['display_name']);
    }
}
