<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Config;
use App\Core\Request;
use App\Core\Response;

/**
 * CORS Middleware
 * Enforces strict origin allowlists, credentialed cross-origin headers, and preflight handling.
 */
class CorsMiddleware implements MiddlewareInterface
{
    private Config $config;

    public function __construct(?Config $config = null)
    {
        $this->config = $config ?? Config::getInstance();
    }

    public function handle(Request $request, callable $next): Response
    {
        $origin = $request->getHeader('origin');
        $allowedOrigins = $this->config->getArray('cors_allowed_origins', [
            'http://localhost:5173',
            'http://localhost:8080',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:8080',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
        ]);
        $maxAge = (string) $this->config->getInt('cors_max_age', 86400);

        $isAllowed = false;
        if ($origin !== null) {
            $trimmedOrigin = rtrim($origin, '/');
            $allowedList = array_map(fn ($o) => rtrim($o, '/'), $allowedOrigins);
            if (in_array($trimmedOrigin, $allowedList, true)) {
                $isAllowed = true;
            } elseif ($this->config->getString('app_env') === 'development') {
                $host = parse_url($origin, PHP_URL_HOST);
                if ($host && (
                    $host === 'localhost' ||
                    $host === '127.0.0.1' ||
                    str_starts_with($host, '192.168.') ||
                    str_starts_with($host, '10.') ||
                    preg_match('/^172\.(1[6-9]|2[0-9]|3[0-1])\./', $host)
                )) {
                    $isAllowed = true;
                }
            }
        }

        // Handle OPTIONS preflight request
        if ($request->getMethod() === 'OPTIONS') {
            $headers = [
                'Vary' => 'Origin',
            ];

            if ($isAllowed && $origin !== null) {
                $headers['Access-Control-Allow-Origin'] = $origin;
                $headers['Access-Control-Allow-Credentials'] = 'true';
                $headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
                $headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Request-ID, X-CSRF-Token, Accept';
                $headers['Access-Control-Max-Age'] = $maxAge;
            }

            return Response::noContent($headers);
        }

        $response = $next($request);

        // Always append Vary: Origin
        $response->withHeader('Vary', 'Origin');

        if ($isAllowed && $origin !== null) {
            $response->withHeader('Access-Control-Allow-Origin', $origin);
            $response->withHeader('Access-Control-Allow-Credentials', 'true');
            $response->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-CSRF-Token, Accept');
        }

        return $response;
    }
}

