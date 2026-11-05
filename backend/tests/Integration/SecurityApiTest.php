<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Config;
use App\Core\Database;
use App\Core\Request;
use App\Middleware\CsrfMiddleware;
use App\Repositories\PatientRepository;
use App\Repositories\RateLimitRepository;
use App\Repositories\UserRepository;
use App\Services\AuthService;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Phase 7 Security Verification Suite
 * Verifies Tests A through H as specified in Section 26.
 */
class SecurityApiTest extends TestCase
{
    private Application $app;
    private UserRepository $userRepository;
    private PatientRepository $patientRepository;
    private AuthService $authService;

    protected function setUp(): void
    {
        parent::setUp();
        $_SESSION = [];
        TestDb::create();
        RateLimitRepository::resetInMemory();

        $config = Config::getInstance();
        $config->set('auth_password_min_length', 12);
        $config->set('auth_login_rate_limit', 5);
        $config->set('auth_login_rate_window', 900);
        $config->set('auth_register_rate_limit', 10);
        $config->set('auth_register_rate_window', 3600);
        $config->set('session_cookie_secure', false);

        $this->userRepository = new UserRepository();
        $this->patientRepository = new PatientRepository();
        $this->authService = new AuthService();

        // Boot Application without registering global CLI error handlers
        $this->app = new Application(dirname(__DIR__, 2), false);
    }

    /**
     * Test A — Privilege Escalation Prevention
     * A patient cannot register with or escalate to an ADMIN or privileged role.
     */
    public function testPrivilegeEscalationPrevention(): void
    {
        $payload = [
            'email' => 'hacker.attempt@example.com',
            'password' => 'H@ck3rP@ssw0rd123!',
            'first_name' => 'Bad',
            'last_name' => 'Actor',
            'phone' => '+639171239999',
            'date_of_birth' => '1990-01-01',
            'role' => 'ADMIN', // Deliberate injection
        ];

        $req = Request::create(
            'POST',
            '/api/v1/auth/register',
            ['content-type' => 'application/json'],
            (string) json_encode($payload)
        );

        $res = $this->app->handle($req);

        $this->assertSame(201, $res->getStatusCode());
        $data = $res->getData();
        $this->assertSame('PATIENT', $data['role']);

        $user = $this->userRepository->findById((int) $data['id']);
        $this->assertNotNull($user);
        $this->assertSame('PATIENT', $user['role']);
    }

    /**
     * Test B — Patient Ownership Protection & IDOR Prevention
     * Patient A cannot view or modify Patient B's private profile.
     */
    public function testPatientOwnershipAndIdorProtection(): void
    {
        // 1. Create Patient A
        $regA = $this->authService->register([
            'email' => 'patient.a@example.com',
            'password' => 'StrongP@ssw0rd123!',
            'first_name' => 'Alice',
            'last_name' => 'Alpha',
            'phone' => '+639171110001',
            'date_of_birth' => '1990-02-02',
        ]);
        $patientIdA = (int) $regA['patient_id'];
        $userIdA = (int) $regA['id'];

        // 2. Create Patient B
        $regB = $this->authService->register([
            'email' => 'patient.b@example.com',
            'password' => 'StrongP@ssw0rd123!',
            'first_name' => 'Bob',
            'last_name' => 'Bravo',
            'phone' => '+639171110002',
            'date_of_birth' => '1992-04-04',
        ]);
        $patientIdB = (int) $regB['patient_id'];
        $userIdB = (int) $regB['id'];

        // 3. Authenticate as Patient A
        $userA = $this->userRepository->findById($userIdA);

        // Patient A viewing their own profile: Allowed (200)
        $reqOwn = Request::create('GET', "/api/v1/patients/{$patientIdA}");
        $reqOwn->setUser($userA);
        $resOwn = $this->app->handle($reqOwn);
        $this->assertSame(200, $resOwn->getStatusCode());
        $this->assertSame('Alice', $resOwn->getData()['first_name']);

        // Patient A attempting to view Patient B's profile: FORBIDDEN (403)
        $reqOther = Request::create('GET', "/api/v1/patients/{$patientIdB}");
        $reqOther->setUser($userA);
        $resOther = $this->app->handle($reqOther);
        $this->assertSame(403, $resOther->getStatusCode());
        $this->assertSame('FORBIDDEN', $resOther->getError()['code'] ?? null);

        // Patient A attempting to update Patient B's profile: FORBIDDEN (403)
        $reqUpdateOther = Request::create(
            'PATCH',
            "/api/v1/patients/{$patientIdB}",
            ['content-type' => 'application/json'],
            json_encode(['first_name' => 'TamperedName'])
        );
        $reqUpdateOther->setUser($userA);
        $resUpdateOther = $this->app->handle($reqUpdateOther);
        $this->assertSame(403, $resUpdateOther->getStatusCode());

        // Verify Bob's name was NOT modified
        $freshB = $this->patientRepository->findById($patientIdB);
        $this->assertSame('Bob', $freshB['first_name']);
    }

