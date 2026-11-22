<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Config;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;

/**
 * CSRF Protection Middleware
 * Verifies CSRF token on unsafe HTTP methods (POST, PUT, PATCH, DELETE).
 *
 * Phase 18 Hardening:
 * Because CsrfMiddleware executes globally before route-level AuthenticationMiddleware,
 * browser requests carrying the configured session cookie must have their session
 * initialized before validating the synchronizer token so CSRF checks are never bypassed.
 */
class CsrfMiddleware implements MiddlewareInterface
{
    private const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

    private Config $config;

    public function __construct(?Config $config = null)
    {
        $this->config = $config ?? Config::getInstance();
    }

    public function handle(Request $request, callable $next): Response
    {
        $method = $request->getMethod();

        if (in_array($method, self::SAFE_METHODS, true)) {
            return $next($request);
        }

        // Internal HMAC-signed service-to-service endpoints do not use browser cookie sessions
        if (str_starts_with($request->getPath(), '/api/v1/internal/')) {
            return $next($request);
        }

        // Hydrate PHP session using the configured session cookie name when present
        $cookieName = $this->config->getString('session_cookie_name', 'toothcare_session');
        if (session_status() === PHP_SESSION_NONE && !empty($_COOKIE[$cookieName]) && !headers_sent()) {
            self::ensureSessionStarted($this->config);
        }

        // Enforce whenever a session is active and either a CSRF token or authenticated user is bound to it
        if (
            session_status() === PHP_SESSION_ACTIVE
            && (isset($_SESSION['csrf_token']) || isset($_SESSION['user_id']))
        ) {
            $sessionToken = (string) ($_SESSION['csrf_token'] ?? '');
            $clientToken = $request->getHeader('x-csrf-token') ?? (string) $request->input('_csrf_token', '');

            if ($sessionToken === '' || $clientToken === '' || !hash_equals($sessionToken, $clientToken)) {
                throw HttpException::csrfInvalid('CSRF token validation failed.');
            }
        }

        return $next($request);
    }

    public static function generateToken(?Config $config = null): string
    {
        self::ensureSessionStarted($config);

        $token = bin2hex(random_bytes(32));
        $_SESSION['csrf_token'] = $token;

        return $token;
    }

    public static function getToken(?Config $config = null): string
    {
        self::ensureSessionStarted($config);

        if (empty($_SESSION['csrf_token'])) {
            return self::generateToken($config);
        }

        return (string) $_SESSION['csrf_token'];
    }

    /**
     * Start the PHP session using ToothCare Hub's configured session cookie name and security parameters
     * so CSRF tokens are always bound to the same session cookie as authentication (`toothcare_session`).
     */
    private static function ensureSessionStarted(?Config $config = null): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        if (!headers_sent()) {
            $resolvedConfig = $config ?? Config::getInstance();
            $sessionName = $resolvedConfig->getString('session_cookie_name', 'toothcare_session');
            $defaultLifetime = max(60, $resolvedConfig->getInt('session_lifetime', 7200));
            $rememberLifetime = max($defaultLifetime, $resolvedConfig->getInt('session_remember_lifetime', 2592000));
            $secure = $resolvedConfig->getBool('session_cookie_secure', false);
            $sameSite = $resolvedConfig->getString('session_cookie_samesite', 'Lax');

            ini_set('session.use_strict_mode', '1');
            ini_set('session.use_only_cookies', '1');
            ini_set('session.cookie_httponly', '1');
            ini_set('session.gc_maxlifetime', (string) $rememberLifetime);

            session_name($sessionName);
            session_set_cookie_params([
                'lifetime' => 0,
                'path' => '/',
                'domain' => '',
                'secure' => $secure,
                'httponly' => true,
                'samesite' => $sameSite,
            ]);
        }

        @session_start();
    }
}
