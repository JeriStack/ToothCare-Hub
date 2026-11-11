<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\Config;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\CorsMiddleware;
use PHPUnit\Framework\TestCase;

class CorsMiddlewareTest extends TestCase
{
    private Config $config;
    private CorsMiddleware $middleware;

    protected function setUp(): void
    {
        $this->config = new Config();
        $this->config->set('cors_allowed_origins', ['http://localhost:5173', 'http://127.0.0.1:5173']);
        $this->middleware = new CorsMiddleware($this->config);
    }

    public function testAllowsExplicitlyPermittedOrigin(): void
    {
        $request = Request::create('GET', '/api/v1/health', ['Origin' => 'http://localhost:5173']);

        $response = $this->middleware->handle($request, function (Request $req) {
            return Response::success(['ok' => true]);
        });

        $headers = $response->getHeaders();
        $this->assertSame('http://localhost:5173', $headers['Access-Control-Allow-Origin']);
        $this->assertSame('true', $headers['Access-Control-Allow-Credentials']);
        $this->assertSame('Origin', $headers['Vary']);
    }

    public function testRejectsUnapprovedOrigin(): void
    {
        $request = Request::create('GET', '/api/v1/health', ['Origin' => 'http://evil-attacker-site.com']);

        $response = $this->middleware->handle($request, function (Request $req) {
            return Response::success(['ok' => true]);
        });

        $headers = $response->getHeaders();
        $this->assertArrayNotHasKey('Access-Control-Allow-Origin', $headers);
        $this->assertArrayNotHasKey('Access-Control-Allow-Credentials', $headers);
    }

    public function testHandlesOptionsPreflightForAllowedOrigin(): void
    {
        $request = Request::create('OPTIONS', '/api/v1/appointments', [
            'Origin' => 'http://localhost:5173',
            'Access-Control-Request-Method' => 'POST',
        ]);

        $response = $this->middleware->handle($request, function (Request $req) {
            $this->fail('Pipeline should terminate at preflight options check');
        });

        $this->assertSame(204, $response->getStatusCode());
        $headers = $response->getHeaders();
        $this->assertSame('http://localhost:5173', $headers['Access-Control-Allow-Origin']);
        $this->assertSame('true', $headers['Access-Control-Allow-Credentials']);
        $this->assertStringContainsString('POST', $headers['Access-Control-Allow-Methods']);
    }
}

