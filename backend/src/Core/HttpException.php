<?php

declare(strict_types=1);

namespace App\Core;

use Exception;
use Throwable;

/**
 * Standard HTTP Exception for API responses
 */
class HttpException extends Exception
{
    protected int $statusCode;
    protected string $errorCode;
    /**
     * @var array<string, mixed>
     */
    protected array $details;

    /**
     * @param array<string, mixed> $details
     */
    public function __construct(
        int $statusCode,
        string $errorCode,
        string $message,
        array $details = [],
        ?Throwable $previous = null
    ) {
        parent::__construct($message, $statusCode, $previous);
        $this->statusCode = $statusCode;
        $this->errorCode = $errorCode;
        $this->details = $details;
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    /**
     * @return array<string, mixed>
     */
    public function getDetails(): array
    {
        return $this->details;
    }

    public static function badRequest(string $message = 'Bad Request', string $errorCode = 'BAD_REQUEST', array $details = []): self
    {
        return new self(400, $errorCode, $message, $details);
    }

    public static function malformedJson(string $message = 'Malformed JSON in request body'): self
    {
        return new self(400, 'MALFORMED_JSON', $message);
    }

    public static function unauthorized(string $message = 'Authentication required', string $errorCode = 'UNAUTHENTICATED'): self
    {
        return new self(401, $errorCode, $message);
    }

    public static function forbidden(string $message = 'Forbidden', string $errorCode = 'FORBIDDEN'): self
    {
        return new self(403, $errorCode, $message);
    }

    public static function csrfInvalid(string $message = 'CSRF token is missing or invalid'): self
    {
        return new self(403, 'CSRF_TOKEN_INVALID', $message);
    }

    public static function notFound(string $message = 'Resource not found', string $errorCode = 'NOT_FOUND'): self
    {
        return new self(404, $errorCode, $message);
    }

    /**
     * @param list<string> $allowedMethods
     */
    public static function methodNotAllowed(array $allowedMethods = []): self
    {
        $message = 'Method not allowed';
        if (!empty($allowedMethods)) {
            $message .= '. Allowed methods: ' . implode(', ', $allowedMethods);
        }
        return new self(405, 'METHOD_NOT_ALLOWED', $message, ['allowed_methods' => $allowedMethods]);
    }

    public static function conflict(string $message = 'Resource state conflict', string $errorCode = 'CONFLICT', array $details = []): self
    {
        return new self(409, $errorCode, $message, $details);
    }

    public static function payloadTooLarge(string $message = 'Request payload exceeds maximum allowed size'): self
    {
        return new self(413, 'PAYLOAD_TOO_LARGE', $message);
    }

    public static function unsupportedMediaType(string $message = 'Unsupported Media Type. Expected application/json'): self
    {
        return new self(415, 'UNSUPPORTED_MEDIA_TYPE', $message);
    }

    /**
     * @param array<string, mixed> $details
     */
    public static function unprocessableEntity(string $message = 'The submitted data is invalid.', array $details = []): self
    {
        return new self(422, 'VALIDATION_ERROR', $message, $details);
    }

    public static function internalError(string $message = 'An unexpected server error occurred.', ?Throwable $previous = null): self
    {
        return new self(500, 'INTERNAL_SERVER_ERROR', $message, [], $previous);
    }

    public static function serviceUnavailable(string $message = 'Service temporarily unavailable'): self
    {
        return new self(503, 'SERVICE_UNAVAILABLE', $message);
    }

    public static function notImplemented(string $message = 'Endpoint not yet implemented'): self
    {
        return new self(501, 'NOT_IMPLEMENTED', $message);
    }
}

