<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Config;
use App\Core\Database;
use App\Core\HttpException;
use App\Core\Logger;
use App\Repositories\AuditLogRepository;
use App\Repositories\AuthTokenRepository;
use App\Repositories\DentistRepository;
use App\Repositories\PatientRepository;
use App\Repositories\RateLimitRepository;
use App\Repositories\UserRepository;
use App\Validators\AuthValidator;

/**
 * Authentication and Account Security Service
 * Implements core identity, session lifecycles, account recovery, and security verification.
 */
class AuthService
{
    private UserRepository $userRepository;
    private PatientRepository $patientRepository;
    private DentistRepository $dentistRepository;
    private AuthTokenRepository $tokenRepository;
    private AuditLogRepository $auditLogRepository;
    private RateLimitRepository $rateLimitRepository;
    private EmailService $emailService;
    private Database $database;
    private Config $config;
    private Logger $logger;

    public function __construct(
        ?UserRepository $userRepository = null,
        ?PatientRepository $patientRepository = null,
        ?DentistRepository $dentistRepository = null,
        ?AuthTokenRepository $tokenRepository = null,
        ?AuditLogRepository $auditLogRepository = null,
        ?RateLimitRepository $rateLimitRepository = null,
        ?EmailService $emailService = null,
        ?Database $database = null,
        ?Config $config = null,
        ?Logger $logger = null
    ) {
        $this->database = $database ?? Database::getInstance();
        $this->config = $config ?? Config::getInstance();
        $this->logger = $logger ?? Logger::getInstance();
        $this->userRepository = $userRepository ?? new UserRepository($this->database);
        $this->patientRepository = $patientRepository ?? new PatientRepository($this->database);
        $this->dentistRepository = $dentistRepository ?? new DentistRepository($this->database);
        $this->tokenRepository = $tokenRepository ?? new AuthTokenRepository($this->database);
        $this->auditLogRepository = $auditLogRepository ?? new AuditLogRepository($this->database);
        $this->rateLimitRepository = $rateLimitRepository ?? new RateLimitRepository($this->database);
        $this->emailService = $emailService ?? new EmailService($this->database, $this->config, $this->logger);
    }

