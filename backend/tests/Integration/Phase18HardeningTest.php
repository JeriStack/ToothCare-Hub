<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Logger;
use App\Core\Request;
use App\Middleware\CsrfMiddleware;
use App\Repositories\UserRepository;
use App\Services\DatabaseBackupService;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Phase 18 — Security, Privacy, Logging, and Database Hardening Verification Suite.
 */
class Phase18HardeningTest extends TestCase
{
    private Application $app;
    private array $adminUser;
    private array $patientOne;
    private array $patientTwo;

    protected function setUp(): void
    {
        $_SESSION = [];
        TestDb::create();
        $this->app = new Application(null, false);

        $userRepo = new UserRepository();
        $hash = password_hash('SyntheticPass123!', PASSWORD_BCRYPT);

        $adminId = $userRepo->create('p18.admin@example.com', $hash, 'ADMIN', 1, 1);
        $this->adminUser = $userRepo->findById($adminId);

        $p1Id = $userRepo->create('p18.patient1@example.com', $hash, 'PATIENT', 1, 1);
        $this->patientOne = $userRepo->findById($p1Id);

        $p2Id = $userRepo->create('p18.patient2@example.com', $hash, 'PATIENT', 1, 1);
        $this->patientTwo = $userRepo->findById($p2Id);
    }

    public function testUserAvatarEndpointRequiresAuthAndEnforcesOwnership(): void
    {
        $targetId = (int) $this->patientTwo['id'];

        // 1. Unauthenticated caller MUST be rejected with 401
        $unauth = $this->app->handle(Request::create('GET', "/api/v1/users/{$targetId}/avatar"));
        $this->assertSame(401, $unauth->getStatusCode());

        // 2. Cross-patient IDOR attempt MUST be rejected with 403
        $idorReq = Request::create('GET', "/api/v1/users/{$targetId}/avatar");
        $idorReq->setUser($this->patientOne);
        $idor = $this->app->handle($idorReq);
        $this->assertSame(403, $idor->getStatusCode());

        // 3. Owner is authorized (404 when no avatar uploaded yet, NOT 403)
        $ownerReq = Request::create('GET', "/api/v1/users/{$targetId}/avatar");
        $ownerReq->setUser($this->patientTwo);
        $owner = $this->app->handle($ownerReq);
        $this->assertSame(404, $owner->getStatusCode());

        // 4. Admin is authorized (404 when no avatar uploaded yet, NOT 403)
        $adminReq = Request::create('GET', "/api/v1/users/{$targetId}/avatar");
        $adminReq->setUser($this->adminUser);
        $admin = $this->app->handle($adminReq);
        $this->assertSame(404, $admin->getStatusCode());
    }

    public function testCsrfMiddlewareBlocksUnsafeRequestWhenSessionIsAuthenticatedWithoutToken(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            @session_start();
        }
        $_SESSION['user_id'] = (int) $this->patientOne['id'];
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

        try {
            $mw = new CsrfMiddleware();

            // Missing token -> 403 CSRF invalid
            $badReq = Request::create('POST', '/api/v1/appointments');
            $this->expectException(\App\Core\HttpException::class);
            try {
                $mw->handle($badReq, fn () => \App\Core\Response::success(['ok' => true]));
            } finally {
                // Verify valid token succeeds
                $goodReq = Request::create('POST', '/api/v1/appointments', [
                    'x-csrf-token' => $_SESSION['csrf_token'],
                ]);
                $res = $mw->handle($goodReq, fn () => \App\Core\Response::success(['ok' => true]));
                $this->assertSame(200, $res->getStatusCode());
            }
        } finally {
            $_SESSION = [];
        }
    }

    public function testLoggerRedactsClinicalFieldsAndSecrets(): void
    {
        $logger = new Logger(sys_get_temp_dir() . '/toothcare_p18_test.log', 'debug');
        $redacted = $logger->redact([
            'user_id' => 7,
            'password_hash' => '$2y$10$fakehash',
            'session_id' => 'sess_abc123',
            'verification_token' => 'tok_verify_123',
            'smtp_password' => 'smtp_secret_val',
            'realtime_internal_secret' => 'rt_secret_val',
            'clinical_notes' => 'Root canal on tooth #14',
            'diagnosis' => 'Pulpitis',
            'medical_alerts' => 'Penicillin allergy',
            'custom_api_secret' => 'xyz',
            'nested' => [
                'reset_token' => 'tok_reset_456',
                'safe_field' => 'visible',
            ],
        ]);

        $this->assertSame(7, $redacted['user_id']);
        $this->assertSame('***REDACTED***', $redacted['password_hash']);
        $this->assertSame('***REDACTED***', $redacted['session_id']);
        $this->assertSame('***REDACTED***', $redacted['verification_token']);
        $this->assertSame('***REDACTED***', $redacted['smtp_password']);
        $this->assertSame('***REDACTED***', $redacted['realtime_internal_secret']);
        $this->assertSame('***REDACTED***', $redacted['clinical_notes']);
        $this->assertSame('***REDACTED***', $redacted['diagnosis']);
        $this->assertSame('***REDACTED***', $redacted['medical_alerts']);
        $this->assertSame('***REDACTED***', $redacted['custom_api_secret']);
        $this->assertSame('***REDACTED***', $redacted['nested']['reset_token']);
        $this->assertSame('visible', $redacted['nested']['safe_field']);
    }

    public function testDatabaseBackupIdentifierValidationRejectsInjectionPayloads(): void
    {
        $this->assertSame('toothcare_hub', DatabaseBackupService::validateDatabaseIdentifier('toothcare_hub'));
        $this->assertSame('toothcare_restore_test_2026', DatabaseBackupService::validateDatabaseIdentifier('toothcare_restore_test_2026'));

        foreach ([
            'toothcare; DROP TABLE users;--',
            'db`evil',
            '../etc/passwd',
            'db name with spaces',
            '',
        ] as $malicious) {
            $thrown = false;
            try {
                DatabaseBackupService::validateDatabaseIdentifier($malicious);
            } catch (InvalidArgumentException) {
                $thrown = true;
            }
            $this->assertTrue($thrown, "Expected InvalidArgumentException for identifier: {$malicious}");
        }
    }

    public function testRealtimeTicketEndpointIncludesRateLimitHeaders(): void
    {
        $req = Request::create('POST', '/api/v1/realtime/ticket');
        $req->setUser($this->patientOne);
        $res = $this->app->handle($req);

        $this->assertSame(200, $res->getStatusCode());
        $headers = array_change_key_case($res->getHeaders(), CASE_LOWER);
        $this->assertArrayHasKey('x-ratelimit-limit', $headers);
        $this->assertArrayHasKey('x-ratelimit-remaining', $headers);
    }
}
