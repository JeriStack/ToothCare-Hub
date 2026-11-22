<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Config;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Repositories\UserRepository;
use App\Services\AuthService;

/**
 * Local/Development Swagger UI & OpenAPI Specification Controller.
 * Disabled in production by default (returns 404) unless SWAGGER_UI_ENABLED=true
 * and accessed by an authenticated ADMIN user.
 */
class OpenApiDocsController
{
    private Config $config;

    public function __construct(?Config $config = null)
    {
        $this->config = $config ?? Config::getInstance();
    }

    private function assertDocsAllowed(Request $request): void
    {
        $env = strtolower($this->config->getString('app_env', 'development'));
        $isProd = in_array($env, ['production', 'prod'], true);

        if (!$isProd) {
            return;
        }

        $enabledInProd = filter_var(getenv('SWAGGER_UI_ENABLED') ?: 'false', FILTER_VALIDATE_BOOLEAN);
        if (!$enabledInProd) {
            throw HttpException::notFound('API documentation is disabled in production.');
        }

        $user = $request->getUser();
        if (!is_array($user)) {
            $authService = new AuthService();
            $authService->initializeSession();
            if (session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION['user_id']) && !$authService->isCurrentSessionExpired()) {
                $found = (new UserRepository())->findById((int) $_SESSION['user_id']);
                if (is_array($found) && (int) ($found['is_active'] ?? 0) === 1) {
                    $user = $found;
                }
            }
        }

        $isAdmin = is_array($user) && strtoupper((string) ($user['role'] ?? '')) === 'ADMIN';
        if (!$isAdmin) {
            throw HttpException::notFound('API documentation is disabled in production.');
        }
    }

    /**
     * GET /api/v1/docs
     * Serves Swagger UI configured to load /api/v1/docs/openapi.yaml.
     */
    public function ui(Request $request): Response
    {
        $this->assertDocsAllowed($request);

        $html = <<<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ToothCare Hub — API Documentation (Swagger UI)</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #f8fafc; }
    .topbar-wrapper img { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: '/api/v1/docs/openapi.yaml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        persistAuthorization: false,
        withCredentials: true,
        presets: [SwaggerUIBundle.presets.apis]
      });
    };
  </script>
</body>
</html>
HTML;

        return Response::raw($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Cache-Control' => 'no-store',
            'X-Robots-Tag' => 'noindex, nofollow',
        ]);
    }

    /**
     * GET /api/v1/docs/openapi.yaml
     * Serves the generated OpenAPI 3.0.3 YAML specification.
     */
    public function spec(Request $request): Response
    {
        $this->assertDocsAllowed($request);

        $candidates = [
            dirname(__DIR__, 3) . '/docs/openapi.yaml',
            dirname(__DIR__, 2) . '/openapi/openapi.yaml',
        ];

        foreach ($candidates as $path) {
            if (is_file($path)) {
                $yaml = file_get_contents($path);
                if ($yaml !== false) {
                    return Response::raw($yaml, 200, [
                        'Content-Type' => 'application/yaml; charset=UTF-8',
                        'Cache-Control' => 'no-store',
                    ]);
                }
            }
        }

        throw HttpException::notFound('OpenAPI specification file not found. Run composer openapi:generate.');
    }
}
