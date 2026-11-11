<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\CsrfMiddleware;
use PHPUnit\Framework\TestCase;

class CsrfMiddlewareTest extends TestCase
{
    private CsrfMiddleware $middleware;

    protected function setUp(): void
    {
        $this->middleware = new CsrfMiddleware();
        if (session_status() !== PHP_SESSION_ACTIVE) {
            @session_start();
        }
    }

    public function testSafeMethodsBypassCsrfValidation(): void
    {
        $request = Request::create('GET', '/api/v1/health');

        $response = $this->middleware->handle($request, function (Request $req) {
            return Response::success(['ok' => true]);
        });

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testUnsafeMethodSucceedsWithValidCsrfToken(): void
    {
        $token = CsrfMiddleware::generateToken();

        $request = Request::create('POST', '/api/v1/appointments', [
            'Content-Type' => 'application/json',
            'X-CSRF-Token' => $token,
        ], '{"test":true}');

        $response = $this->middleware->handle($request, function (Request $req) {
            return Response::success(['created' => true], 201);
        });

        $this->assertSame(201, $response->getStatusCode());
    }

    public function testUnsafeMethodRejectsMissingOrInvalidCsrfToken(): void
    {
        CsrfMiddleware::generateToken();

        $request = Request::create('POST', '/api/v1/appointments', [
            'Content-Type' => 'application/json',
            'X-CSRF-Token' => 'tampered_invalid_token_value',
        ], '{"test":true}');

        $this->expectException(HttpException::class);
        $this->expectExceptionCode(403);

        $this->middleware->handle($request, function (Request $req) {
            return Response::success(['created' => true]);
        });
    }
}

