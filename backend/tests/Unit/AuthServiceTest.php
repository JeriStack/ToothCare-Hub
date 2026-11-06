<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\Config;
use App\Core\Database;
use App\Core\HttpException;
use App\Repositories\AuditLogRepository;
use App\Repositories\AuthTokenRepository;
use App\Repositories\PatientRepository;
use App\Repositories\RateLimitRepository;
use App\Repositories\UserRepository;
use App\Services\AuthService;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

class AuthServiceTest extends TestCase
{
    private AuthService $authService;
    private UserRepository $userRepository;
    private PatientRepository $patientRepository;
    private AuthTokenRepository $tokenRepository;
    private RateLimitRepository $rateLimitRepository;
    private AuditLogRepository $auditLogRepository;

    protected function setUp(): void
    {
        parent::setUp();
        TestDb::create();
        RateLimitRepository::resetInMemory();

        $config = Config::getInstance();
        $config->set('auth_password_min_length', 8);
        $config->set('auth_login_rate_limit', 5);
        $config->set('auth_login_rate_window', 900);
        $config->set('auth_register_rate_limit', 10);
        $config->set('auth_register_rate_window', 3600);

        $this->userRepository = new UserRepository();
        $this->patientRepository = new PatientRepository();
        $this->tokenRepository = new AuthTokenRepository();
        $this->rateLimitRepository = new RateLimitRepository();
        $this->auditLogRepository = new AuditLogRepository();
        $this->authService = new AuthService();
    }

    public function testRegistrationSuccessAndServerRoleEnforcement(): void
    {
        $payload = [
            'email' => 'Maria.Santos@Example.COM',
            'password' => 'StrongP@ssw0rd123!',
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'phone' => '+639171234567',
            'date_of_birth' => '1995-05-15',
            'gender' => 'FEMALE',
            'role' => 'ADMIN', // Deliberate privilege escalation attempt
        ];

        $result = $this->authService->register($payload, '192.168.1.100');

        $this->assertNotEmpty($result['id']);
        $this->assertSame('maria.santos@example.com', $result['email']);
        // Role MUST be PATIENT, not ADMIN
        $this->assertSame('PATIENT', $result['role']);
        $this->assertFalse($result['email_verified']);

        // Check database state directly
        $user = $this->userRepository->findById((int) $result['id']);
        $this->assertNotNull($user);
        $this->assertSame('PATIENT', $user['role']);
        $this->assertSame(1, (int) $user['is_active']);
        $this->assertSame(0, (int) $user['email_verified']);

        // Password hash check: must NOT store plaintext password
        $this->assertNotSame('StrongP@ssw0rd123!', $user['password_hash']);
        $this->assertTrue(password_verify('StrongP@ssw0rd123!', (string) $user['password_hash']));

        // Verify patient profile was created atomically
        $patient = $this->patientRepository->findByUserId((int) $result['id']);
        $this->assertNotNull($patient);
        $this->assertSame('Maria', $patient['first_name']);
        $this->assertSame('Santos', $patient['last_name']);
    }

    public function testRegistrationRejectsDuplicateEmail(): void
    {
        $payload = [
            'email' => 'duplicate@example.com',
            'password' => 'StrongP@ssw0rd123!',
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'phone' => '+639171234568',
            'date_of_birth' => '1990-01-01',
        ];

        $this->authService->register($payload);

        $this->expectException(HttpException::class);
        $this->expectExceptionCode(409);

        // Attempt second registration with mixed casing of same email
        $payload['email'] = 'DUPLICATE@example.com';
        $this->authService->register($payload);
    }

    public function testRegistrationRejectsWeakPassword(): void
    {
        $payload = [
            'email' => 'weakpass@example.com',
            'password' => 'short1!', // Less than 12 characters
            'first_name' => 'Ana',
            'last_name' => 'Reyes',
            'phone' => '+639171234569',
            'date_of_birth' => '1992-03-10',
        ];

        $this->expectException(HttpException::class);
        $this->expectExceptionCode(422);

        $this->authService->register($payload);
    }

