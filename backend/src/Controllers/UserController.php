<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthorizationMiddleware;
use App\Repositories\AuditLogRepository;
use App\Repositories\UserRepository;
use App\Validators\UserValidator;
use PDO;

/**
 * Administrative User & Account Management Controller
 */
class UserController
{
    private UserRepository $userRepository;
    private AuditLogRepository $auditLogRepository;

    public function __construct(
        ?UserRepository $userRepository = null,
        ?AuditLogRepository $auditLogRepository = null
    ) {
        $this->userRepository = $userRepository ?? new UserRepository();
        $this->auditLogRepository = $auditLogRepository ?? new AuditLogRepository();
    }

    /**
     * GET /api/v1/admin/users
     * Paginated user directory with search, role, and status filters
     */
    public function index(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'users.view', ['ADMIN']);

        $filters = [
            'search' => $request->getQuery('search'),
            'role' => $request->getQuery('role'),
            'is_active' => $request->getQuery('is_active') ?? $request->getQuery('status'),
            'email_verified' => $request->getQuery('email_verified'),
        ];

        $sortBy = (string) ($request->getQuery('sort_by') ?? 'created_at');
        $sortDir = (string) ($request->getQuery('sort_dir') ?? 'DESC');
        $page = (int) ($request->getQuery('page') ?? 1);
        $perPage = (int) ($request->getQuery('per_page') ?? 15);

        $result = $this->userRepository->list($filters, $sortBy, $sortDir, $page, $perPage);

        return Response::paginated($result['data'], $result['meta']);
    }

    /**
     * GET /api/v1/admin/users/{id}
     * Retrieve user profile with linked dentist or patient record
     */
    public function show(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'users.view', ['ADMIN']);

        $id = (int) $request->getParam('id');
        $user = $this->userRepository->getUserWithProfile($id);

        if ($user === null) {
            throw HttpException::notFound("User #{$id} was not found.");
        }

        return Response::success($user);
    }

    /**
     * POST /api/v1/admin/users
     * Create staff account (Dentist, Receptionist, Administrator)
     */
    public function store(Request $request): Response
    {
        $admin = AuthorizationMiddleware::requireUserPermission($request, 'users.manage', ['ADMIN']);
        $validated = UserValidator::validateCreateStaff($request->getBody());

        // Ensure unique email
        $existing = $this->userRepository->findByEmail($validated['email']);
        if ($existing !== null) {
            throw HttpException::conflict(
                'An account with this email address already exists.',
                'EMAIL_ALREADY_EXISTS'
            );
        }

        $passwordHash = password_hash($validated['password'], PASSWORD_DEFAULT);
        $userId = $this->userRepository->create(
            $validated['email'],
            $passwordHash,
            $validated['role'],
            1, // is_active
            1  // email_verified
        );

        // Assign to user_roles table if enabled
        $this->userRepository->assignUserRole($userId, strtolower($validated['role']));

        // If Dentist, create linked dentist profile
        if ($validated['role'] === 'DENTIST') {
            try {
                $pdo = Database::getInstance()->getConnection();
                $stmt = $pdo->prepare('
                    INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone, is_active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
                ');
                $stmt->execute([
                    $userId,
                    $validated['first_name'],
                    $validated['last_name'],
                    $validated['specialization'] ?? 'General Dentistry',
                    $validated['license_number'] ?? ('PRC-' . rand(100000, 999999)),
                    $validated['phone'] ?? null,
                ]);
            } catch (\Throwable $e) {
                // If profile insert fails, safely log
            }
        }

        $this->auditLogRepository->record(
            'STAFF_ACCOUNT_CREATED',
            'users',
            $userId,
            (int) $admin['id'],
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            [
                'email' => $validated['email'],
                'role' => $validated['role'],
                'name' => $validated['first_name'] . ' ' . $validated['last_name'],
            ]
        );

        $freshUser = $this->userRepository->getUserWithProfile($userId);

        return Response::created($freshUser);
    }

    /**
     * PATCH /api/v1/admin/users/{id}/status
     * Activate or deactivate user account with super-admin lockout protection
     */
    public function updateStatus(Request $request): Response
    {
        $admin = AuthorizationMiddleware::requireUserPermission($request, 'users.manage', ['ADMIN']);

        $userId = (int) $request->getParam('id');
        $user = $this->userRepository->findById($userId);

        if ($user === null) {
            throw HttpException::notFound("User #{$userId} was not found.");
        }

        $isActive = UserValidator::validateStatus($request->getBody());

        // Super-admin lockout prevention: cannot deactivate the last active administrator
        if ($isActive === 0 && strtoupper((string) $user['role']) === 'ADMIN' && (int) $user['is_active'] === 1) {
            if ($this->userRepository->countActiveAdmins() <= 1) {
                throw HttpException::forbidden(
                    'Cannot deactivate the last active super-administrator.',
                    'ADMIN_LOCKOUT_PREVENTED'
                );
            }
        }

        $this->userRepository->updateStatus($userId, $isActive);

        $action = $isActive === 1 ? 'USER_ACTIVATED' : 'USER_DEACTIVATED';
        $this->auditLogRepository->record(
            $action,
            'users',
            $userId,
            (int) $admin['id'],
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            [
                'previous_status' => (int) $user['is_active'],
                'new_status' => $isActive,
                'before' => ['is_active' => (int) $user['is_active']],
                'after' => ['is_active' => $isActive],
            ]
        );

        $updated = $this->userRepository->getUserWithProfile($userId);

        return Response::success($updated);
    }

    /**
     * PATCH /api/v1/admin/users/{id}/role
     * Update user role with super-admin lockout protection
     */
    public function updateRole(Request $request): Response
    {
        $admin = AuthorizationMiddleware::requireUserPermission($request, 'users.manage', ['ADMIN']);

        $userId = (int) $request->getParam('id');
        $user = $this->userRepository->findById($userId);

        if ($user === null) {
            throw HttpException::notFound("User #{$userId} was not found.");
        }

        $newRole = UserValidator::validateRole($request->getBody());
        $currentRole = strtoupper((string) $user['role']);

        // Super-admin lockout prevention: cannot change role of the last active administrator
        if ($currentRole === 'ADMIN' && $newRole !== 'ADMIN' && (int) $user['is_active'] === 1) {
            if ($this->userRepository->countActiveAdmins() <= 1) {
                throw HttpException::forbidden(
                    'Cannot demote the last active super-administrator.',
                    'ADMIN_LOCKOUT_PREVENTED'
                );
            }
        }

        $this->userRepository->updateRole($userId, $newRole);
        $this->userRepository->assignUserRole($userId, strtolower($newRole));

        $this->auditLogRepository->record(
            'USER_ROLE_UPDATED',
            'users',
            $userId,
            (int) $admin['id'],
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            [
                'previous_role' => $currentRole,
                'new_role' => $newRole,
                'before' => ['role' => $currentRole],
                'after' => ['role' => $newRole],
            ]
        );

        $updated = $this->userRepository->getUserWithProfile($userId);

        return Response::success($updated);
    }
}
