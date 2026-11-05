<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Standard HTTP API Request
 * Encapsulates HTTP method, path, headers, query parameters, parsed JSON body, and route parameters.
 */
class Request
{
    private string $method;
    private string $path;
    /**
     * @var array<string, string>
     */
    private array $headers = [];
    /**
     * @var array<string, mixed>
     */
    private array $queryParams = [];
    /**
     * @var array<string, mixed>
     */
    private array $body = [];
    private string $rawBody = '';
    /**
     * @var array<string, string>
     */
    private array $routeParams = [];
    private string $requestId = '';
    /**
     * @var array<string, mixed>
     */
    private array $attributes = [];

    /**
     * @param array<string, string> $headers
     * @param array<string, mixed> $queryParams
     * @param array<string, mixed> $body
     * @param array<string, string> $routeParams
     */
    public function __construct(
        string $method,
        string $path,
        array $headers = [],
        array $queryParams = [],
        array $body = [],
        string $rawBody = '',
        array $routeParams = [],
        string $requestId = ''
    ) {
        $this->method = strtoupper($method);
        $this->path = self::normalizePath($path);
        
        foreach ($headers as $name => $value) {
            $this->headers[strtolower($name)] = $value;
        }

        $this->queryParams = $queryParams;
        $this->body = $body;
        $this->rawBody = $rawBody;
        $this->routeParams = $routeParams;
        $this->requestId = $requestId;
    }

    public static function createFromGlobals(?Config $config = null): self
    {
        $cfg = $config ?? Config::getInstance();
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $path = (string) parse_url($uri, PHP_URL_PATH);

        // Extract headers
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $name = str_replace('_', '-', strtolower(substr($key, 5)));
                $headers[$name] = (string) $value;
            } elseif (in_array($key, ['CONTENT_TYPE', 'CONTENT_LENGTH', 'CONTENT_MD5'], true)) {
                $name = str_replace('_', '-', strtolower($key));
                $headers[$name] = (string) $value;
            }
        }

        // Query parameters
        $queryParams = $_GET;

        // Raw body
        $rawBody = (string) file_get_contents('php://input');
        $maxBodyBytes = $cfg->getInt('request_body_max_bytes', 1048576);

        if (strlen($rawBody) > $maxBodyBytes) {
            throw HttpException::payloadTooLarge();
        }

        $contentType = $headers['content-type'] ?? '';
        $body = [];

        if ($rawBody !== '') {
            $isJson = str_contains(strtolower($contentType), 'application/json');
            
            // If body is provided on state-changing methods, enforce application/json
            if (!$isJson && in_array(strtoupper($method), ['POST', 'PUT', 'PATCH'], true)) {
                // Reject unsupported media type
                throw HttpException::unsupportedMediaType();
            }

            if ($isJson) {
                $decoded = json_decode($rawBody, true);
                if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
                    throw HttpException::malformedJson();
                }
                $body = $decoded;
            }
        }

        return new self($method, $path, $headers, $queryParams, $body, $rawBody);
    }

    /**
     * @param array<string, string> $headers
     * @param array<string, mixed> $queryParams
     */
    public static function create(
        string $method,
        string $path,
        array $headers = [],
        string $rawBody = '',
        array $queryParams = [],
        ?Config $config = null
    ): self {
        $cfg = $config ?? Config::getInstance();
        $maxBodyBytes = $cfg->getInt('request_body_max_bytes', 1048576);

        if (strlen($rawBody) > $maxBodyBytes) {
            throw HttpException::payloadTooLarge();
        }

        $normalizedHeaders = [];
        foreach ($headers as $k => $v) {
            $normalizedHeaders[strtolower($k)] = (string) $v;
        }

        $contentType = $normalizedHeaders['content-type'] ?? '';
        $body = [];

        if ($rawBody !== '') {
            $isJson = str_contains(strtolower($contentType), 'application/json');
            
            if (!$isJson && in_array(strtoupper($method), ['POST', 'PUT', 'PATCH'], true)) {
                throw HttpException::unsupportedMediaType();
            }

            if ($isJson) {
                $decoded = json_decode($rawBody, true);
                if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
                    throw HttpException::malformedJson();
                }
                $body = $decoded;
            }
        }

        return new self(
            $method,
            $path,
            $normalizedHeaders,
            $queryParams,
            $body,
            $rawBody
        );
    }

    public static function normalizePath(string $path): string
    {
        $clean = preg_replace('#/{2,}#', '/', '/' . trim($path, '/'));
        return ($clean === '' || $clean === false) ? '/' : $clean;
    }

    public function getMethod(): string
    {
        return $this->method;
    }

    public function getPath(): string
    {
        return $this->path;
    }

    public function getHeader(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    public function hasHeader(string $name): bool
    {
        return isset($this->headers[strtolower($name)]);
    }

    /**
     * @return array<string, string>
     */
    public function getHeaders(): array
    {
        return $this->headers;
    }

    public function getContentType(): string
    {
        return $this->getHeader('content-type') ?? '';
    }

    /**
     * @return array<string, mixed>
     */
    public function getQueryParams(): array
    {
        return $this->queryParams;
    }

    public function getQuery(string $key, mixed $default = null): mixed
    {
        return $this->queryParams[$key] ?? $default;
    }

    public function getQueryInt(string $key, int $default = 0): int
    {
        $val = $this->getQuery($key, $default);
        return is_numeric($val) ? (int) $val : $default;
    }

    public function getQueryString(string $key, string $default = ''): string
    {
        $val = $this->getQuery($key, $default);
        return is_scalar($val) ? (string) $val : $default;
    }

    /**
     * @return array<string, mixed>
     */
    public function getBody(): array
    {
        return $this->body;
    }

    public function getRawBody(): string
    {
        return $this->rawBody;
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $default;
    }

    /**
     * @param array<string, string> $params
     */
    public function setRouteParams(array $params): void
    {
        $this->routeParams = $params;
    }

    public function getParam(string $name, ?string $default = null): ?string
    {
        return $this->routeParams[$name] ?? $default;
    }

    /**
     * @return array<string, string>
     */
    public function getRouteParams(): array
    {
        return $this->routeParams;
    }

    public function getRequestId(): string
    {
        return $this->requestId;
    }

    public function setRequestId(string $requestId): void
    {
        $this->requestId = $requestId;
    }

    public function getAttribute(string $key, mixed $default = null): mixed
    {
        return $this->attributes[$key] ?? $default;
    }

    public function setAttribute(string $key, mixed $value): self
    {
        $this->attributes[$key] = $value;
        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    public function getAttributes(): array
    {
        return $this->attributes;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getUser(): ?array
    {
        $user = $this->getAttribute('user');
        return is_array($user) ? $user : null;
    }

    /**
     * @param array<string, mixed>|null $user
     */
    public function setUser(?array $user): self
    {
        $this->setAttribute('user', $user);
        return $this;
    }

    public function getClientIp(): string
    {
        $forwarded = $this->getHeader('x-forwarded-for');
        if ($forwarded !== null && $forwarded !== '') {
            $parts = explode(',', $forwarded);
            $client = trim($parts[0]);
            if (filter_var($client, FILTER_VALIDATE_IP)) {
                return $client;
            }
        }

        $realIp = $this->getHeader('x-real-ip');
        if ($realIp !== null && filter_var($realIp, FILTER_VALIDATE_IP)) {
            return $realIp;
        }

        $remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        return filter_var($remoteAddr, FILTER_VALIDATE_IP) ? (string) $remoteAddr : '127.0.0.1';
    }
}

