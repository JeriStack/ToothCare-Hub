<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;

/**
 * CSRF Protection Middleware
 * Verifies CSRF token on unsafe HTTP methods (POST, PUT, PATCH, DELETE).
 */
class CsrfMiddleware implements MiddlewareInterface
{
    private const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

    public function handle(Request $request, callable $next): Response
    {
        $method = $request->getMethod();

        if (in_array($method, self::SAFE_METHODS, true)) {
            return $next($request);
        }

        // Only enforce when a session is active and has a CSRF token initialized
        if (session_status() === PHP_SESSION_ACTIVE && isset($_SESSION['csrf_token'])) {
            $sessionToken = (string) $_SESSION['csrf_token'];
            $clientToken = $request->getHeader('x-csrf-token') ?? (string) $request->input('_csrf_token', '');

            if ($clientToken === '' || !hash_equals($sessionToken, $clientToken)) {
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