    public function testLoginSuccessWithValidCredentials(): void
    {
        $this->authService->register([
            'email' => 'patient.login@example.com',
            'password' => 'SecureP@ssw0rd999!',
            'first_name' => 'Clara',
            'last_name' => 'Rivera',
            'phone' => '+639171112233',
            'date_of_birth' => '1988-12-20',
        ]);

        $loginResult = $this->authService->login([
            'email' => 'PATIENT.LOGIN@example.com',
            'password' => 'SecureP@ssw0rd999!',
        ], '127.0.0.1');

        $this->assertSame('patient.login@example.com', $loginResult['email']);
        $this->assertSame('PATIENT', $loginResult['role']);
        $this->assertTrue($loginResult['is_active']);
        $this->assertNotNull($loginResult['patient']);
    }

    public function testLoginFailsWithInvalidPasswordReturnsGeneric401(): void
    {
        $this->authService->register([
            'email' => 'patient.wrongpass@example.com',
            'password' => 'CorrectP@ssword123!',
            'first_name' => 'Pedro',
            'last_name' => 'Gil',
            'phone' => '+639178887766',
            'date_of_birth' => '1985-07-22',
        ]);

        $this->expectException(HttpException::class);
        $this->expectExceptionCode(401);

        try {
            $this->authService->login([
                'email' => 'patient.wrongpass@example.com',
                'password' => 'WrongPassword999!',
            ]);
        } catch (HttpException $e) {
            $this->assertSame('INVALID_CREDENTIALS', $e->getErrorCode());
            $this->assertSame('Invalid email or password.', $e->getMessage());
            throw $e;
        }
    }

    public function testLoginFailsForUnknownEmailReturnsGeneric401(): void
    {
        $this->expectException(HttpException::class);
        $this->expectExceptionCode(401);

        try {
            $this->authService->login([
                'email' => 'nonexistent.user@example.com',
                'password' => 'RandomPassword123!',
            ]);
        } catch (HttpException $e) {
            $this->assertSame('INVALID_CREDENTIALS', $e->getErrorCode());
            $this->assertSame('Invalid email or password.', $e->getMessage());
            throw $e;
        }
    }

    public function testLoginFailsForDisabledAccount(): void
    {
        $reg = $this->authService->register([
            'email' => 'disabled.user@example.com',
            'password' => 'ValidP@ssword123!',
            'first_name' => 'Disabled',
            'last_name' => 'Account',
            'phone' => '+639179998877',
            'date_of_birth' => '1991-04-12',
        ]);

        // Disable user
        $this->userRepository->updateStatus((int) $reg['id'], 0);

        $this->expectException(HttpException::class);
        $this->expectExceptionCode(403);

        $this->authService->login([
            'email' => 'disabled.user@example.com',
            'password' => 'ValidP@ssword123!',
        ]);
    }

    public function testLoginRateLimitingTriggered(): void
    {
        Config::getInstance()->set('auth_login_rate_limit', 3);

        $this->expectException(HttpException::class);
        $this->expectExceptionCode(429);

        for ($i = 0; $i < 5; $i++) {
            try {
                $this->authService->login([
                    'email' => 'bruteforce@example.com',
                    'password' => "WrongAttempt{$i}!",
                ], '10.0.0.99');
            } catch (HttpException $e) {
                if ($e->getStatusCode() === 429) {
                    $this->assertSame('RATE_LIMIT_EXCEEDED', $e->getErrorCode());
                    throw $e;
                }
            }
        }
    }

