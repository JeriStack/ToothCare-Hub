<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\Request;
use App\Core\Response;
use App\Middleware\RequestIdMiddleware;
use PHPUnit\Framework\TestCase;

class RequestIdMiddlewareTest extends TestCase
{
    private RequestIdMiddleware $middleware;

    protected function setUp(): void
    {
        $this->middleware = new RequestIdMiddleware();
    }

    public function testGeneratesRequestIdWhenMissing(): void
    {
        $request = Request::create('GET', '/api/v1/health');
        
        $response = $this->middleware->handle($request, function (Request $req) {
            $this->assertNotEmpty($req->getRequestId());
            return Response::success(['ok' => true]);
        });

        $this->assertNotEmpty($response->getHeaders()['X-Request-ID']);
        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
            $response->getHeaders()['X-Request-ID']
        );
    }

    public function testAcceptsValidClientSuppliedRequestId(): void
    {
        $customId = 'my-custom-client-request-id-12345';
        $request = Request::create('GET', '/api/v1/health', ['X-Request-ID' => $customId]);

        $response = $this->middleware->handle($request, function (Request $req) use ($customId) {
            $this->assertSame($customId, $req->getRequestId());
            return Response::success(['ok' => true]);
        });

        $this->assertSame($customId, $response->getHeaders()['X-Request-ID']);
    }

    public function testRejectsMaliciousOrInvalidCharactersInRequestId(): void
    {
        // CRLF injection or special characters
        $maliciousId = "evil-id\r\nX-Injected: true<script>";
        $request = Request::create('GET', '/api/v1/health', ['X-Request-ID' => $maliciousId]);

        $response = $this->middleware->handle($request, function (Request $req) use ($maliciousId) {
            // Must have generated a safe replacement instead of accepting the malicious ID
            $this->assertNotSame($maliciousId, $req->getRequestId());
            return Response::success(['ok' => true]);
        });

        $this->assertNotSame($maliciousId, $response->getHeaders()['X-Request-ID']);
    }
}

