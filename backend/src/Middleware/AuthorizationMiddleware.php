<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Repositories\RoleRepository;

/**
 * Dynamic Role-Based Access Control Middleware (DRBAC)
 * Enforces role boundaries and dynamic database-driven permissions with default-deny semantics.
 */
class AuthorizationMiddleware implements MiddlewareInterface
{
    /**
     * @var list<string>
     */
    private array $allowedRoles;

    private ?string $requiredPermission;

    private ?RoleRepository $roleRepository;

    /**
     * @param list<string> $allowedRoles
     */
    public function __construct(
        array $allowedRoles = ['ADMIN'],
        ?string $requiredPermission = null,
        ?RoleRepository $roleRepository = null
    ) {
        $this->allowedRoles = array_map('strtoupper', $allowedRoles);
        $this->requiredPermission = $requiredPermission;
        $this->roleRepository = $roleRepository;
    }

    /**
     * Factory method for role-based middleware definition
     *
     * @param list<string> $roles
     */
    public static function hasRoles(array $roles): self
    {
        return new self($roles);
    }

    /**
     * Factory method for dynamic permission-based middleware definition (DRBAC)
     *
     * @param list<string> $fallbackRoles
     */
    public static function hasPermission(string $permissionSlug, array $fallbackRoles = []): self
    {
        return new self($fallbackRoles, $permissionSlug);
    }

    /**
     * Shared defense-in-depth helper for controllers checking a dynamic DRBAC permission.
     *
     * @param list<string> $fallbackRoles
     * @return array<string, mixed>
     * @throws HttpException
     */
    public static function requireUserPermission(
        Request $request,
        string $permissionSlug,
        array $fallbackRoles = ['ADMIN'],
        ?RoleRepository $roleRepository = null
    ): array {
        $user = $request->getUser();
        if ($user === null || !isset($user['role'])) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $userRole = strtoupper((string) $user['role']);
        $fallbackNormalized = array_map('strtoupper', $fallbackRoles);

        try {
            $repo = $roleRepository ?? new RoleRepository();
            if ($repo->roleHasPermission($userRole, $permissionSlug)) {
                return $user;
            }
            throw HttpException::forbidden(
                "Access denied. Missing required permission: {$permissionSlug}.",
                'FORBIDDEN'
            );
        } catch (HttpException $e) {
            throw $e;
        } catch (\Throwable $e) {
            if (in_array($userRole, $fallbackNormalized, true)) {
                return $user;
            }
            throw HttpException::forbidden('You do not have permission to perform this operation.', 'FORBIDDEN');
        }
    }

    public function handle(Request $request, callable $next): Response
    {
        $user = $request->getUser();

        if ($user === null || !isset($user['role'])) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $userRole = strtoupper((string) $user['role']);

        // 1. Dynamic Permission Verification (DRBAC)
        if ($this->requiredPermission !== null) {
            self::requireUserPermission(
                $request,
                $this->requiredPermission,
                $this->allowedRoles,
                $this->roleRepository
            );
            return $next($request);
        }

        // 2. Standard Role Boundary Check
        if (!in_array($userRole, $this->allowedRoles, true)) {
            throw HttpException::forbidden(
                'You do not have permission to perform this operation.',
                'FORBIDDEN'
            );
        }

        return $next($request);
    }
}
