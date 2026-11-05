<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Standard HTTP API Response
 * Enforces unified JSON envelope: { data, meta, error }
 */
class Response
{
    private int $statusCode;
    /**
     * @var array<string, string>
     */
    private array $headers = [];
    private mixed $data = null;
    /**
     * @var array<string, mixed>
     */
    private array $meta = [];
    /**
     * @var array{code: string, message: string, details?: array<string, mixed>}|null
     */
    private ?array $error = null;
    private ?string $rawBody = null;
    private bool $isRaw = false;

    /**
     * @param array<string, mixed> $meta
     * @param array{code: string, message: string, details?: array<string, mixed>}|null $error
     * @param array<string, string> $headers
     */
    public function __construct(
        int $statusCode = 200,
        mixed $data = null,
        array $meta = [],
        ?array $error = null,
        array $headers = []
    ) {
        $this->statusCode = $statusCode;
        $this->data = $data;
        $this->meta = $meta;
        $this->error = $error;

        $this->headers = array_merge([
            'Content-Type' => 'application/json; charset=UTF-8',
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'SAMEORIGIN',
        ], $headers);
    }

    public static function success(mixed $data = null, int $statusCode = 200, array $meta = [], array $headers = []): self
    {
        return new self($statusCode, $data, $meta, null, $headers);
    }

    public static function created(mixed $data = null, array $meta = [], array $headers = []): self
    {
        return new self(201, $data, $meta, null, $headers);
    }

    /**
     * @param array<string, mixed> $meta
     * @param array<string, string> $headers
     */
    public static function paginated(mixed $data, array $meta = [], int $statusCode = 200, array $headers = []): self
    {
        return new self($statusCode, $data, $meta, null, $headers);
    }

    public static function noContent(array $headers = []): self
    {
        $response = new self(204, null, [], null, $headers);
        $response->rawBody = '';
        $response->isRaw = true;
        return $response;
    }

    /**
     * @param array<string, mixed> $details
     * @param array<string, mixed> $meta
     * @param array<string, string> $headers
     */
    public static function error(
        string $code,
        string $message,
        int $statusCode = 400,
        array $details = [],
        array $meta = [],
        array $headers = []
    ): self {
        $errorPayload = [
            'code' => $code,
            'message' => $message,
        ];

        if (!empty($details)) {
            $errorPayload['details'] = $details;
        }

        return new self($statusCode, null, $meta, $errorPayload, $headers);
    }

    public static function raw(string $body, int $statusCode = 200, array $headers = []): self
    {
        $response = new self($statusCode, null, [], null, $headers);
        $response->rawBody = $body;
        $response->isRaw = true;
        return $response;
    }

    public static function plainText(string $text, int $statusCode = 200, array $headers = []): self
    {
        $headers = array_merge([
            'Content-Type' => 'text/plain; version=0.0.4; charset=UTF-8',
        ], $headers);
        return self::raw($text, $statusCode, $headers);
    }

    public function setRequestId(string $requestId): self
    {
        $this->headers['X-Request-ID'] = $requestId;
        $this->meta['request_id'] = $requestId;
        return $this;
    }

    public function withHeader(string $name, string $value): self
    {
        $this->headers[$name] = $value;
        return $this;
    }

    /**
     * @param array<string, string> $headers
     */
    public function withHeaders(array $headers): self
    {
        foreach ($headers as $name => $value) {
            $this->headers[$name] = $value;
        }
        return $this;
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    /**
     * @return array<string, string>
     */
    public function getHeaders(): array
    {
        return $this->headers;
    }

    public function getData(): mixed
    {
        return $this->data;
    }

    /**
     * @return array<string, mixed>
     */
    public function getMeta(): array
    {
        return $this->meta;
    }

    /**
     * @return array{code: string, message: string, details?: array<string, mixed>}|null
     */
    public function getError(): ?array
    {
        return $this->error;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'data' => $this->data,
            'meta' => (object) $this->meta,
            'error' => $this->error,
        ];
    }

    public function getBody(): string
    {
        if ($this->isRaw) {
            return $this->rawBody ?? '';
        }

        if ($this->statusCode === 204) {
            return '';
        }

        $encoded = json_encode($this->toArray(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        return $encoded !== false ? $encoded : '{"data":null,"meta":{},"error":{"code":"JSON_ENCODE_ERROR","message":"Failed to encode response"}}';
    }

    public function send(): void
    {
        if (!headers_sent()) {
            http_response_code($this->statusCode);
            foreach ($this->headers as $header => $value) {
                header("{$header}: {$value}");
            }
        }

        if ($this->statusCode !== 204) {
            echo $this->getBody();
        }
    }
}
