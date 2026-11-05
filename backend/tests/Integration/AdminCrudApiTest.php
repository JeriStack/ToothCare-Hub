<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Database;
use App\Core\Request;
use App\Repositories\UserRepository;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

class AdminCrudApiTest extends TestCase
{
    private Application $app;
    private UserRepository $userRepository;
    private array $adminUser;
    private array $patientUser;

    protected function setUp(): void
    {
        TestDb::create();
        $this->app = new Application(null, false);
        $this->userRepository = new UserRepository();

        // 1. Create Admin Account
        $adminId = $this->userRepository->create(
            'admin@toothcare.com',
            password_hash('AdminPass123!', PASSWORD_BCRYPT),
            'ADMIN',
            1,
            1
        );
        $this->adminUser = $this->userRepository->findById($adminId);

        // 2. Create Regular Patient Account
        $patientId = $this->userRepository->create(
            'patient.regular@example.com',
            password_hash('PatientPass123!', PASSWORD_BCRYPT),
            'PATIENT',
            1,
            1
        );
        $this->patientUser = $this->userRepository->findById($patientId);
    }

    // ==========================================
    // 1. RBAC SECURITY BOUNDARIES
    // ==========================================

    public function testAdminEndpointsRejectUnauthenticatedAccess(): void
    {
        $endpoints = [
            ['GET', '/api/v1/admin/dashboard'],
            ['GET', '/api/v1/admin/services'],
            ['POST', '/api/v1/admin/services'],
            ['GET', '/api/v1/admin/dentists'],
            ['POST', '/api/v1/admin/dentists'],
            ['GET', '/api/v1/admin/patients'],
        ];

        foreach ($endpoints as [$method, $uri]) {
            $req = Request::create($method, $uri);
            $res = $this->app->handle($req);

            $this->assertSame(401, $res->getStatusCode(), "Endpoint {$method} {$uri} must require authentication.");
            $data = json_decode($res->getBody(), true);
            $this->assertSame('AUTHENTICATION_REQUIRED', $data['error']['code'] ?? null);
        }
    }

    public function testAdminEndpointsRejectNonAdminAccess(): void
    {
        $endpoints = [
            ['GET', '/api/v1/admin/dashboard'],
            ['GET', '/api/v1/admin/services'],
            ['GET', '/api/v1/admin/dentists'],
            ['GET', '/api/v1/admin/patients'],
        ];

        foreach ($endpoints as [$method, $uri]) {
            $req = Request::create($method, $uri);
            $req->setUser($this->patientUser);
            $res = $this->app->handle($req);

            $this->assertSame(403, $res->getStatusCode(), "Endpoint {$method} {$uri} must reject non-admin users with 403.");
            $data = json_decode($res->getBody(), true);
            $this->assertSame('FORBIDDEN', $data['error']['code'] ?? null);
        }
    }

    // ==========================================
    // 2. DENTAL SERVICES CRUD
    // ==========================================

