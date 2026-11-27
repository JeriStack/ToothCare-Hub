<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Repositories\AuditLogRepository;
use App\Repositories\DentistRepository;
use App\Repositories\UserRepository;
use App\Services\AvatarStorageService;
use App\Validators\DentistValidator;

/**
 * Dentist Administration Controller
 * Manages clinical provider accounts, licensing, profile updates, and active rosters.
 */
class DentistController
{
    private DentistRepository $dentistRepository;
    private UserRepository $userRepository;
    private AuditLogRepository $auditLogRepository;
    private Database $database;
    private AvatarStorageService $avatarStorageService;

    public function __construct(
        ?DentistRepository $dentistRepository = null,
        ?UserRepository $userRepository = null,
        ?AuditLogRepository $auditLogRepository = null,
        ?Database $database = null,
        ?string $avatarStorageDir = null,
        ?AvatarStorageService $avatarStorageService = null
    ) {
        $this->database = $database ?? Database::getInstance();
        $this->dentistRepository = $dentistRepository ?? new DentistRepository($this->database);
        $this->userRepository = $userRepository ?? new UserRepository($this->database);
        $this->auditLogRepository = $auditLogRepository ?? new AuditLogRepository($this->database);
        $this->avatarStorageService = $avatarStorageService ?? new AvatarStorageService($avatarStorageDir);
    }

    /**
     * GET /api/v1/admin/dentists
     * Paginated list of dentists with search, specialization filter, and allowlisted sorting
     */
    public function index(Request $request): Response
    {
        $page = max(1, $request->getQueryInt('page', 1));
        $rawPerPage = $request->getQuery('per_page') ?? $request->getQuery('limit') ?? 10;
        $perPage = max(1, min(100, (int) $rawPerPage));
        $sortBy = (string) $request->getQuery('sort_by', 'name');
        $sortDir = (string) $request->getQuery('sort_dir', 'ASC');

        $filters = [
            'search' => $request->getQuery('search'),
            'is_active' => $request->getQuery('is_active'),
            'specialization' => $request->getQuery('specialization'),
        ];

        $result = $this->dentistRepository->list($filters, $sortBy, $sortDir, $page, $perPage);

        return Response::success($result['items'], 200, $result['pagination']);
    }

    /**
     * GET /api/v1/dentists
     * Public/patient active dentists roster for appointment booking
     */
    public function listPublic(Request $request): Response
    {
        $dentists = $this->dentistRepository->listActive();
        return Response::success($dentists);
    }

    /**
     * GET /api/v1/dentists/{id}
     * Public/patient profile for single active dentist
     */
    public function showPublic(Request $request): Response
    {
        $id = (int) $request->getParam('id');
        $dentist = $this->dentistRepository->findById($id);

        if (
            $dentist === null
            || empty($dentist['is_active'])
            || (array_key_exists('user_active', $dentist) && empty($dentist['user_active']))
        ) {
            throw HttpException::notFound("Dentist profile #{$id} was not found or is currently unavailable.");
        }

        return Response::success([
            'id' => (int) $dentist['id'],
            'first_name' => $dentist['first_name'],
            'last_name' => $dentist['last_name'],
            'specialization' => $dentist['specialization'],
            'license_number' => $dentist['license_number'],
            'default_operatory_chair' => $dentist['default_operatory_chair'],
            'bio' => $dentist['bio'],
            'phone' => $dentist['phone'],
            'avatar_url' => $dentist['avatar_url'] ?? null,
            'is_active' => (int) $dentist['is_active'],
        ]);
    }

    /**
     * GET /api/v1/admin/dentists/{id} or GET /api/v1/dentists/{id}
     */
    public function show(Request $request): Response
    {
        $id = (int) $request->getParam('id');
        $dentist = $this->dentistRepository->findById($id);

        if ($dentist === null) {
            throw HttpException::notFound("Dentist profile #{$id} was not found.");
        }

        return Response::success($this->dentistRepository->stripInternalFields($dentist));
    }

