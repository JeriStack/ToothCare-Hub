<?php

declare(strict_types=1);

namespace App\OpenApi\Paths;

use OpenApi\Attributes as OA;

/**
 * OpenAPI 3.0.3 Path Definitions: Health, Authentication, Users, and DRBAC Roles/Permissions.
 */
final class AuthAndUsersPaths
{
    #[OA\Get(
        path: '/health',
        operationId: 'getHealth',
        summary: 'API Health & Readiness Check',
        tags: ['Health'],
        parameters: [new OA\Parameter(name: 'check', in: 'query', schema: new OA\Schema(type: 'string', enum: ['ready']))],
        responses: [
            new OA\Response(response: 200, description: 'Service is healthy'),
            new OA\Response(response: 503, description: 'Database dependency degraded'),
        ]
    )]
    public function health(): void {}

    #[OA\Get(
        path: '/metrics',
        operationId: 'getPrometheusMetrics',
        summary: 'Prometheus Metrics Exposition',
        tags: ['Health'],
        responses: [new OA\Response(response: 200, description: 'Prometheus text metrics')]
    )]
    public function metrics(): void {}

    #[OA\Get(
        path: '/auth/csrf-token',
        operationId: 'getCsrfToken',
        summary: 'Retrieve Synchronizer CSRF Token',
        tags: ['Authentication'],
        responses: [new OA\Response(response: 200, description: 'CSRF token issued for current session')]
    )]
    public function csrfToken(): void {}

    #[OA\Post(
        path: '/auth/register',
        operationId: 'registerPatient',
        summary: 'Register Patient Account',
        description: 'Creates a new PATIENT account (role escalation attempts are ignored server-side) and queues an email verification message.',
        tags: ['Authentication'],
        security: [['CsrfToken' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['first_name', 'last_name', 'email', 'password', 'password_confirmation', 'phone', 'date_of_birth'],
                properties: [
                    new OA\Property(property: 'first_name', type: 'string', example: 'Ana'),
                    new OA\Property(property: 'last_name', type: 'string', example: 'Reyes'),
                    new OA\Property(property: 'email', type: 'string', format: 'email', example: 'ana.reyes@example.com'),
                    new OA\Property(property: 'password', type: 'string', format: 'password', minLength: 8),
                    new OA\Property(property: 'password_confirmation', type: 'string', format: 'password'),
                    new OA\Property(property: 'phone', type: 'string', example: '09171234567'),
                    new OA\Property(property: 'date_of_birth', type: 'string', format: 'date', example: '1993-04-12'),
                    new OA\Property(property: 'gender', type: 'string', enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Patient registered'),
            new OA\Response(response: 409, description: 'Email already exists'),
            new OA\Response(response: 422, description: 'Validation error'),
            new OA\Response(response: 429, description: 'Rate limit exceeded'),
        ]
    )]
    public function register(): void {}

    #[OA\Post(
        path: '/auth/login',
        operationId: 'loginUser',
        summary: 'Authenticate User & Create Session Cookie',
        tags: ['Authentication'],
        security: [['CsrfToken' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['email', 'password'],
                properties: [
                    new OA\Property(property: 'email', type: 'string', format: 'email', example: 'patient.demo@example.com'),
                    new OA\Property(property: 'password', type: 'string', format: 'password'),
                    new OA\Property(property: 'remember_me', type: 'boolean', example: false),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Authenticated; session cookie issued'),
            new OA\Response(response: 401, description: 'Invalid credentials'),
            new OA\Response(response: 403, description: 'Account suspended or email unverified'),
            new OA\Response(response: 429, description: 'Login rate limited'),
        ]
    )]
    public function login(): void {}

    #[OA\Post(
        path: '/auth/logout',
        operationId: 'logoutUser',
        summary: 'Invalidate Session & Revoke Real-Time Connections',
        tags: ['Authentication'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Logged out cleanly'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
        ]
    )]
    public function logout(): void {}

    #[OA\Post(
        path: '/auth/verify-email',
        operationId: 'verifyEmail',
        summary: 'Verify Account Email Using Single-Use Token',
        tags: ['Authentication'],
        security: [['CsrfToken' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Email verified'),
            new OA\Response(response: 400, description: 'Invalid or expired token'),
        ]
    )]
    public function verifyEmail(): void {}

    #[OA\Post(
        path: '/auth/resend-verification',
        operationId: 'resendVerificationEmail',
        summary: 'Resend Verification Email',
        tags: ['Authentication'],
        security: [['CsrfToken' => []]],
        responses: [new OA\Response(response: 200, description: 'Verification email queued if account exists')]
    )]
    public function resendVerification(): void {}

    #[OA\Post(
        path: '/auth/forgot-password',
        operationId: 'forgotPassword',
        summary: 'Request Password Reset Link',
        tags: ['Authentication'],
        security: [['CsrfToken' => []]],
        responses: [new OA\Response(response: 200, description: 'Reset link queued if account exists')]
    )]
    #[OA\Post(
        path: '/auth/password/forgot',
        operationId: 'forgotPasswordAlias',
        summary: 'Request Password Reset Link (Alias)',
        tags: ['Authentication'],
        security: [['CsrfToken' => []]],
        responses: [new OA\Response(response: 200, description: 'Reset link queued if account exists')]
    )]
    public function forgotPassword(): void {}

    #[OA\Post(
        path: '/auth/reset-password',
        operationId: 'resetPassword',
        summary: 'Reset Password Using Single-Use Token',
        tags: ['Authentication'],
        security: [['CsrfToken' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Password reset succeeded'),
            new OA\Response(response: 400, description: 'Invalid or expired token'),
            new OA\Response(response: 422, description: 'Password policy validation failed'),
        ]
    )]
    #[OA\Post(
        path: '/auth/password/reset',
        operationId: 'resetPasswordAlias',
        summary: 'Reset Password (Alias)',
        tags: ['Authentication'],
        security: [['CsrfToken' => []]],
        responses: [new OA\Response(response: 200, description: 'Password reset succeeded')]
    )]
    public function resetPassword(): void {}

    #[OA\Get(
        path: '/auth/me',
        operationId: 'getCurrentUser',
        summary: 'Get Authenticated User Identity & Permissions',
        tags: ['Authentication'],
        security: [['CookieAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Current user identity'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
        ]
    )]
    #[OA\Patch(
        path: '/auth/me',
        operationId: 'updateCurrentUser',
        summary: 'Update Authenticated User Profile',
        tags: ['Users'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        responses: [new OA\Response(response: 200, description: 'Profile updated')]
    )]
    public function authMe(): void {}

    #[OA\Get(path: '/auth/me/avatar', operationId: 'getMyAuthAvatar', summary: 'Serve Authenticated User Avatar', tags: ['Users'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Image binary')])]
    #[OA\Post(path: '/auth/me/avatar', operationId: 'uploadMyAuthAvatar', summary: 'Upload Authenticated User Avatar', tags: ['Users'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 200, description: 'Avatar uploaded')])]
    #[OA\Delete(path: '/auth/me/avatar', operationId: 'deleteMyAuthAvatar', summary: 'Remove Authenticated User Avatar', tags: ['Users'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 200, description: 'Avatar removed')])]
    public function authMeAvatar(): void {}

    #[OA\Get(path: '/user/profile', operationId: 'getUserProfile', summary: 'Get Staff/User Self-Service Profile', tags: ['Users'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Profile retrieved')])]
    #[OA\Patch(path: '/user/profile', operationId: 'updateUserProfile', summary: 'Update Staff/User Self-Service Profile', tags: ['Users'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 200, description: 'Profile updated')])]
    public function userProfile(): void {}

    #[OA\Get(path: '/user/profile/avatar', operationId: 'getUserProfileAvatar', summary: 'Serve Self-Service User Avatar', tags: ['Users'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Image binary')])]
    #[OA\Post(path: '/user/profile/avatar', operationId: 'uploadUserProfileAvatar', summary: 'Upload Self-Service User Avatar', tags: ['Users'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 200, description: 'Avatar uploaded')])]
    #[OA\Delete(path: '/user/profile/avatar', operationId: 'deleteUserProfileAvatar', summary: 'Delete Self-Service User Avatar', tags: ['Users'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 200, description: 'Avatar removed')])]
    public function userProfileAvatar(): void {}

    #[OA\Get(
        path: '/users/{id}/avatar',
        operationId: 'getUserAvatarById',
        summary: 'Serve User Avatar by ID (Owner or Clinical/Admin Staff)',
        tags: ['Users'],
        security: [['CookieAuth' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Image binary (private cache)'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden — cross-user avatar access denied'),
            new OA\Response(response: 404, description: 'Avatar not found'),
        ]
    )]
    public function userAvatarById(): void {}

    #[OA\Get(
        path: '/admin/users',
        operationId: 'listAdminUsers',
        summary: 'List All User Accounts (Admin, Paginated)',
        tags: ['Users'],
        security: [['CookieAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, default: 1)),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 100, default: 15)),
            new OA\Parameter(name: 'limit', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 100)),
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'role', in: 'query', schema: new OA\Schema(type: 'string')),
        ],
        responses: [new OA\Response(response: 200, description: 'Paginated user list'), new OA\Response(response: 403, description: 'Requires users.view')]
    )]
    #[OA\Post(
        path: '/admin/users',
        operationId: 'createAdminUser',
        summary: 'Create Staff/User Account (Admin)',
        tags: ['Users'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        responses: [new OA\Response(response: 201, description: 'User created'), new OA\Response(response: 403, description: 'Requires users.manage')]
    )]
    public function adminUsers(): void {}

    #[OA\Get(
        path: '/admin/users/{id}',
        operationId: 'getAdminUser',
        summary: 'Get Single User Account Details (Admin)',
        tags: ['Users'],
        security: [['CookieAuth' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'User details'), new OA\Response(response: 404, description: 'Not found')]
    )]
    public function adminUserById(): void {}

    #[OA\Patch(
        path: '/admin/users/{id}/status',
        operationId: 'updateAdminUserStatus',
        summary: 'Activate or Deactivate User Account (Admin)',
        tags: ['Users'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'User status updated'), new OA\Response(response: 403, description: 'Requires users.manage')]
    )]
    public function adminUserStatus(): void {}

    #[OA\Patch(
        path: '/admin/users/{id}/role',
        operationId: 'updateAdminUserRole',
        summary: 'Update User Role Assignment (Admin)',
        tags: ['Users'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'User role updated'), new OA\Response(response: 403, description: 'Requires users.manage')]
    )]
    public function adminUserRole(): void {}

    #[OA\Get(path: '/admin/roles', operationId: 'listRoles', summary: 'List DRBAC Roles and Attached Permissions (Admin)', tags: ['RBAC'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Roles list')])]
    public function adminRoles(): void {}

    #[OA\Get(path: '/admin/permissions', operationId: 'listPermissions', summary: 'List All DRBAC Permissions (Admin)', tags: ['RBAC'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Permissions catalog')])]
    public function adminPermissions(): void {}

    #[OA\Put(
        path: '/admin/roles/{id}/permissions',
        operationId: 'syncRolePermissions',
        summary: 'Synchronize Role Permission Matrix (Admin)',
        tags: ['RBAC'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Permissions updated')]
    )]
    public function adminRolePermissions(): void {}
}