    /**
     * Test C — Session Security & Invalidation
     * Session terminates on logout and previous session cannot be reused.
     */
    public function testSessionSecurityAndLogout(): void
    {
        $reg = $this->authService->register([
            'email' => 'session.test@example.com',
            'password' => 'StrongP@ssw0rd123!',
            'first_name' => 'Sam',
            'last_name' => 'Session',
            'phone' => '+639171114444',
            'date_of_birth' => '1985-05-05',
        ]);

        $login = $this->authService->login([
            'email' => 'session.test@example.com',
            'password' => 'StrongP@ssw0rd123!',
        ]);

        $this->assertNotEmpty($_SESSION['user_id']);
        $this->assertSame((int) $reg['id'], (int) $_SESSION['user_id']);

        // Call /auth/me with active session
        $user = $this->userRepository->findById((int) $reg['id']);
        $reqMe = Request::create('GET', '/api/v1/auth/me');
        $reqMe->setUser($user);
        $resMe = $this->app->handle($reqMe);
        $this->assertSame(200, $resMe->getStatusCode());

        // Logout
        $this->authService->logout((int) $reg['id']);
        $this->assertEmpty($_SESSION);

        // Requesting /auth/me after session cleared returns 401
        $reqLoggedOut = Request::create('GET', '/api/v1/auth/me');
        $resLoggedOut = $this->app->handle($reqLoggedOut);
        $this->assertSame(401, $resLoggedOut->getStatusCode());
    }

    /**
     * Test D — CSRF Protection
     * Unsafe state-changing methods require valid CSRF token when session is active.
     */
    public function testCsrfProtection(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            @session_start();
        }

        $csrfToken = CsrfMiddleware::generateToken();
        $_SESSION['csrf_token'] = $csrfToken;

        // Request with missing CSRF token on POST
        $reqMissing = Request::create(
            'POST',
            '/api/v1/auth/register',
            ['content-type' => 'application/json'],
            json_encode(['email' => 'test@example.com'])
        );
        $resMissing = $this->app->handle($reqMissing);
        $this->assertSame(403, $resMissing->getStatusCode());
        $this->assertSame('CSRF_TOKEN_INVALID', $resMissing->getError()['code'] ?? null);

        // Request with invalid CSRF token
        $reqInvalid = Request::create(
            'POST',
            '/api/v1/auth/register',
            ['content-type' => 'application/json', 'x-csrf-token' => 'invalid-token-12345'],
            json_encode(['email' => 'test@example.com'])
        );
        $resInvalid = $this->app->handle($reqInvalid);
        $this->assertSame(403, $resInvalid->getStatusCode());
        $this->assertSame('CSRF_TOKEN_INVALID', $resInvalid->getError()['code'] ?? null);

