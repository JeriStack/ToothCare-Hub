<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Request;
use PHPUnit\Framework\TestCase;

class HealthApiTest extends TestCase
{
    private Application $app;

    protected function setUp(): void
    {
        $this->app = new Application(null, false);
    }

    public function testGetHealthReturns200WithStandardEnvelope(): void
    {
        $request = Request::create('GET', '/api/v1/health');
        $response = $this->app->handle($request);

        $this->assertSame(200, $response->getStatusCode());
        
        $headers = $response->getHeaders();
        $this->assertArrayHasKey('X-Request-ID', $headers);
        $this->assertSame('nosniff', $headers['X-Content-Type-Options']);
        $this->assertSame('SAMEORIGIN', $headers['X-Frame-Options']);

        $body = json_decode($response->getBody(), true);
        $this->assertIsArray($body);
        $this->assertNull($body['error']);
        $this->assertSame($headers['X-Request-ID'], $body['meta']['request_id']);

        $data = $body['data'];
        $this->assertSame('ok', $data['status']);
        $this->assertSame('toothcare-backend', $data['service']);
        $this->assertNotEmpty($data['environment']);
        $this->assertNotEmpty($data['timestamp']);
    }

    public function testGetHealthWithClientSuppliedRequestId(): void
    {
        $customRequestId = 'client-cid-987654321';
        $request = Request::create('GET', '/api/v1/health', ['X-Request-ID' => $customRequestId]);
        $response = $this->app->handle($request);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame($customRequestId, $response->getHeaders()['X-Request-ID']);

        $body = json_decode($response->getBody(), true);
        $this->assertSame($customRequestId, $body['meta']['request_id']);
    }

    public function testUnregisteredRouteReturns404WithEnvelope(): void
    {
        $request = Request::create('GET', '/api/v1/unknown-endpoint');
        $response = $this->app->handle($request);

        $this->assertSame(404, $response->getStatusCode());

        $body = json_decode($response->getBody(), true);
        $this->assertNull($body['data']);
        $this->assertSame('NOT_FOUND', $body['error']['code']);
    }

    public function testPlannedRouteReturns501NotImplemented(): void
    {
        $request = Request::create('GET', '/api/v1/patients');
        $response = $this->app->handle($request);

        $this->assertSame(501, $response->getStatusCode());

        $body = json_decode($response->getBody(), true);
        $this->assertNull($body['data']);
        $this->assertSame('NOT_IMPLEMENTED', $body['error']['code']);
    }
}
