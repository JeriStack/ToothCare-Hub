<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Config;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Services\AuthService;

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

        // Hydrate PHP session if a browser session cookie is present and session is not yet active
        $cookieName = $this->config->getString('session_cookie_name', 'toothcare_session');
        if (session_status() === PHP_SESSION_NONE && !empty($_COOKIE[$cookieName]) && !headers_sent()) {
            (new AuthService(null, null, null, null, null, null, null, null, $this->config))->initializeSession();
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

    public static function generateToken(): string
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            @session_start();
        }

        $token = bin2hex(random_bytes(32));
        $_SESSION['csrf_token'] = $token;

        return $token;
    }

    public static function getToken(): string
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            @session_start();
        }

        if (empty($_SESSION['csrf_token'])) {
            return self::generateToken();
        }

        return (string) $_SESSION['csrf_token'];
    }
}
