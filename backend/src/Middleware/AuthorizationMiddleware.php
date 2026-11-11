<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;

/**
 * Role-Based Authorization Middleware (RBAC)
 * Enforces role boundaries with default-deny semantics.
 */
class AuthorizationMiddleware implements MiddlewareInterface
{
    /**
     * @var list<string>
     */
    private array $allowedRoles;

    /**
     * @param list<string> $allowedRoles
     */
    public function __construct(array $allowedRoles = ['ADMIN'])
    {
        $this->allowedRoles = array_map('strtoupper', $allowedRoles);
    }

    /**
     * Factory method for clean route middleware definition
     *
     * @param list<string> $roles
     */
    public static function hasRoles(array $roles): self
    {
        return new self($roles);
    }

    public function handle(Request $request, callable $next): Response
    {
        $user = $request->getUser();

        if ($user === null || !isset($user['role'])) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $userRole = strtoupper((string) $user['role']);

        if (!in_array($userRole, $this->allowedRoles, true)) {
            throw HttpException::forbidden(
                'You do not have permission to perform this operation.',
                'FORBIDDEN'
            );
        }

        return $next($request);
    }
}

