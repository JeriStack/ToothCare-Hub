<?php

declare(strict_types=1);

namespace App\Services\Realtime;

use App\Core\Logger;
use Throwable;

/**
 * Signed HTTP client for PHP -> Node.js Socket.IO internal endpoints (/internal/publish, /internal/revoke).
 * Never exposes secrets in logs and supports an injectable transport for deterministic unit/integration testing.
 */
class RealtimePublisherClient
{
    private RealtimeConfig $config;
    private InternalRequestSigner $signer;
    private Logger $logger;

    /** @var callable|null fn(string $url, string $method, array<string,string> $headers, string $body, float $timeout): array{status:int, body:string, error?:string} */
    private $transport;

    public function __construct(
        ?RealtimeConfig $config = null,
        ?InternalRequestSigner $signer = null,
        ?Logger $logger = null,
        ?callable $transport = null
    ) {
        $this->config = $config ?? RealtimeConfig::fromEnvironment();
        $this->signer = $signer ?? new InternalRequestSigner($this->config->internalSecret, $this->config->replayWindowSeconds);
        $this->logger = $logger ?? Logger::getInstance();
        $this->transport = $transport;
    }

    /**
     * Publish a single validated outbox event to the Node.js realtime service.
     *
     * @param array<string, mixed> $envelope
     * @return array{ok: bool, status: int, error: string|null, duplicate?: bool}
     */
    public function publishEvent(array $envelope): array
    {
        return $this->postJson('/internal/publish', $envelope);
    }

    /**
     * Notify the Node.js realtime service to disconnect/re-evaluate sockets on logout, deactivation, or role/permission changes.
     *
     * @param array<string, mixed> $payload
     * @return array{ok: bool, status: int, error: string|null}
     */
    public function revokeAuthorization(array $payload): array
    {
        return $this->postJson('/internal/revoke', $payload);
    }

    /**
     * @param array<string, mixed> $payload
     * @return array{ok: bool, status: int, error: string|null, duplicate?: bool}
     */
    private function postJson(string $path, array $payload): array
    {
        if (!$this->config->enabled) {
            return ['ok' => false, 'status' => 0, 'error' => 'REALTIME_DISABLED'];
        }

        if (!$this->config->hasSecret()) {
            return ['ok' => false, 'status' => 0, 'error' => 'REALTIME_INTERNAL_SECRET_MISSING'];
        }

        $rawBody = json_encode($payload, JSON_UNESCAPED_SLASHES);
        if ($rawBody === false) {
            return ['ok' => false, 'status' => 0, 'error' => 'JSON_ENCODE_FAILED'];
        }

        $authHeaders = $this->signer->signHeaders('POST', $path, $rawBody);
        $headers = array_merge([
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ], $authHeaders);

        $url = $this->config->internalUrl . $path;

        try {
            $response = $this->transport !== null
                ? ($this->transport)($url, 'POST', $headers, $rawBody, $this->config->publishTimeoutSeconds)
                : $this->defaultHttpPost($url, $headers, $rawBody, $this->config->publishTimeoutSeconds);

            $status = (int) ($response['status'] ?? 0);
            $body = (string) ($response['body'] ?? '');
            $decoded = json_decode($body, true);

            if ($status >= 200 && $status < 300) {
                return [
                    'ok' => true,
                    'status' => $status,
                    'error' => null,
                    'duplicate' => (bool) ($decoded['duplicate'] ?? false),
                ];
            }

            $errMsg = (string) ($response['error'] ?? ($decoded['error'] ?? "HTTP {$status}"));
            return [
                'ok' => false,
                'status' => $status,
                'error' => $errMsg,
            ];
        } catch (Throwable $e) {
            $this->logger->warning('Realtime internal HTTP call failed', [
                'path' => $path,
                'error' => $e->getMessage(),
            ]);

            return [
                'ok' => false,
                'status' => 0,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * @param array<string, string> $headers
     * @return array{status: int, body: string, error?: string}
     */
    private function defaultHttpPost(string $url, array $headers, string $rawBody, float $timeoutSeconds): array
    {
        $headerLines = [];
        foreach ($headers as $k => $v) {
            $headerLines[] = "{$k}: {$v}";
        }

        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", $headerLines) . "\r\n",
                'content' => $rawBody,
                'timeout' => $timeoutSeconds,
                'ignore_errors' => true,
            ],
        ]);

        $body = @file_get_contents($url, false, $context);
        $status = 0;

        $responseHeaders = function_exists('http_get_last_response_headers')
            ? (http_get_last_response_headers() ?? [])
            : [];

        foreach ($responseHeaders as $line) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#i', $line, $matches)) {
                $status = (int) $matches[1];
            }
        }

        if ($body === false) {
            $lastErr = error_get_last();
            return [
                'status' => $status,
                'body' => '',
                'error' => $lastErr['message'] ?? 'Connection to realtime service failed',
            ];
        }

        return [
            'status' => $status,
            'body' => $body,
        ];
    }
}
