<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Request;
use App\Core\Response;

/**
 * Standard Middleware Interface
 */
interface MiddlewareInterface
{
    /**
     * Handle an incoming request
     *
     * @param callable(Request): Response $next
     */
    public function handle(Request $request, callable $next): Response;
}