    /**
     * GET /api/v1/dentist/profile
     * Retrieve authenticated dentist's own clinical profile.
     */
    public function me(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $dentist = $this->dentistRepository->findByUserId((int) $user['id']);
        if ($dentist === null) {
            throw HttpException::notFound('Dentist profile not found for this account.');
        }

        $dentist['appointment_count'] = $this->dentistRepository->countAppointmentsReferencing((int) $dentist['id']);

        return Response::success($this->dentistRepository->stripInternalFields($dentist));
    }

    /**
     * POST /api/v1/dentist/profile/avatar
     * Upload or replace the authenticated dentist's profile picture (JPEG, PNG, WebP up to 2 MB).
     */
    public function uploadMyAvatar(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $userId = (int) $user['id'];
        $dentist = $this->dentistRepository->findByUserId($userId);
        if ($dentist === null) {
            throw HttpException::notFound('Dentist profile not found for this account.');
        }

        $stored = $this->avatarStorageService->storeUploadedImage($request->getFile('avatar'));
        $filename = $stored['filename'];
        $detectedMime = $stored['mime'];
        $actualSize = $stored['size_bytes'];

        $dentistId = (int) $dentist['id'];
        $oldFilename = !empty($dentist['avatar_path']) ? basename((string) $dentist['avatar_path']) : null;

        try {
            $this->dentistRepository->updateAvatar($dentistId, $filename, $detectedMime);
        } catch (\Throwable $e) {
            $this->avatarStorageService->deleteFile($filename);
            throw $e;
        }

        if ($oldFilename !== null && $oldFilename !== '' && $oldFilename !== $filename) {
            $this->avatarStorageService->deleteFile($oldFilename);
        }

        $fresh = $this->dentistRepository->findById($dentistId) ?? $dentist;
        $fresh['appointment_count'] = $this->dentistRepository->countAppointmentsReferencing($dentistId);

        $this->auditLogRepository->record(
            'DENTIST_AVATAR_UPDATED',
            'dentists',
            $dentistId,
            $userId,
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            ['mime' => $detectedMime, 'size_bytes' => $actualSize]
        );

        return Response::success($this->dentistRepository->stripInternalFields($fresh));
    }

    /**
     * DELETE /api/v1/dentist/profile/avatar
     * Remove the authenticated dentist's profile picture.
     */
    public function deleteMyAvatar(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $userId = (int) $user['id'];
        $dentist = $this->dentistRepository->findByUserId($userId);
        if ($dentist === null) {
            throw HttpException::notFound('Dentist profile not found for this account.');
        }

        $dentistId = (int) $dentist['id'];
        $oldFilename = !empty($dentist['avatar_path']) ? basename((string) $dentist['avatar_path']) : null;

        $this->dentistRepository->clearAvatar($dentistId);
        if ($oldFilename !== null && $oldFilename !== '') {
            $this->avatarStorageService->deleteFile($oldFilename);
        }

        $fresh = $this->dentistRepository->findById($dentistId) ?? $dentist;
        $fresh['appointment_count'] = $this->dentistRepository->countAppointmentsReferencing($dentistId);

        $this->auditLogRepository->record(
            'DENTIST_AVATAR_REMOVED',
            'dentists',
            $dentistId,
            $userId,
            $request->getClientIp(),
            $request->getHeader('user-agent')
        );

        return Response::success($this->dentistRepository->stripInternalFields($fresh));
    }

    /**
     * GET /api/v1/dentist/profile/avatar
     * Serve authenticated dentist's own profile photo securely.
     */
    public function serveMyAvatar(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $dentist = $this->dentistRepository->findByUserId((int) $user['id']);
        if ($dentist === null) {
            throw HttpException::notFound('Dentist profile not found for this account.');
        }

        return $this->avatarStorageService->buildImageResponse(
            $dentist['avatar_path'] ?? null,
            $dentist['avatar_mime'] ?? null
        );
    }