    public function testEmailVerificationWorkflow(): void
    {
        $reg = $this->authService->register([
            'email' => 'verify.me@example.com',
            'password' => 'ValidP@ssword123!',
            'first_name' => 'Teresa',
            'last_name' => 'Magbanua',
            'phone' => '+639174443322',
            'date_of_birth' => '1993-09-09',
        ]);

        $userId = (int) $reg['id'];

        // Retrieve token hash from db
        $pdo = Database::getInstance()->getConnection();
        $tokenRow = $pdo->query("SELECT * FROM auth_tokens WHERE user_id = {$userId} AND token_type = 'EMAIL_VERIFY'")->fetch();
        $this->assertNotEmpty($tokenRow);
        $this->assertNull($tokenRow['used_at']);

        // We can create a known token to verify
        $rawToken = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $rawToken);
        $this->tokenRepository->createToken($userId, $tokenHash, 'EMAIL_VERIFY', 86400);

        $verifyResult = $this->authService->verifyEmail($rawToken);
        $this->assertTrue($verifyResult['verified']);

        // Verify user is now marked verified in DB
        $user = $this->userRepository->findById($userId);
        $this->assertSame(1, (int) $user['email_verified']);

        // Reusing the token must fail (single-use constraint)
        $this->expectException(HttpException::class);
        $this->expectExceptionCode(422);
        $this->authService->verifyEmail($rawToken);
    }

    public function testForgotPasswordAntiEnumeration(): void
    {
        // Registered user
        $this->authService->register([
            'email' => 'registered.reset@example.com',
            'password' => 'ValidP@ssword123!',
            'first_name' => 'Jose',
            'last_name' => 'Rizal',
            'phone' => '+639170001122',
            'date_of_birth' => '1980-06-19',
        ]);

        $res1 = $this->authService->forgotPassword('registered.reset@example.com', '127.0.0.1');
        $res2 = $this->authService->forgotPassword('never.existed@example.com', '127.0.0.1');

        // Both responses must be identical to prevent account enumeration
        $this->assertSame($res1['message'], $res2['message']);
        $this->assertTrue($res1['sent']);
        $this->assertTrue($res2['sent']);
    }

    public function testPasswordResetWorkflow(): void
    {
        $reg = $this->authService->register([
            'email' => 'reset.workflow@example.com',
            'password' => 'OldPassword123!',
            'first_name' => 'Andres',
            'last_name' => 'Bonifacio',
            'phone' => '+639175556677',
            'date_of_birth' => '1982-11-30',
        ]);

        $userId = (int) $reg['id'];
        $rawToken = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $rawToken);
        $this->tokenRepository->createToken($userId, $tokenHash, 'PASSWORD_RESET', 1800);

        $resetResult = $this->authService->resetPassword($rawToken, 'BrandNewP@ssword999!');
        $this->assertTrue($resetResult['success']);

        // Login with old password must fail
        $this->expectException(HttpException::class);
        $this->expectExceptionCode(401);
        $this->authService->login([
            'email' => 'reset.workflow@example.com',
            'password' => 'OldPassword123!',
        ]);
    }

    public function testAuditLogSanitization(): void
    {
        $this->auditLogRepository->record(
            'TEST_AUDIT',
            'users',
            1,
            1,
            '127.0.0.1',
            'PHPUnit/11',
            [
                'email' => 'test@example.com',
                'password' => 'SUPER_SECRET_PASSWORD',
                'token' => 'SECRET_RAW_TOKEN_123',
                'csrf_token' => 'CSRF_SECRET_XYZ',
            ]
        );

        $pdo = Database::getInstance()->getConnection();
        $log = $pdo->query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 1')->fetch();

        $this->assertNotNull($log);
        $this->assertStringNotContainsString('SUPER_SECRET_PASSWORD', (string) $log['sanitized_payload']);
        $this->assertStringNotContainsString('SECRET_RAW_TOKEN_123', (string) $log['sanitized_payload']);
        $this->assertStringNotContainsString('CSRF_SECRET_XYZ', (string) $log['sanitized_payload']);
        $this->assertStringContainsString('[REDACTED]', (string) $log['sanitized_payload']);
    }
}
