<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\Config;
use App\Core\HttpException;
use App\Core\Request;
use PHPUnit\Framework\TestCase;

class RequestTest extends TestCase
{
    private Config $config;

    protected function setUp(): void
    {
        $this->config = new Config();
        $this->config->set('request_body_max_bytes', 1024); // 1KB for testing limit
    }

    public function testParsesValidJsonBody(): void
    {
        $payload = json_encode(['service_id' => 12, 'notes' => 'Dental cleaning']);
        $request = Request::create(
            'POST',
            '/api/v1/appointments',
            ['Content-Type' => 'application/json'],
            $payload,
            [],
            $this->config
        );

        $this->assertSame('POST', $request->getMethod());
        $this->assertSame('/api/v1/appointments', $request->getPath());
        $this->assertSame(12, $request->input('service_id'));
        $this->assertSame('Dental cleaning', $request->input('notes'));
    }

    public function testRejectsMalformedJsonWith400(): void
    {
        $this->expectException(HttpException::class);
        $this->expectExceptionCode(400);

        Request::create(
            'POST',
            '/api/v1/appointments',
            ['Content-Type' => 'application/json'],
            '{ invalid json payload ...',
            [],
            $this->config
        );
    }

    public function testRejectsUnsupportedContentTypeOnStateChangingMethodWithBody(): void
    {
        $this->expectException(HttpException::class);
        $this->expectExceptionCode(415);

        Request::create(
            'POST',
            '/api/v1/appointments',
            ['Content-Type' => 'text/xml'],
            '<xml>data</xml>',
            [],
            $this->config
        );
    }

    public function testRejectsOversizedPayloadWith413(): void
    {
        $oversizedBody = str_repeat('A', 2048);

        $this->expectException(HttpException::class);
        $this->expectExceptionCode(413);

        Request::create(
            'POST',
            '/api/v1/appointments',
            ['Content-Type' => 'application/json'],
            $oversizedBody,
            [],
            $this->config
        );
    }

    public function testNormalizesPathProperly(): void
    {
        $this->assertSame('/api/v1/health', Request::normalizePath('api/v1/health/'));
        $this->assertSame('/api/v1/health', Request::normalizePath('///api///v1//health///'));
        $this->assertSame('/', Request::normalizePath(''));
    }

    public function testReadsQueryParametersAndRouteParameters(): void
    {
        $request = Request::create('GET', '/api/v1/services', [], '', ['page' => '2', 'active' => '1']);
        $request->setRouteParams(['category' => 'general']);

        $this->assertSame(2, $request->getQueryInt('page'));
        $this->assertSame('1', $request->getQueryString('active'));
        $this->assertSame('general', $request->getParam('category'));
    }
}

