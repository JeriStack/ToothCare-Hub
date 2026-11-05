<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Repositories\RateLimitRepository;

/**
 * Route-Level Rate Limiting Middleware
 * Enforces request throttling with sliding-window accounting and standard rate limit headers.
 */
class RateLimitMiddleware implements MiddlewareInterface
{
    private string $actionPrefix;
    private int $maxRequests;
    private int $windowSeconds;
    private RateLimitRepository $repository;

    public function __construct(
        string $actionPrefix = 'api',
        int $maxRequests = 60,
        int $windowSeconds = 60,
        ?RateLimitRepository $repository = null
    ) {
        $this->actionPrefix = $actionPrefix;
        $this->maxRequests = $maxRequests;
        $this->windowSeconds = $windowSeconds;
        $this->repository = $repository ?? new RateLimitRepository();
    }

    public static function perMinute(int $maxRequests, string $actionPrefix = 'api'): self
    {
        return new self($actionPrefix, $maxRequests, 60);
    }

    public function handle(Request $request, callable $next): Response
    {
        $ip = $request->getClientIp();
        $key = "{$this->actionPrefix}:ip:{$ip}";

        $status = $this->repository->hit($key, $this->maxRequests, $this->windowSeconds);

        if (!$status['allowed']) {
            $retryAfter = max(1, $status['reset_at'] - time());
            $exception = HttpException::tooManyRequests(
                'Rate limit exceeded. Please try again later.',
                $retryAfter
            );

            $response = Response::error(
                $exception->getErrorCode(),
                $exception->getMessage(),
                $exception->getStatusCode(),
                $exception->getDetails()
            );

            $response->withHeader('Retry-After', (string) $retryAfter);
            $response->withHeader('X-RateLimit-Limit', (string) $this->maxRequests);
            $response->withHeader('X-RateLimit-Remaining', '0');
            $response->withHeader('X-RateLimit-Reset', (string) $status['reset_at']);

            return $response;
        }

        /** @var Response $response */
        $response = $next($request);

        $response->withHeader('X-RateLimit-Limit', (string) $this->maxRequests);
        $response->withHeader('X-RateLimit-Remaining', (string) $status['remaining']);
        $response->withHeader('X-RateLimit-Reset', (string) $status['reset_at']);

        return $response;
    }
}

