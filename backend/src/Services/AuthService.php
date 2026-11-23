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
use App\Repositories\RoleRepository;
use App\Repositories\UserRepository;
use App\Services\Email\EmailOutboxService;
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
    private RoleRepository $roleRepository;
    private EmailOutboxService $emailService;
    private LegalService $legalService;
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
        ?EmailOutboxService $emailService = null,
        ?Database $database = null,
        ?Config $config = null,
        ?Logger $logger = null,
        ?RoleRepository $roleRepository = null,
        ?LegalService $legalService = null
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
        $this->roleRepository = $roleRepository ?? new RoleRepository($this->database);
        $this->emailService = $emailService ?? new EmailOutboxService(null, null, null, $this->logger, null, $this->database);
        $this->legalService = $legalService ?? new LegalService(null, null, $this->auditLogRepository, $this->database);
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

        // 2. Validate input and enforce server-side constraints (including legal acceptance)
        $validated = AuthValidator::validateRegister($payload);
        $email = $validated['email'];

        // 2b. Verify submitted legal document versions strictly match currently PUBLISHED active versions
        $resolvedLegalDocs = $this->legalService->resolveRegistrationDocuments($validated);

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

        // 5. Database transaction for atomic user, patient profile, legal acceptances, and verification token creation
        $this->database->beginTransaction();
        try {
            // Role is strictly PATIENT (cannot be escalated from payload)
            $userId = $this->userRepository->create(
                $email,
                $passwordHash,
                'PATIENT',
                1, // is_active
                0, // email_verified
                $validated['first_name'],
                $validated['last_name']
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

            // 5b. Record immutable Terms acceptance and Privacy Policy acknowledgment in the same transaction
            $legalAcceptances = $this->legalService->recordRegistrationAcceptances(
                $userId,
                $resolvedLegalDocs,
                $clientIp,
                $userAgent
            );

            // 6. Generate single-use email verification token
            $rawToken = bin2hex(random_bytes(32));
            $tokenHash = hash('sha256', $rawToken);
            $tokenTtl = $this->config->getInt('email_verification_token_ttl', 86400);

            $tokenId = $this->tokenRepository->createToken($userId, $tokenHash, 'EMAIL_VERIFY', $tokenTtl);

            // 7. Transactional outbox: queue the verification email atomically with the account.
            //    A failure here throws and rolls back the registration (no account without a queued email).
            $recipientName = "{$validated['first_name']} {$validated['last_name']}";
            $this->emailService->queueVerification($email, $recipientName, $userId, $rawToken, $tokenId, $tokenTtl);

            // 8. Audit log event
            $this->auditLogRepository->record(
                'AUTH_REGISTER',
                'users',
                $userId,
                $userId,
                $clientIp,
                $userAgent,
                [
                    'email' => $email,
                    'role' => 'PATIENT',
                    'patient_id' => $patientId,
                    'terms_version' => (string) $resolvedLegalDocs['terms']['version'],
                    'privacy_version' => (string) $resolvedLegalDocs['privacy']['version'],
                ]
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
                'legal_acceptances' => [
                    [
                        'document_type' => $legalAcceptances[0]['document_type'] ?? 'TERMS_OF_SERVICE',
                        'document_version' => $legalAcceptances[0]['document_version'] ?? $resolvedLegalDocs['terms']['version'],
                        'acceptance_action' => $legalAcceptances[0]['acceptance_action'] ?? 'ACCEPTED',
                        'accepted_at' => $legalAcceptances[0]['accepted_at'] ?? null,
                    ],
                    [
                        'document_type' => $legalAcceptances[1]['document_type'] ?? 'PRIVACY_POLICY',
                        'document_version' => $legalAcceptances[1]['document_version'] ?? $resolvedLegalDocs['privacy']['version'],
                        'acceptance_action' => $legalAcceptances[1]['acceptance_action'] ?? 'ACKNOWLEDGED',
                        'accepted_at' => $legalAcceptances[1]['accepted_at'] ?? null,
                    ],
                ],
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

        $isDev = $this->config->getString('app_env') === 'development';
        $isPrivateOrLocalIp = $this->isLocalOrPrivateIp($ip);

        // In local development or private container networks, provide a relaxed IP threshold to prevent shared-subnet lockouts
        $maxIpAttempts = ($isDev && $isPrivateOrLocalIp) ? 100 : $maxAttempts * 2;

        $ipRate = $this->rateLimitRepository->hit($ipRateKey, $maxIpAttempts, $windowSeconds);
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
        $this->rateLimitRepository->clear($ipRateKey);

        // Establish and configure session
        $rememberMe = (bool) ($validated['remember_me'] ?? false);
        $defaultLifetime = max(60, $this->config->getInt('session_lifetime', 7200));
        $rememberLifetime = max($defaultLifetime, $this->config->getInt('session_remember_lifetime', 2592000));
        $sessionTtl = $rememberMe ? $rememberLifetime : $defaultLifetime;
        $cookieLifetime = $rememberMe ? $rememberLifetime : 0;

        $this->initializeSession($sessionTtl, $cookieLifetime);
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_regenerate_id(true);
            $_SESSION['user_id'] = (int) $user['id'];
            $_SESSION['user_role'] = (string) $user['role'];
            $_SESSION['user_email'] = (string) $user['email'];
            $_SESSION['auth_time'] = time();
            $_SESSION['remember_me'] = $rememberMe;
            $_SESSION['session_expires_at'] = time() + $sessionTtl;

            if (empty($_SESSION['csrf_token'])) {
                $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
            }

            $this->applySessionCookieLifetime($cookieLifetime);
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
            ['email' => $email, 'role' => $role, 'remember_me' => $rememberMe]
        );

        $payload = $this->formatAuthUserPayload($user, $patient, $dentist);
        $payload['remember_me'] = $rememberMe;

        return $payload;
    }

    /**
     * Terminate current user session and expire cookie
     */
    public function logout(?int $userId = null, ?string $clientIp = null, ?string $userAgent = null): bool
    {
        if ($userId !== null) {
            $sessionId = session_status() === PHP_SESSION_ACTIVE ? session_id() : '';
            $this->auditLogRepository->record(
                'AUTH_LOGOUT',
                'users',
                $userId,
                $userId,
                $clientIp,
                $userAgent,
                []
            );
            try {
                $ticketService = new \App\Services\Realtime\RealtimeTicketService(null, null, null, null, null, $this->database);
                $ticketService->revokeSessionTickets($userId, $sessionId !== '' ? $sessionId : null);
                $outboxService = new \App\Services\Realtime\RealtimeOutboxService(null, null, null, $this->logger, $this->database);
                $outboxService->notifyRevocationBestEffort([
                    'userId' => $userId,
                    'sessionIdHash' => $sessionId !== '' ? hash('sha256', $sessionId) : null,
                    'reason' => 'LOGOUT',
                ]);
            } catch (\Throwable) {
                // Never block logout when realtime service is unavailable
            }
        }

        if (session_status() === PHP_SESSION_ACTIVE) {
            $_SESSION = [];
            
            $sessionCookieName = $this->config->getString('session_cookie_name', 'toothcare_session');
            if (ini_get('session.use_cookies') && !headers_sent()) {
                $params = session_get_cookie_params();
                setcookie($sessionCookieName, '', [
                    'expires' => time() - 42000,
                    'path' => $params['path'] ?: '/',
                    'domain' => $params['domain'] ?? '',
                    'secure' => (bool) ($params['secure'] ?? false),
                    'httponly' => (bool) ($params['httponly'] ?? true),
                    'samesite' => $params['samesite'] ?: $this->config->getString('session_cookie_samesite', 'Lax'),
                ]);
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

        return $this->formatAuthUserPayload($user, $patient, $dentist);
    }

    /**
     * Format authenticated user payload with resolved real display name
     *
     * @param array<string, mixed> $user
     * @param array<string, mixed>|null $patient
     * @param array<string, mixed>|null $dentist
     * @return array<string, mixed>
     */
    private function formatAuthUserPayload(array $user, ?array $patient, ?array $dentist): array
    {
        $role = (string) $user['role'];
        $firstName = trim((string) ($patient['first_name'] ?? $dentist['first_name'] ?? $user['first_name'] ?? ''));
        $lastName = trim((string) ($patient['last_name'] ?? $dentist['last_name'] ?? $user['last_name'] ?? ''));

        if ($dentist !== null && !empty($dentist['first_name'])) {
            $displayName = 'Dr. ' . trim(($dentist['first_name'] ?? '') . ' ' . ($dentist['last_name'] ?? ''));
        } elseif ($firstName !== '' || $lastName !== '') {
            $displayName = trim($firstName . ' ' . $lastName);
        } else {
            $local = explode('@', (string) $user['email'])[0];
            $displayName = ucwords(trim(str_replace(['.', '_', '-'], ' ', $local)));
        }

        $publicPatient = $patient !== null
            ? $this->patientRepository->stripInternalFields($patient)
            : null;
        $publicDentist = $dentist !== null
            ? $this->dentistRepository->stripInternalFields($dentist)
            : null;

        $avatarUrl = null;
        if (!empty($patient['avatar_url'])) {
            $avatarUrl = (string) $patient['avatar_url'];
        } elseif (!empty($dentist['avatar_url'])) {
            $avatarUrl = (string) $dentist['avatar_url'];
        } elseif (!empty($user['avatar_url'])) {
            $avatarUrl = (string) $user['avatar_url'];
        } elseif (!empty($user['avatar_path']) && isset($user['id'])) {
            $versionSource = (string) ($user['avatar_updated_at'] ?? '') . '_' . (string) ($user['avatar_path'] ?? '');
            $avatarUrl = '/api/v1/users/' . (int) $user['id'] . '/avatar?v=' . rawurlencode($versionSource);
        }

        $phone = !empty($user['phone'])
            ? (string) $user['phone']
            : (!empty($dentist['phone']) ? (string) $dentist['phone'] : (!empty($patient['phone']) ? (string) $patient['phone'] : null));

        return [
            'id' => (int) $user['id'],
            'email' => (string) $user['email'],
            'first_name' => $firstName !== '' ? $firstName : null,
            'last_name' => $lastName !== '' ? $lastName : null,
            'phone' => $phone,
            'avatar_url' => $avatarUrl,
            'display_name' => $displayName,
            'role' => $role,
            'permissions' => $this->resolveUserPermissions($role),
            'is_active' => (bool) $user['is_active'],
            'email_verified' => (bool) $user['email_verified'],
            'legal_status' => $this->legalService->getCompactLegalStatusForUser((int) $user['id']),
            'patient' => $publicPatient,
            'dentist' => $publicDentist,
        ];
    }

    /**
     * Resolve effective DRBAC permissions assigned to the user's role
     *
     * @return list<string>
     */
    private function resolveUserPermissions(string $role): array
    {
        try {
            return $this->roleRepository->getPermissionsForRoleSlug(strtolower(trim($role)));
        } catch (\Throwable) {
            return [];
        }
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

            $patient = $this->patientRepository->findByUserId($userId);
            $name = $patient ? "{$patient['first_name']} {$patient['last_name']}" : 'Valued Patient';

            // Token and queued email commit together or not at all. The response stays generic
            // either way to prevent account enumeration; failures are logged.
            $this->database->beginTransaction();
            try {
                $tokenId = $this->tokenRepository->createToken($userId, $tokenHash, 'EMAIL_VERIFY', $tokenTtl);
                $this->emailService->queueVerification($normalizedEmail, $name, $userId, $rawToken, $tokenId, $tokenTtl);
                $this->auditLogRepository->record(
                    'AUTH_VERIFICATION_RESENT',
                    'users',
                    $userId,
                    $userId,
                    $clientIp,
                    $userAgent,
                    ['email' => $normalizedEmail]
                );
                $this->database->commit();
            } catch (\Throwable $e) {
                $this->database->rollBack();
                $this->logger->error('Verification resend failed; transaction rolled back', ['user_id' => $userId, 'error' => $e->getMessage()]);
            }
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

            $patient = $this->patientRepository->findByUserId($userId);
            $dentist = $patient ? null : $this->dentistRepository->findByUserId($userId);
            $name = $patient ? "{$patient['first_name']} {$patient['last_name']}" : ($dentist ? "Dr. {$dentist['last_name']}" : 'Clinic Member');

            $this->database->beginTransaction();
            try {
                $tokenId = $this->tokenRepository->createToken($userId, $tokenHash, 'PASSWORD_RESET', $tokenTtl);
                $this->emailService->queuePasswordReset($normalizedEmail, $name, $userId, $rawToken, $tokenId, $tokenTtl);
                $this->auditLogRepository->record(
                    'AUTH_PASSWORD_RESET_REQUESTED',
                    'users',
                    $userId,
                    $userId,
                    $clientIp,
                    $userAgent,
                    ['email' => $normalizedEmail]
                );
                $this->database->commit();
            } catch (\Throwable $e) {
                $this->database->rollBack();
                $this->logger->error('Password reset request failed; transaction rolled back', ['user_id' => $userId, 'error' => $e->getMessage()]);
            }
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
    public function initializeSession(?int $gcMaxLifetime = null, ?int $cookieLifetime = null): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        $sessionName = $this->config->getString('session_cookie_name', 'toothcare_session');
        $defaultLifetime = max(60, $this->config->getInt('session_lifetime', 7200));
        $rememberLifetime = max($defaultLifetime, $this->config->getInt('session_remember_lifetime', 2592000));
        $resolvedGcLifetime = $gcMaxLifetime ?? $rememberLifetime;
        $resolvedCookieLifetime = $cookieLifetime ?? 0;
        $secure = $this->config->getBool('session_cookie_secure', false);
        $sameSite = $this->config->getString('session_cookie_samesite', 'Lax');

        if (session_status() === PHP_SESSION_NONE && !headers_sent()) {
            ini_set('session.use_strict_mode', '1');
            ini_set('session.use_only_cookies', '1');
            ini_set('session.cookie_httponly', '1');
            ini_set('session.gc_maxlifetime', (string) $resolvedGcLifetime);

            session_name($sessionName);
            session_set_cookie_params([
                'lifetime' => $resolvedCookieLifetime,
                'path' => '/',
                'domain' => '',
                'secure' => $secure,
                'httponly' => true,
                'samesite' => $sameSite,
            ]);

            @session_start();
        }
    }

    /**
     * Update the active session cookie expiration on the client
     */
    public function applySessionCookieLifetime(int $cookieLifetime): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE || headers_sent() || session_id() === '') {
            return;
        }

        $sessionName = $this->config->getString('session_cookie_name', 'toothcare_session');
        $secure = $this->config->getBool('session_cookie_secure', false);
        $sameSite = $this->config->getString('session_cookie_samesite', 'Lax');

        setcookie($sessionName, session_id(), [
            'expires' => $cookieLifetime > 0 ? time() + $cookieLifetime : 0,
            'path' => '/',
            'domain' => '',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => $sameSite,
        ]);
    }

    /**
     * Determine whether the active authenticated session has exceeded its lifetime
     */
    public function isCurrentSessionExpired(): bool
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            return false;
        }

        if (!isset($_SESSION['session_expires_at'])) {
            return false;
        }

        return time() > (int) $_SESSION['session_expires_at'];
    }

    /**
     * Refresh sliding expiration for the current active session
     */
    public function refreshActiveSession(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE || empty($_SESSION['user_id'])) {
            return;
        }

        $defaultLifetime = max(60, $this->config->getInt('session_lifetime', 7200));
        $rememberLifetime = max($defaultLifetime, $this->config->getInt('session_remember_lifetime', 2592000));

        if (!empty($_SESSION['remember_me'])) {
            $_SESSION['session_expires_at'] = time() + $rememberLifetime;
            $this->applySessionCookieLifetime($rememberLifetime);
            return;
        }

        $_SESSION['session_expires_at'] = time() + $defaultLifetime;
    }

    /**
     * Check if client IP belongs to loopback or private RFC1918 / Docker subnets
     */
    private function isLocalOrPrivateIp(string $ip): bool
    {
        return $ip === '127.0.0.1' ||
            $ip === '::1' ||
            str_starts_with($ip, '192.168.') ||
            str_starts_with($ip, '10.') ||
            (bool) preg_match('/^172\.(1[6-9]|2[0-9]|3[0-1])\./', $ip);
    }
}