    /**
     * Register a new patient account
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function register(array $payload, ?string $clientIp = null, ?string $userAgent = null): array
    {
        // 1. Rate limiting on registration
        $ip = $clientIp ?? '127.0.0.1';
        $maxAttempts = $this->config->getInt('auth_register_rate_limit', 10);
        $windowSeconds = $this->config->getInt('auth_register_rate_window', 3600);
        $rateKey = "register:ip:{$ip}";

        $rateStatus = $this->rateLimitRepository->hit($rateKey, $maxAttempts, $windowSeconds);
        if (!$rateStatus['allowed']) {
            throw HttpException::tooManyRequests('Too many registration attempts. Please try again later.');
        }

        // 2. Validate input and enforce server-side constraints
        $validated = AuthValidator::validateRegister($payload);
        $email = $validated['email'];

        // 3. Duplicate email detection
        $existing = $this->userRepository->findByEmail($email);
        if ($existing !== null) {
            throw HttpException::conflict(
                'An account with this email address already exists.',
                'EMAIL_ALREADY_EXISTS',
                ['email' => 'The submitted email address is already registered.']
            );
        }

        // 4. Hash password with secure default algorithm
        $passwordHash = password_hash($validated['password'], PASSWORD_DEFAULT);

        // 5. Database transaction for atomic user, patient profile, and verification token creation
        $this->database->beginTransaction();
        try {
            // Role is strictly PATIENT (cannot be escalated from payload)
            $userId = $this->userRepository->create(
                $email,
                $passwordHash,
                'PATIENT',
                1, // is_active
                0  // email_verified
            );

            $patientData = [
                'user_id' => $userId,
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'date_of_birth' => $validated['date_of_birth'],
                'phone' => $validated['phone'],
                'gender' => $validated['gender'],
                'address' => $validated['address'],
                'emergency_contact_name' => $validated['emergency_contact_name'],
                'emergency_contact_phone' => $validated['emergency_contact_phone'],
                'medical_alerts' => $validated['medical_alerts'],
            ];

            $patientId = $this->patientRepository->create($patientData);

            // 6. Generate single-use email verification token
            $rawToken = bin2hex(random_bytes(32));
            $tokenHash = hash('sha256', $rawToken);
            $tokenTtl = $this->config->getInt('email_verification_token_ttl', 86400);

            $this->tokenRepository->createToken($userId, $tokenHash, 'EMAIL_VERIFY', $tokenTtl);

            // 7. Enqueue verification email
            $recipientName = "{$validated['first_name']} {$validated['last_name']}";
            $this->emailService->sendVerificationEmail($email, $rawToken, $recipientName, $userId);

            // 8. Audit log event
            $this->auditLogRepository->record(
                'AUTH_REGISTER',
                'users',
                $userId,
                $userId,
                $clientIp,
                $userAgent,
                ['email' => $email, 'role' => 'PATIENT', 'patient_id' => $patientId]
            );

            $this->database->commit();

            return [
                'id' => $userId,
                'email' => $email,
                'role' => 'PATIENT',
                'email_verified' => false,
                'patient_id' => $patientId,
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'message' => 'Registration successful. Please check your email to verify your account.',
            ];
        } catch (\Throwable $e) {
            $this->database->rollBack();
            $this->logger->error('Registration failed transaction rolled back', [
                'email' => $email,
                'error' => $e->getMessage(),
            ]);

            if ($e instanceof HttpException) {
                throw $e;
            }

            throw HttpException::internalError('An unexpected error occurred during account registration.');
        }
    }

    /**
     * Authenticate credentials and establish secure server-side session
     *
     * @param array<string, mixed> $credentials
     * @return array<string, mixed>
     */
    public function login(array $credentials, ?string $clientIp = null, ?string $userAgent = null): array
    {
        $validated = AuthValidator::validateLogin($credentials);
        $email = $validated['email'];
        $password = $validated['password'];

        $ip = $clientIp ?? '127.0.0.1';
        $maxAttempts = $this->config->getInt('auth_login_rate_limit', 5);
        $windowSeconds = $this->config->getInt('auth_login_rate_window', 900);

        // Rate limit by IP and by normalized email identifier
        $ipRateKey = "login:ip:{$ip}";
        $emailRateKey = "login:email:" . hash('sha256', $email);

        $ipRate = $this->rateLimitRepository->hit($ipRateKey, $maxAttempts * 2, $windowSeconds);
        $emailRate = $this->rateLimitRepository->hit($emailRateKey, $maxAttempts, $windowSeconds);

        if (!$ipRate['allowed'] || !$emailRate['allowed']) {
            $this->auditLogRepository->record(
                'AUTH_LOGIN_RATE_LIMITED',
                'users',
                null,
                null,
                $clientIp,
                $userAgent,
                ['email' => $email]
            );
            throw HttpException::tooManyRequests('Too many failed login attempts. Please try again in 15 minutes.');
        }

        // Safe account retrieval
        $user = $this->userRepository->findByEmail($email);

        // Constant-time check and password verification
        if ($user === null || !password_verify($password, (string) $user['password_hash'])) {
            $this->auditLogRepository->record(
                'AUTH_LOGIN_FAILED',
                'users',
                $user ? (int) $user['id'] : null,
                null,
                $clientIp,
                $userAgent,
                ['email' => $email, 'reason' => 'INVALID_CREDENTIALS']
            );

            // Return generic authentication failure to avoid account enumeration
            throw HttpException::unauthorized('Invalid email or password.', 'INVALID_CREDENTIALS');
        }

        // Account status check
        if ((int) $user['is_active'] !== 1) {
            $this->auditLogRepository->record(
                'AUTH_LOGIN_BLOCKED',
                'users',
                (int) $user['id'],
                (int) $user['id'],
                $clientIp,
                $userAgent,
                ['email' => $email, 'reason' => 'ACCOUNT_DISABLED']
            );

            throw HttpException::forbidden('Your account is currently disabled. Please contact the clinic.', 'ACCOUNT_DISABLED');
        }

        // Check password rehash requirement
        if (password_needs_rehash((string) $user['password_hash'], PASSWORD_DEFAULT)) {
            $newHash = password_hash($password, PASSWORD_DEFAULT);
            $this->userRepository->updatePassword((int) $user['id'], $newHash);
        }

        // Clear rate limit counters on success
        $this->rateLimitRepository->clear($emailRateKey);

        // Establish and configure session
        $this->initializeSession();
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_regenerate_id(true);
            $_SESSION['user_id'] = (int) $user['id'];
            $_SESSION['user_role'] = (string) $user['role'];
            $_SESSION['user_email'] = (string) $user['email'];
            $_SESSION['auth_time'] = time();

            if (empty($_SESSION['csrf_token'])) {
                $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
            }
        }

