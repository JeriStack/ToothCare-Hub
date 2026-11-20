<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthorizationMiddleware;
use App\Repositories\AuditLogRepository;
use App\Repositories\PermissionRepository;
use App\Repositories\RoleRepository;

/**
 * Dynamic Role-Based Access Control (DRBAC) Controller
 */
class RolePermissionController
{
    private RoleRepository $roleRepository;
    private PermissionRepository $permissionRepository;
    private AuditLogRepository $auditLogRepository;

    public function __construct(
        ?RoleRepository $roleRepository = null,
        ?PermissionRepository $permissionRepository = null,
        ?AuditLogRepository $auditLogRepository = null
    ) {
        $this->roleRepository = $roleRepository ?? new RoleRepository();
        $this->permissionRepository = $permissionRepository ?? new PermissionRepository();
        $this->auditLogRepository = $auditLogRepository ?? new AuditLogRepository();
    }

    /**
     * GET /api/v1/admin/roles
     * Retrieve all roles with assigned permissions and user counts
     */
    public function getRoles(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'roles.manage', ['ADMIN']);
        $roles = $this->roleRepository->getAllRolesWithPermissions();

        return Response::success($roles);
    }

    /**
     * GET /api/v1/admin/permissions
     * Retrieve full system permissions catalog grouped by module
     */
    public function getPermissions(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'roles.manage', ['ADMIN']);
        $grouped = $this->permissionRepository->getAllGroupedByModule();
        $flat = $this->permissionRepository->getAll();

        return Response::success([
            'catalog' => $flat,
            'grouped' => $grouped,
        ]);
    }

    /**
     * PUT /api/v1/admin/roles/{id}/permissions
     * Synchronize permissions assigned to a role with lockout safeguards
     */
    public function syncRolePermissions(Request $request): Response
    {
        $admin = AuthorizationMiddleware::requireUserPermission($request, 'roles.manage', ['ADMIN']);
        $roleId = (int) $request->getParam('id');

        $role = $this->roleRepository->findById($roleId);
        if ($role === null) {
            throw HttpException::notFound("Role #{$roleId} was not found.");
        }

        $body = $request->getBody();
        if (!isset($body['permissions']) || !is_array($body['permissions'])) {
            throw HttpException::unprocessable(
                'Invalid request payload.',
                ['permissions' => 'Permissions must be provided as an array of permission slugs.']
            );
        }

        $permissionSlugs = array_values(array_filter(
            array_map('trim', $body['permissions']),
            fn($p) => is_string($p) && $p !== ''
        ));

        $previousPermissions = $this->roleRepository->getRolePermissions($roleId);
        $this->roleRepository->syncRolePermissions($roleId, $permissionSlugs);
        $updatedPermissions = $this->roleRepository->getRolePermissions($roleId);

        try {
            $outboxService = new \App\Services\Realtime\RealtimeOutboxService();
            $outboxService->notifyRevocationBestEffort([
                'role' => strtoupper((string) ($role['slug'] ?? $role['name'] ?? '')),
                'reason' => 'PERMISSIONS_CHANGED',
            ]);
        } catch (\Throwable) {
            // Never block DRBAC updates when realtime service is unavailable
        }

        $this->auditLogRepository->record(
            'ROLE_PERMISSIONS_UPDATED',
            'roles',
            $roleId,
            (int) $admin['id'],
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            [
                'role' => $role['name'],
                'granted_count' => count($updatedPermissions),
                'permissions' => $updatedPermissions,
                'before' => [
                    'permissions' => $previousPermissions,
                    'granted_count' => count($previousPermissions),
                ],
                'after' => [
                    'permissions' => $updatedPermissions,
                    'granted_count' => count($updatedPermissions),
                ],
            ]
        );

        $updatedRole = $this->roleRepository->findById($roleId);
        $updatedRole['permissions'] = $updatedPermissions;

        return Response::success($updatedRole);
    }
}