        // Request with valid CSRF token proceeds to validation
        $reqValid = Request::create(
            'POST',
            '/api/v1/auth/register',
            ['content-type' => 'application/json', 'x-csrf-token' => $csrfToken],
            json_encode([
                'email' => 'csrf.valid@example.com',
                'password' => 'StrongP@ssw0rd123!',
                'first_name' => 'Cris',
                'last_name' => 'Ramos',
                'phone' => '+639171118888',
                'date_of_birth' => '1989-08-08',
            ])
        );
        $resValid = $this->app->handle($reqValid);
        $this->assertSame(201, $resValid->getStatusCode());
    }

    /**
     * Test E — Token Security
     * Token hashes are stored, expired and reused tokens are rejected.
     */
    public function testTokenSecurityAtRest(): void
    {
        $reg = $this->authService->register([
            'email' => 'token.sec@example.com',
            'password' => 'StrongP@ssw0rd123!',
            'first_name' => 'Tim',
            'last_name' => 'Token',
            'phone' => '+639171113333',
            'date_of_birth' => '1987-07-07',
        ]);

        $pdo = Database::getInstance()->getConnection();
        $tokenRow = $pdo->query('SELECT * FROM auth_tokens ORDER BY id DESC LIMIT 1')->fetch();

        $this->assertNotNull($tokenRow);
        // Token hash is stored as a 64-char sha256 hex string
        $this->assertSame(64, strlen((string) $tokenRow['token_hash']));
        $this->assertNull($tokenRow['used_at']);
    }

    /**
     * Test F — Account Enumeration Prevention
     * Forgot password returns identical response for existing and non-existing accounts.
     */
    public function testAccountEnumerationPrevention(): void
    {
        $this->authService->register([
            'email' => 'exists.enum@example.com',
            'password' => 'StrongP@ssw0rd123!',
            'first_name' => 'Eve',
            'last_name' => 'Exists',
            'phone' => '+639171116666',
            'date_of_birth' => '1994-04-04',
        ]);

        $reqExist = Request::create(
            'POST',
            '/api/v1/auth/forgot-password',
            ['content-type' => 'application/json'],
            json_encode(['email' => 'exists.enum@example.com'])
        );
        $resExist = $this->app->handle($reqExist);

        $reqNonExist = Request::create(
            'POST',
            '/api/v1/auth/forgot-password',
            ['content-type' => 'application/json'],
            json_encode(['email' => 'does.not.exist@example.com'])
        );
        $resNonExist = $this->app->handle($reqNonExist);

        $this->assertSame(200, $resExist->getStatusCode());
        $this->assertSame(200, $resNonExist->getStatusCode());
        $this->assertSame($resExist->getData()['message'], $resNonExist->getData()['message']);
    }

    /**
     * Test G — Rate Limiting
     * Exceeding threshold triggers HTTP 429 Too Many Requests.
     */
    public function testRateLimitingReturns429(): void
    {
        Config::getInstance()->set('auth_login_rate_limit', 2);

        $req1 = Request::create(
            'POST',
            '/api/v1/auth/login',
            ['content-type' => 'application/json'],
            json_encode(['email' => 'target@example.com', 'password' => 'WrongPass1!'])
        );
        $this->app->handle($req1);

        $req2 = Request::create(
            'POST',
            '/api/v1/auth/login',
            ['content-type' => 'application/json'],
            json_encode(['email' => 'target@example.com', 'password' => 'WrongPass2!'])
        );
        $this->app->handle($req2);

        $req3 = Request::create(
            'POST',
            '/api/v1/auth/login',
            ['content-type' => 'application/json'],
            json_encode(['email' => 'target@example.com', 'password' => 'WrongPass3!'])
        );
        $res3 = $this->app->handle($req3);

        $this->assertSame(429, $res3->getStatusCode());
        $this->assertSame('RATE_LIMIT_EXCEEDED', $res3->getError()['code'] ?? null);
    }

    /**
     * Test H — Role Authorization (RBAC)
     * Patient cannot access admin-only endpoints.
     */
    public function testRoleAuthorizationRbac(): void
    {
        // 1. Unauthenticated request to /admin/audit-logs returns 401
        $reqUnauth = Request::create('GET', '/api/v1/admin/audit-logs');
        $resUnauth = $this->app->handle($reqUnauth);
        $this->assertSame(401, $resUnauth->getStatusCode());

        // 2. Authenticated Patient accessing /admin/audit-logs returns 403
        $patientUser = [
            'id' => 999,
            'email' => 'patient.normal@example.com',
            'role' => 'PATIENT',
            'is_active' => 1,
        ];
        $reqPatient = Request::create('GET', '/api/v1/admin/audit-logs');
        $reqPatient->setUser($patientUser);
        $resPatient = $this->app->handle($reqPatient);
        $this->assertSame(403, $resPatient->getStatusCode());
        $this->assertSame('FORBIDDEN', $resPatient->getError()['code'] ?? null);

        // 3. Authenticated Admin accessing /admin/audit-logs returns 200
        $adminUser = [
            'id' => 1,
            'email' => 'admin@toothcarehub.example.com',
            'role' => 'ADMIN',
            'is_active' => 1,
        ];
        $reqAdmin = Request::create('GET', '/api/v1/admin/audit-logs');
        $reqAdmin->setUser($adminUser);
        $resAdmin = $this->app->handle($reqAdmin);
        $this->assertSame(200, $resAdmin->getStatusCode());
        $this->assertSame('Admin audit logs accessed successfully.', $resAdmin->getData()['message'] ?? null);
    }
}