    /**
     * GET /api/v1/dentists/{id}/avatar
     * Serve active dentist profile photo publicly, or restrict inactive portraits to owner/staff.
     */
    public function serveAvatar(Request $request): Response
    {
        $id = (int) $request->getParam('id');
        $dentist = $this->dentistRepository->findById($id);
        if ($dentist === null) {
            throw HttpException::notFound("Dentist profile #{$id} was not found.");
        }

        $isActive = !empty($dentist['is_active']);
        if (!$isActive) {
            $user = $request->getUser();
            $role = strtoupper((string) ($user['role'] ?? ''));
            $isOwner = $user !== null && (int) ($user['id'] ?? 0) === (int) ($dentist['user_id'] ?? 0);
            $isStaff = in_array($role, ['ADMIN', 'RECEPTIONIST'], true);
            if (!$isOwner && !$isStaff) {
                throw HttpException::notFound("Dentist profile #{$id} was not found or is currently unavailable.");
            }
        }

        return $this->avatarStorageService->buildImageResponse(
            $dentist['avatar_path'] ?? null,
            $dentist['avatar_mime'] ?? null,
            $isActive ? 'public, max-age=3600' : 'private, max-age=3600'
        );
    }

    /**
     * PATCH /api/v1/dentist/profile
     * Update authenticated dentist's own profile (excluding admin-managed license & status).
     */
    public function updateMe(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $userId = (int) $user['id'];
        $dentist = $this->dentistRepository->findByUserId($userId);
        if ($dentist === null) {
            throw HttpException::notFound('Dentist profile not found for this account.');
        }

        $dentistId = (int) $dentist['id'];
        $body = $request->getBody();
        unset($body['id'], $body['user_id'], $body['created_at'], $body['is_active'], $body['license_number']);

        $validated = DentistValidator::validateUpdate($body);
        $this->dentistRepository->update($dentistId, $validated);

        $fresh = $this->dentistRepository->findById($dentistId) ?? $dentist;
        if (isset($validated['first_name']) || isset($validated['last_name'])) {
            $this->userRepository->updateName(
                $userId,
                $fresh['first_name'] ?? $validated['first_name'] ?? null,
                $fresh['last_name'] ?? $validated['last_name'] ?? null
            );
        }

        $fresh['appointment_count'] = $this->dentistRepository->countAppointmentsReferencing($dentistId);

        $this->auditLogRepository->record(
            'DENTIST_SELF_PROFILE_UPDATED',
            'dentists',
            $dentistId,
            $userId,
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            ['updated_fields' => array_keys($validated)]
        );

        return Response::success($this->dentistRepository->stripInternalFields($fresh));
    }

    /**
     * POST /api/v1/admin/dentists
     * Create dentist user account and profile atomically
     */
    public function create(Request $request): Response
    {
        $body = $request->getBody();
        $validated = DentistValidator::validateCreate($body);

        // Check duplicate email
        $existingUser = $this->userRepository->findByEmail($validated['email']);
        if ($existingUser !== null) {
            throw HttpException::conflict(
                "An account with email '{$validated['email']}' already exists.",
                'EMAIL_ALREADY_EXISTS',
                ['email' => 'Dentist email address must be unique.']
            );
        }

        // Check duplicate license number
        $existingLicense = $this->dentistRepository->findByLicenseNumber($validated['license_number']);
        if ($existingLicense !== null) {
            throw HttpException::conflict(
                "A dentist with license number '{$validated['license_number']}' already exists.",
                'LICENSE_NUMBER_EXISTS',
                ['license_number' => 'Professional license number must be unique.']
            );
        }

        $passwordHash = password_hash($validated['password'], PASSWORD_DEFAULT);

        $this->database->beginTransaction();
        try {
            // Assign DENTIST role on the server
            $userId = $this->userRepository->create(
                $validated['email'],
                $passwordHash,
                'DENTIST',
                $validated['is_active'],
                1, // Verified upon administrative onboarding
                $validated['first_name'],
                $validated['last_name']
            );

            $dentistData = [
                'user_id' => $userId,
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'license_number' => $validated['license_number'],
                'specialization' => $validated['specialization'],
                'phone' => $validated['phone'],
                'default_operatory_chair' => $validated['default_operatory_chair'],
                'bio' => $validated['bio'],
                'is_active' => $validated['is_active'],
            ];

            $dentistId = $this->dentistRepository->create($dentistData);
            $dentist = $this->dentistRepository->findById($dentistId);

            $adminUser = $request->getUser();
            $this->auditLogRepository->record(
                'DENTIST_ONBOARDED',
                'dentists',
                $dentistId,
                $adminUser ? (int) $adminUser['id'] : null,
                $request->getClientIp(),
                $request->getHeader('user-agent'),
                [
                    'dentist_id' => $dentistId,
                    'user_id' => $userId,
                    'license_number' => $validated['license_number'],
                    'specialization' => $validated['specialization'],
                ]
            );

            $this->database->commit();

            return Response::created($dentist !== null ? $this->dentistRepository->stripInternalFields($dentist) : null);
        } catch (\Throwable $e) {
            $this->database->rollBack();
            if ($e instanceof HttpException) {
                throw $e;
            }
            throw HttpException::internalError('Failed to create dentist account: ' . $e->getMessage());
        }
    }

