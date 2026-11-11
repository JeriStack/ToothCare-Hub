<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Request;
use App\Core\Response;

/**
 * Request ID Middleware
 * Inspects or generates unique correlation ID, binds to request and response.
 */
class RequestIdMiddleware implements MiddlewareInterface
{
    private const MAX_LENGTH = 64;
    private const PATTERN = '/^[a-zA-Z0-9_\-]+$/';

    public function handle(Request $request, callable $next): Response
    {
        $incomingId = $request->getHeader('x-request-id');
        $requestId = '';

        if ($incomingId !== null && $this->isValidRequestId($incomingId)) {
            $requestId = $incomingId;
        } else {
            $requestId = $this->generateUuid();
        }

        $request->setRequestId($requestId);

        $response = $next($request);
        $response->setRequestId($requestId);

        return $response;
    }

    private function isValidRequestId(string $id): bool
    {
        $trimmed = trim($id);
        if ($trimmed === '' || strlen($trimmed) > self::MAX_LENGTH) {
            return false;
        }

        return (bool) preg_match(self::PATTERN, $trimmed);
    }

    public function generateUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40); // Version 4
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80); // Variant RFC 4122

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}