        $userId = (int) $user['id'];
        $role = (string) $user['role'];

        // Resolve profile context
        $patient = null;
        $dentist = null;
        if ($role === 'PATIENT') {
            $patient = $this->patientRepository->findByUserId($userId);
        } elseif ($role === 'DENTIST') {
            $dentist = $this->dentistRepository->findByUserId($userId);
        }

        // Record successful login audit
        $this->auditLogRepository->record(
            'AUTH_LOGIN_SUCCESS',
            'users',
            $userId,
            $userId,
            $clientIp,
            $userAgent,
            ['email' => $email, 'role' => $role]
        );

        return [
            'id' => $userId,
            'email' => (string) $user['email'],
            'role' => $role,
            'is_active' => (bool) $user['is_active'],
            'email_verified' => (bool) $user['email_verified'],
            'patient' => $patient,
            'dentist' => $dentist,
        ];
    }

    /**
     * Terminate current user session and expire cookie
     */
    public function logout(?int $userId = null, ?string $clientIp = null, ?string $userAgent = null): bool
    {
        if ($userId !== null) {
            $this->auditLogRepository->record(
                'AUTH_LOGOUT',
                'users',
                $userId,
                $userId,
                $clientIp,
                $userAgent,
                []
            );
        }

        if (session_status() === PHP_SESSION_ACTIVE) {
            $_SESSION = [];
            
            $sessionCookieName = $this->config->getString('session_cookie_name', 'toothcare_session');
            if (ini_get('session.use_cookies')) {
                $params = session_get_cookie_params();
                setcookie(
                    $sessionCookieName,
                    '',
                    time() - 42000,
                    $params['path'],
                    $params['domain'],
                    $params['secure'],
                    $params['httponly']
                );
            }

            session_destroy();
        }

        return true;
    }

    /**
     * Retrieve authenticated user details
     *
     * @return array<string, mixed>
     */
    public function getCurrentUser(int $userId): array
    {
        $user = $this->userRepository->findById($userId);
        if ($user === null || (int) $user['is_active'] !== 1) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $role = (string) $user['role'];
        $patient = null;
        $dentist = null;

        if ($role === 'PATIENT') {
            $patient = $this->patientRepository->findByUserId($userId);
        } elseif ($role === 'DENTIST') {
            $dentist = $this->dentistRepository->findByUserId($userId);
        }

        return [
            'id' => (int) $user['id'],
            'email' => (string) $user['email'],
            'role' => $role,
            'is_active' => (bool) $user['is_active'],
            'email_verified' => (bool) $user['email_verified'],
            'patient' => $patient,
            'dentist' => $dentist,
        ];
    }

    /**
     * Verify email address using hashed, single-use token
     */
    public function verifyEmail(string $rawToken, ?string $clientIp = null, ?string $userAgent = null): array
    {
        $tokenHash = hash('sha256', $rawToken);
        $tokenRecord = $this->tokenRepository->findValidToken($tokenHash, 'EMAIL_VERIFY');

        if ($tokenRecord === null) {
            throw HttpException::unprocessableEntity('The verification link is invalid, expired, or has already been used.', [
                'token' => 'Invalid or expired email verification token.',
            ]);
        }

        $userId = (int) $tokenRecord['user_id'];
        $tokenId = (int) $tokenRecord['id'];

        $this->database->beginTransaction();
        try {
            $this->tokenRepository->markTokenUsed($tokenId);
            $this->userRepository->markEmailVerified($userId);

            $this->auditLogRepository->record(
                'AUTH_EMAIL_VERIFIED',
                'users',
                $userId,
                $userId,
                $clientIp,
                $userAgent,
                ['token_id' => $tokenId]
            );

            $this->database->commit();

            return [
                'verified' => true,
                'message' => 'Your email address has been successfully verified.',
            ];
        } catch (\Throwable $e) {
            $this->database->rollBack();
            $this->logger->error('Email verification transaction failed', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);

            throw HttpException::internalError('Failed to verify email address. Please try again.');
        }
    }

    /**
     * Resend verification email
     */
    public function resendVerification(string $email, ?string $clientIp = null, ?string $userAgent = null): array
    {
        $normalizedEmail = strtolower(trim($email));
        $ip = $clientIp ?? '127.0.0.1';

        $maxAttempts = 3;
        $windowSeconds = 3600;
        $rateKey = "resend_verify:{$ip}:" . hash('sha256', $normalizedEmail);

        $rateStatus = $this->rateLimitRepository->hit($rateKey, $maxAttempts, $windowSeconds);
        if (!$rateStatus['allowed']) {
            throw HttpException::tooManyRequests('Too many verification requests. Please try again in an hour.');
        }

        $user = $this->userRepository->findByEmail($normalizedEmail);
        if ($user !== null && (int) $user['email_verified'] === 0 && (int) $user['is_active'] === 1) {
            $userId = (int) $user['id'];
            $rawToken = bin2hex(random_bytes(32));
            $tokenHash = hash('sha256', $rawToken);
            $tokenTtl = $this->config->getInt('email_verification_token_ttl', 86400);

            $this->tokenRepository->createToken($userId, $tokenHash, 'EMAIL_VERIFY', $tokenTtl);

            $patient = $this->patientRepository->findByUserId($userId);
            $name = $patient ? "{$patient['first_name']} {$patient['last_name']}" : 'Valued Patient';

            $this->emailService->sendVerificationEmail($normalizedEmail, $rawToken, $name, $userId);

            $this->auditLogRepository->record(
                'AUTH_VERIFICATION_RESENT',
                'users',
                $userId,
                $userId,
                $clientIp,
                $userAgent,
                ['email' => $normalizedEmail]
            );
        }

        // Always return generic response to prevent email enumeration
        return [
            'sent' => true,
            'message' => 'If an unverified account exists with that email address, a verification link has been sent.',
        ];
    }

    /**
     * Request password reset token and send instructions
     */
    public function forgotPassword(string $email, ?string $clientIp = null, ?string $userAgent = null): array
    {
        $normalizedEmail = strtolower(trim($email));
        $ip = $clientIp ?? '127.0.0.1';

        $maxAttempts = $this->config->getInt('auth_password_reset_rate_limit', 3);
        $windowSeconds = $this->config->getInt('auth_password_reset_rate_window', 3600);
        $rateKey = "forgot_password:{$ip}:" . hash('sha256', $normalizedEmail);

        $rateStatus = $this->rateLimitRepository->hit($rateKey, $maxAttempts, $windowSeconds);
        if (!$rateStatus['allowed']) {
            throw HttpException::tooManyRequests('Too many password reset requests. Please try again later.');
        }

        $user = $this->userRepository->findByEmail($normalizedEmail);
        if ($user !== null && (int) $user['is_active'] === 1) {
            $userId = (int) $user['id'];
            $rawToken = bin2hex(random_bytes(32));
            $tokenHash = hash('sha256', $rawToken);
            $tokenTtl = $this->config->getInt('password_reset_token_ttl', 1800);

            $this->tokenRepository->createToken($userId, $tokenHash, 'PASSWORD_RESET', $tokenTtl);

            $patient = $this->patientRepository->findByUserId($userId);
            $dentist = $patient ? null : $this->dentistRepository->findByUserId($userId);
            $name = $patient ? "{$patient['first_name']} {$patient['last_name']}" : ($dentist ? "Dr. {$dentist['last_name']}" : 'Clinic Member');

            $this->emailService->sendPasswordResetEmail($normalizedEmail, $rawToken, $name, $userId);

            $this->auditLogRepository->record(
                'AUTH_PASSWORD_RESET_REQUESTED',
                'users',
                $userId,
                $userId,
                $clientIp,
                $userAgent,
                ['email' => $normalizedEmail]
            );
        }

        // Generic response strictly prevents account enumeration
        return [
            'sent' => true,
            'message' => 'If that email address is registered, instructions to reset your password have been sent.',
        ];
    }

    /**
     * Complete password reset using token and new password
     */
    public function resetPassword(string $rawToken, string $newPassword, ?string $clientIp = null, ?string $userAgent = null): array
    {
        $tokenHash = hash('sha256', $rawToken);
        $tokenRecord = $this->tokenRepository->findValidToken($tokenHash, 'PASSWORD_RESET');

        if ($tokenRecord === null) {
            throw HttpException::unprocessableEntity('The password reset link is invalid, expired, or has already been used.', [
                'token' => 'Invalid or expired password reset token.',
            ]);
        }

        $userId = (int) $tokenRecord['user_id'];
        $tokenId = (int) $tokenRecord['id'];
        $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);

        $this->database->beginTransaction();
        try {
            // Update password
            $this->userRepository->updatePassword($userId, $passwordHash);

            // Mark token used and invalidate all remaining password reset tokens
            $this->tokenRepository->markTokenUsed($tokenId);
            $this->tokenRepository->invalidateOutstandingTokens($userId, 'PASSWORD_RESET');

            // Audit event
            $this->auditLogRepository->record(
                'AUTH_PASSWORD_RESET_COMPLETED',
                'users',
                $userId,
                $userId,
                $clientIp,
                $userAgent,
                ['token_id' => $tokenId]
            );

            $this->database->commit();

            // Destroy active session if any exists
            if (session_status() === PHP_SESSION_ACTIVE && isset($_SESSION['user_id']) && (int) $_SESSION['user_id'] === $userId) {
                $this->logout($userId, $clientIp, $userAgent);
            }

            return [
                'success' => true,
                'message' => 'Your password has been reset successfully. You may now log in with your new credentials.',
            ];
        } catch (\Throwable $e) {
            $this->database->rollBack();
            $this->logger->error('Password reset transaction failed', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);

            throw HttpException::internalError('Failed to reset password. Please try again.');
        }
    }

    /**
     * Initialize secure session configuration
     */
    public function initializeSession(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        $sessionName = $this->config->getString('session_cookie_name', 'toothcare_session');
        $lifetime = $this->config->getInt('session_lifetime', 7200);
        $secure = $this->config->getBool('session_cookie_secure', false);
        $sameSite = $this->config->getString('session_cookie_samesite', 'Lax');

        if (session_status() === PHP_SESSION_NONE && !headers_sent()) {
            ini_set('session.use_strict_mode', '1');
            ini_set('session.use_only_cookies', '1');
            ini_set('session.cookie_httponly', '1');

            session_name($sessionName);
            session_set_cookie_params([
                'lifetime' => $lifetime,
                'path' => '/',
                'domain' => '',
                'secure' => $secure,
                'httponly' => true,
                'samesite' => $sameSite,
            ]);

            @session_start();
        }
    }
}

