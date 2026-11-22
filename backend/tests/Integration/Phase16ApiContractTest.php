<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Request;
use App\Repositories\UserRepository;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Yaml\Yaml;
use Tests\Support\TestDb;

/**
 * Phase 16 API Contract Verification Suite.
 * Validates OpenAPI 3.x specification completeness, standard JSON envelopes,
 * HTTP status codes (200, 400, 401, 403, 404, 422), pagination metadata, and internal-route exclusion.
 */
class Phase16ApiContractTest extends TestCase
{
    private Application $app;
    private array $adminUser;
    private array $patientUser;

    protected function setUp(): void
    {
        $_SESSION = [];
        TestDb::create();
        $this->app = new Application(null, false);

        $userRepo = new UserRepository();
        $hash = password_hash('Password123!', PASSWORD_BCRYPT);
        $adminId = $userRepo->create('contract.admin@example.com', $hash, 'ADMIN', 1, 1);
        $this->adminUser = $userRepo->findById($adminId);

        $patId = $userRepo->create('contract.patient@example.com', $hash, 'PATIENT', 1, 1);
        $this->patientUser = $userRepo->findById($patId);
    }

    public function testOpenApiSpecificationContainsRequiredPathsSchemasAndExcludesInternalRoutes(): void
    {
        $specPath = realpath(dirname(__DIR__, 2) . '/openapi/openapi.yaml');
        $this->assertNotFalse($specPath);
        $this->assertFileExists($specPath);

        $raw = file_get_contents($specPath);
        $this->assertNotFalse($raw);
        $spec = Yaml::parse($raw);
        $this->assertStringStartsWith('3.', (string) ($spec['openapi'] ?? ''));

        $paths = array_keys($spec['paths'] ?? []);
        $this->assertGreaterThanOrEqual(55, count($paths));

        // Verify key Phase 14 & Phase 15 endpoints are documented
        foreach ([
            '/health',
            '/auth/login',
            '/appointments',
            '/appointments/search',
            '/admin/dashboard/summary',
            '/admin/reports/appointments',
            '/admin/reports/services',
            '/admin/reports/patients',
            '/admin/reports/dentists',
            '/admin/operations/outbox',
            '/admin/operations/errors',
            '/notifications',
            '/realtime/ticket',
        ] as $expectedPath) {
            $this->assertContains($expectedPath, $paths, "Missing OpenAPI path: {$expectedPath}");
        }

        // Internal service-to-service routes MUST NOT be exposed as public OpenAPI endpoints
        foreach ($paths as $path) {
            $this->assertStringNotContainsString('/internal/', $path, "Internal route leaked into OpenAPI spec: {$path}");
        }
    }

    public function testApiResponseEnvelopesAndStatusCodeContracts(): void
    {
        // 200 Standard Envelope: { data, meta, error: null }
        $health = $this->app->handle(Request::create('GET', '/api/v1/health'));
        $this->assertSame(200, $health->getStatusCode());
        $healthJson = json_decode($health->getBody(), true);
        $this->assertArrayHasKey('data', $healthJson);
        $this->assertArrayHasKey('meta', $healthJson);
        $this->assertNull($healthJson['error']);

        // 401 Unauthenticated ErrorEnvelope: { data: null, meta, error: { code, message } }
        $unauth = $this->app->handle(Request::create('GET', '/api/v1/auth/me'));
        $this->assertSame(401, $unauth->getStatusCode());
        $unauthJson = json_decode($unauth->getBody(), true);
        $this->assertNull($unauthJson['data']);
        $this->assertIsArray($unauthJson['error']);
        $this->assertArrayHasKey('code', $unauthJson['error']);
        $this->assertArrayHasKey('message', $unauthJson['error']);

        // 403 Forbidden ErrorEnvelope
        $forbidReq = Request::create('GET', '/api/v1/admin/dashboard/summary');
        $forbidReq->setUser($this->patientUser);
        $forbid = $this->app->handle($forbidReq);
        $this->assertSame(403, $forbid->getStatusCode());
        $forbidJson = json_decode($forbid->getBody(), true);
        $this->assertNull($forbidJson['data']);
        $this->assertIsArray($forbidJson['error']);

        // 400 Invalid resource ID
        $badIdReq = Request::create('GET', '/api/v1/appointments/0');
        $badIdReq->setUser($this->adminUser);
        $badId = $this->app->handle($badIdReq);
        $this->assertSame(400, $badId->getStatusCode());

        // 404 Nonexistent resource
        $notFoundReq = Request::create('GET', '/api/v1/appointments/999999');
        $notFoundReq->setUser($this->adminUser);
        $notFound = $this->app->handle($notFoundReq);
        $this->assertSame(404, $notFound->getStatusCode());

        // 422 Validation error on invalid date range
        $badDateReq = Request::create('GET', '/api/v1/appointments/search', [], '', [
            'start_date' => '2026-12-20',
            'end_date' => '2026-12-01',
        ]);
        $badDateReq->setUser($this->adminUser);
        $badDate = $this->app->handle($badDateReq);
        $this->assertSame(422, $badDate->getStatusCode());

        // Paginated metadata contract
        $pagedReq = Request::create('GET', '/api/v1/appointments/search', [], '', ['page' => '1', 'limit' => '10']);
        $pagedReq->setUser($this->adminUser);
        $paged = $this->app->handle($pagedReq);
        $this->assertSame(200, $paged->getStatusCode());
        $pagedJson = json_decode($paged->getBody(), true);
        $this->assertNull($pagedJson['error']);
        $this->assertIsArray($pagedJson['data']);
        $this->assertArrayHasKey('meta', $pagedJson);
        foreach (['total', 'page', 'per_page', 'last_page'] as $key) {
            $this->assertArrayHasKey($key, $pagedJson['meta']);
        }
    }
}