    public function testServiceLifecycleAndValidation(): void
    {
        // A. Validation: Rejects negative price
        $reqNeg = Request::create('POST', '/api/v1/admin/services', [
            'content-type' => 'application/json',
        ], json_encode([
            'name' => 'Bad Service',
            'price' => -100.00,
            'duration_minutes' => 30,
        ]));
        $reqNeg->setUser($this->adminUser);
        $resNeg = $this->app->handle($reqNeg);
        $this->assertSame(422, $resNeg->getStatusCode());

        // B. Validation: Rejects invalid duration
        $reqDur = Request::create('POST', '/api/v1/admin/services', [
            'content-type' => 'application/json',
        ], json_encode([
            'name' => 'Bad Duration Service',
            'price' => 1000.00,
            'duration_minutes' => 77, // Invalid duration
        ]));
        $reqDur->setUser($this->adminUser);
        $resDur = $this->app->handle($reqDur);
        $this->assertSame(422, $resDur->getStatusCode());

        // C. Create Valid Service
        $reqCreate = Request::create('POST', '/api/v1/admin/services', [
            'content-type' => 'application/json',
        ], json_encode([
            'name' => 'Oral Prophylaxis Level 1',
            'category' => 'Preventive',
            'description' => 'Light scaling and stain removal.',
            'price' => 1200.00,
            'duration_minutes' => 30,
            'is_active' => 1,
        ]));
        $reqCreate->setUser($this->adminUser);
        $resCreate = $this->app->handle($reqCreate);
        $this->assertSame(201, $resCreate->getStatusCode());

        $createdData = $resCreate->getData();
        $serviceId = (int) $createdData['id'];
        $this->assertGreaterThan(0, $serviceId);
        $this->assertSame('Oral Prophylaxis Level 1', $createdData['name']);

        // D. Rejects Duplicate Name (409 Conflict)
        $reqDup = Request::create('POST', '/api/v1/admin/services', [
            'content-type' => 'application/json',
        ], json_encode([
            'name' => 'Oral Prophylaxis Level 1',
            'price' => 1500.00,
            'duration_minutes' => 30,
        ]));
        $reqDup->setUser($this->adminUser);
        $resDup = $this->app->handle($reqDup);
        $this->assertSame(409, $resDup->getStatusCode());

        // E. Retrieve Single Service
        $reqGet = Request::create('GET', "/api/v1/admin/services/{$serviceId}");
        $reqGet->setUser($this->adminUser);
        $resGet = $this->app->handle($reqGet);
        $this->assertSame(200, $resGet->getStatusCode());
        $this->assertSame('Preventive', $resGet->getData()['category']);

        // F. Update Service
        $reqUpdate = Request::create('PUT', "/api/v1/admin/services/{$serviceId}", [
            'content-type' => 'application/json',
        ], json_encode([
            'price' => 1350.00,
            'duration_minutes' => 45,
        ]));
        $reqUpdate->setUser($this->adminUser);
        $resUpdate = $this->app->handle($reqUpdate);
        $this->assertSame(200, $resUpdate->getStatusCode());
        $this->assertEquals(1350.00, $resUpdate->getData()['price']);
        $this->assertEquals(45, $resUpdate->getData()['duration_minutes']);

        // G. Deactivate Service
        $reqDeact = Request::create('PATCH', "/api/v1/admin/services/{$serviceId}/status", [
            'content-type' => 'application/json',
        ], json_encode(['is_active' => 0]));
        $reqDeact->setUser($this->adminUser);
        $resDeact = $this->app->handle($reqDeact);
        $this->assertSame(200, $resDeact->getStatusCode());
        $this->assertSame(0, (int) $resDeact->getData()['is_active']);

        // H. Public Endpoint Excludes Inactive Services
        $reqPublic = Request::create('GET', '/api/v1/services');
        $resPublic = $this->app->handle($reqPublic);
        $this->assertSame(200, $resPublic->getStatusCode());
        $this->assertEmpty($resPublic->getData(), 'Deactivated service must not appear in public listing.');

        // I. Reactivate Service
        $reqReactivate = Request::create('PATCH', "/api/v1/admin/services/{$serviceId}/status", [
            'content-type' => 'application/json',
        ], json_encode(['is_active' => 1]));
        $reqReactivate->setUser($this->adminUser);
        $resReactivate = $this->app->handle($reqReactivate);
        $this->assertSame(200, $resReactivate->getStatusCode());
        $this->assertSame(1, (int) $resReactivate->getData()['is_active']);

        // J. Public Endpoint Includes Active Service
        $resPublicActive = $this->app->handle($reqPublic);
        $this->assertCount(1, $resPublicActive->getData());
    }

    // ==========================================
    // 3. DENTISTS CRUD
    // ==========================================

    public function testDentistLifecycleAndSynchronization(): void
    {
        // A. Create Dentist
        $reqCreate = Request::create('POST', '/api/v1/admin/dentists', [
            'content-type' => 'application/json',
        ], json_encode([
            'first_name' => 'Roberto',
            'last_name' => 'Reyes',
            'email' => 'dr.reyes@toothcare.com',
            'password' => 'ToothCare!2026',
            'license_number' => 'PRC-DEN-008888',
            'specialization' => 'Endodontics',
            'phone' => '+639171239999',
            'default_operatory_chair' => 'Chair 2',
            'bio' => 'Experienced root canal specialist.',
            'is_active' => 1,
        ]));
        $reqCreate->setUser($this->adminUser);
        $resCreate = $this->app->handle($reqCreate);
        $this->assertSame(201, $resCreate->getStatusCode());

        $dentistData = $resCreate->getData();
        $dentistId = (int) $dentistData['id'];
        $dentistUserId = (int) $dentistData['user_id'];
        $this->assertGreaterThan(0, $dentistId);
        $this->assertGreaterThan(0, $dentistUserId);

        // B. Rejects Duplicate License Number (409 Conflict)
        $reqDup = Request::create('POST', '/api/v1/admin/dentists', [
            'content-type' => 'application/json',
        ], json_encode([
            'first_name' => 'Carlos',
            'last_name' => 'Cruz',
            'email' => 'dr.cruz@toothcare.com',
            'password' => 'ToothCare!2026',
            'license_number' => 'PRC-DEN-008888', // Duplicate license
            'specialization' => 'General',
            'phone' => '+639170001111',
        ]));
        $reqDup->setUser($this->adminUser);
        $resDup = $this->app->handle($reqDup);
        $this->assertSame(409, $resDup->getStatusCode());

        // C. Update Dentist
        $reqUpdate = Request::create('PUT', "/api/v1/admin/dentists/{$dentistId}", [
            'content-type' => 'application/json',
        ], json_encode([
            'specialization' => 'Pediatric Dentistry',
            'default_operatory_chair' => 'Chair 4',
        ]));
        $reqUpdate->setUser($this->adminUser);
        $resUpdate = $this->app->handle($reqUpdate);
        $this->assertSame(200, $resUpdate->getStatusCode());
        $this->assertSame('Pediatric Dentistry', $resUpdate->getData()['specialization']);
        $this->assertSame('Chair 4', $resUpdate->getData()['default_operatory_chair']);

        // D. Deactivate Dentist - Synchronizes User Login Account
        $reqDeact = Request::create('PATCH', "/api/v1/admin/dentists/{$dentistId}/status", [
            'content-type' => 'application/json',
        ], json_encode(['is_active' => 0]));
        $reqDeact->setUser($this->adminUser);
        $resDeact = $this->app->handle($reqDeact);
        $this->assertSame(200, $resDeact->getStatusCode());
        $this->assertSame(0, (int) $resDeact->getData()['is_active']);

        $userRecord = $this->userRepository->findById($dentistUserId);
        $this->assertSame(0, (int) $userRecord['is_active'], 'User account must be synchronized to inactive.');

        // E. Public Endpoint Excludes Inactive Dentist
        $reqPublic = Request::create('GET', '/api/v1/dentists');
        $resPublic = $this->app->handle($reqPublic);
        $this->assertEmpty($resPublic->getData());
    }

