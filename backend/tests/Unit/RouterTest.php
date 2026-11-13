<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;
use PHPUnit\Framework\TestCase;

class RouterTest extends TestCase
{
    private Router $router;

    protected function setUp(): void
    {
        $this->router = new Router();
    }

    public function testMatchesKnownRoute(): void
    {
        $this->router->get('/api/v1/test', function (Request $req) {
            return Response::success(['matched' => true]);
        });

        $request = Request::create('GET', '/api/v1/test');
        $response = $this->router->dispatch($request);

        $this->assertSame(200, $response->getStatusCode());
        $body = json_decode($response->getBody(), true);
        $this->assertTrue($body['data']['matched']);
    }

    public function testExtractsRouteParameters(): void
    {
        $this->router->get('/api/v1/services/{id}', function (Request $req) {
            return Response::success(['service_id' => $req->getParam('id')]);
        });

        $request = Request::create('GET', '/api/v1/services/42');
        $response = $this->router->dispatch($request);

        $this->assertSame(200, $response->getStatusCode());
        $body = json_decode($response->getBody(), true);
        $this->assertSame('42', $body['data']['service_id']);
    }

    public function testReturns404ForUnknownRoute(): void
    {
        $this->expectException(HttpException::class);
        $this->expectExceptionCode(404);

        $request = Request::create('GET', '/api/v1/non-existent');
        $this->router->dispatch($request);
    }

    public function testReturns405ForMethodNotAllowedWithAllowHeader(): void
    {
        $this->router->get('/api/v1/services', function (Request $req) {
            return Response::success([]);
        });

        $request = Request::create('POST', '/api/v1/services');
        $response = $this->router->dispatch($request);

        $this->assertSame(405, $response->getStatusCode());
        $this->assertSame('GET', $response->getHeaders()['Allow']);

        $body = json_decode($response->getBody(), true);
        $this->assertSame('METHOD_NOT_ALLOWED', $body['error']['code']);
    }

    public function testGroupPrefixRegistration(): void
    {
        $this->router->group('/api/v1', function (Router $r) {
            $r->get('/health', function (Request $req) {
                return Response::success(['healthy' => true]);
            });
        });

        $request = Request::create('GET', '/api/v1/health');
        $response = $this->router->dispatch($request);

        $this->assertSame(200, $response->getStatusCode());
    }
}

