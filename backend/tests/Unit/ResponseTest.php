<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\Response;
use PHPUnit\Framework\TestCase;

class ResponseTest extends TestCase
{
    public function testSuccessEnvelopeStructure(): void
    {
        $response = Response::success(['id' => 101, 'status' => 'confirmed'], 200);
        $response->setRequestId('test-req-12345');

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('test-req-12345', $response->getHeaders()['X-Request-ID']);

        $body = json_decode($response->getBody(), true);
        $this->assertIsArray($body);
        $this->assertArrayHasKey('data', $body);
        $this->assertArrayHasKey('meta', $body);
        $this->assertArrayHasKey('error', $body);

        $this->assertSame(101, $body['data']['id']);
        $this->assertSame('test-req-12345', $body['meta']['request_id']);
        $this->assertNull($body['error']);
    }

    public function testErrorEnvelopeStructure(): void
    {
        $response = Response::error(
            'VALIDATION_ERROR',
            'The submitted data is invalid.',
            422,
            ['email' => ['A valid email address is required.']]
        );
        $response->setRequestId('err-req-999');

        $this->assertSame(422, $response->getStatusCode());

        $body = json_decode($response->getBody(), true);
        $this->assertIsArray($body);
        $this->assertNull($body['data']);
        $this->assertSame('err-req-999', $body['meta']['request_id']);
        $this->assertSame('VALIDATION_ERROR', $body['error']['code']);
        $this->assertSame('The submitted data is invalid.', $body['error']['message']);
        $this->assertSame(['A valid email address is required.'], $body['error']['details']['email']);
    }

    public function testNoContentResponseHasEmptyBody(): void
    {
        $response = Response::noContent();
        $this->assertSame(204, $response->getStatusCode());
        $this->assertSame('', $response->getBody());
    }

    public function testDefaultSecurityHeadersPresent(): void
    {
        $response = Response::success(['ok' => true]);
        $headers = $response->getHeaders();

        $this->assertSame('nosniff', $headers['X-Content-Type-Options']);
        $this->assertSame('SAMEORIGIN', $headers['X-Frame-Options']);
        $this->assertStringContainsString('application/json', $headers['Content-Type']);
    }
}