    /**
     * PUT /api/v1/admin/dentists/{id}
     * Update dentist profile information
     */
    public function update(Request $request): Response
    {
        $id = (int) $request->getParam('id');
        $dentist = $this->dentistRepository->findById($id);

        if ($dentist === null) {
            throw HttpException::notFound("Dentist profile #{$id} was not found.");
        }

        $body = $request->getBody();
        $validated = DentistValidator::validateUpdate($body);

        // Check license uniqueness if being changed
        if (
            isset($validated['license_number']) &&
            strtolower(trim($validated['license_number'])) !== strtolower((string) $dentist['license_number'])
        ) {
            $existingLicense = $this->dentistRepository->findByLicenseNumber($validated['license_number']);
            if ($existingLicense !== null && (int) $existingLicense['id'] !== $id) {
                throw HttpException::conflict(
                    "A dentist with license number '{$validated['license_number']}' already exists.",
                    'LICENSE_NUMBER_EXISTS',
                    ['license_number' => 'Professional license number must be unique.']
                );
            }
        }

        $this->dentistRepository->update($id, $validated);
        $updatedDentist = $this->dentistRepository->findById($id);

        if (isset($validated['first_name']) || isset($validated['last_name'])) {
            $this->userRepository->updateName(
                (int) $dentist['user_id'],
                $updatedDentist['first_name'] ?? $validated['first_name'] ?? null,
                $updatedDentist['last_name'] ?? $validated['last_name'] ?? null
            );
        }

        $adminUser = $request->getUser();
        $this->auditLogRepository->record(
            'DENTIST_PROFILE_UPDATED',
            'dentists',
            $id,
            $adminUser ? (int) $adminUser['id'] : null,
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            ['updated_fields' => array_keys($validated)]
        );

        return Response::success($updatedDentist !== null ? $this->dentistRepository->stripInternalFields($updatedDentist) : null);
    }

    /**
     * PATCH /api/v1/admin/dentists/{id}/status
     * Activate or deactivate dentist profile and user account (preserves historical appointments)
     */
    public function updateStatus(Request $request): Response
    {
        $id = (int) $request->getParam('id');
        $dentist = $this->dentistRepository->findById($id);

        if ($dentist === null) {
            throw HttpException::notFound("Dentist profile #{$id} was not found.");
        }

        $body = $request->getBody();
        $newStatus = DentistValidator::validateStatus($body);

        $this->dentistRepository->updateStatus($id, $newStatus);
        $updatedDentist = $this->dentistRepository->findById($id);

        $adminUser = $request->getUser();
        $action = $newStatus === 1 ? 'DENTIST_ACTIVATED' : 'DENTIST_DEACTIVATED';
        $this->auditLogRepository->record(
            $action,
            'dentists',
            $id,
            $adminUser ? (int) $adminUser['id'] : null,
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            [
                'dentist_id' => $id,
                'is_active' => $newStatus,
                'historical_appointments_preserved' => $this->dentistRepository->countAppointmentsReferencing($id),
            ]
        );

        return Response::success($updatedDentist !== null ? $this->dentistRepository->stripInternalFields($updatedDentist) : null);
    }
}