    // ==========================================
    // 4. PATIENTS MANAGEMENT & DASHBOARD
    // ==========================================

    public function testPatientRegistryAndDashboardMetrics(): void
    {
        // Create Patient Profile
        $pdo = Database::getInstance()->getConnection();
        $pdo->exec("
            INSERT INTO patients (
                user_id, first_name, last_name, date_of_birth, phone,
                gender, address, emergency_contact_name, emergency_contact_phone,
                medical_alerts, created_at, updated_at
            ) VALUES (
                {$this->patientUser['id']}, 'Alice', 'Guin', '1995-05-15', '+639178887777',
                'FEMALE', 'Manila City', 'Bob Guin', '+639178886666',
                'Penicillin allergy', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
        ");
        $patientId = (int) $pdo->lastInsertId();

        // A. List Patients via Admin Endpoint
        $reqList = Request::create('GET', '/api/v1/admin/patients?search=Alice');
        $reqList->setUser($this->adminUser);
        $resList = $this->app->handle($reqList);
        $this->assertSame(200, $resList->getStatusCode());

        $listBody = json_decode($resList->getBody(), true);
        $this->assertCount(1, $listBody['data']);
        $this->assertSame('Alice', $listBody['data'][0]['first_name']);
        $this->assertSame(1, $listBody['meta']['total']);

        // B. Update Patient Profile
        $reqUpdate = Request::create('PUT', "/api/v1/admin/patients/{$patientId}", [
            'content-type' => 'application/json',
        ], json_encode([
            'address' => 'Quezon City, Philippines',
            'medical_alerts' => 'Penicillin allergy, Mild asthma',
        ]));
        $reqUpdate->setUser($this->adminUser);
        $resUpdate = $this->app->handle($reqUpdate);
        $this->assertSame(200, $resUpdate->getStatusCode());
        $this->assertSame('Quezon City, Philippines', $resUpdate->getData()['address']);

        // C. Deactivate Patient Account
        $reqDeact = Request::create('PATCH', "/api/v1/admin/patients/{$patientId}/status", [
            'content-type' => 'application/json',
        ], json_encode(['is_active' => 0]));
        $reqDeact->setUser($this->adminUser);
        $resDeact = $this->app->handle($reqDeact);
        $this->assertSame(200, $resDeact->getStatusCode());
        $this->assertSame(0, (int) $resDeact->getData()['is_active']);

        // D. Administrative Dashboard Returns Real Database Counts
        $reqDash = Request::create('GET', '/api/v1/admin/dashboard');
        $reqDash->setUser($this->adminUser);
        $resDash = $this->app->handle($reqDash);
        $this->assertSame(200, $resDash->getStatusCode());

        $dashData = $resDash->getData();
        $this->assertArrayHasKey('counts', $dashData);
        $this->assertArrayHasKey('patients', $dashData['counts']);
        $this->assertSame(1, $dashData['counts']['patients']['total']);
        $this->assertSame(0, $dashData['counts']['patients']['active']);
        $this->assertSame(1, $dashData['counts']['patients']['inactive']);
    }

    // ==========================================
    // 5. SQL INJECTION PREVENTION IN SORTING
    // ==========================================

    public function testSortAllowlistPreventsSqlInjection(): void
    {
        $maliciousSorts = [
            'name; DROP TABLE users; --',
            'id OR 1=1',
            '(SELECT password_hash FROM users LIMIT 1)',
            'SLEEP(5)',
        ];

        foreach ($maliciousSorts as $maliciousSort) {
            $req = Request::create('GET', '/api/v1/admin/services?sort_by=' . urlencode($maliciousSort));
            $req->setUser($this->adminUser);
            $res = $this->app->handle($req);

            // Must succeed safely by falling back to default allowlisted sort column
            $this->assertSame(200, $res->getStatusCode(), "Malicious sort parameter '{$maliciousSort}' must be sanitized by allowlist.");
        }
    }
}
