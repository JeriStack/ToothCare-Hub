<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthorizationMiddleware;
use App\Repositories\AuditLogRepository;
use App\Repositories\DentistRepository;
use App\Repositories\PatientRepository;
use App\Repositories\UserRepository;
use App\Validators\PatientValidator;

/**
 * Patient Management Controller
 * Enforces strict server-side resource ownership, administrative patient roster oversight,
 * and account status management preserving clinical history.
 */
class PatientController
{
    private const MAX_AVATAR_BYTES = 2097152; // 2 MB
    private const ALLOWED_AVATAR_MIMES = [
        'image/jpeg' => ['ext' => 'jpg', 'type' => IMAGETYPE_JPEG],
        'image/png' => ['ext' => 'png', 'type' => IMAGETYPE_PNG],
        'image/webp' => ['ext' => 'webp', 'type' => IMAGETYPE_WEBP],
    ];

    private PatientRepository $patientRepository;
    private DentistRepository $dentistRepository;
    private UserRepository $userRepository;
    private AuditLogRepository $auditLogRepository;
    private string $avatarStorageDir;

    public function __construct(
        ?PatientRepository $patientRepository = null,
        ?DentistRepository $dentistRepository = null,
        ?UserRepository $userRepository = null,
        ?AuditLogRepository $auditLogRepository = null,
        ?string $avatarStorageDir = null
    ) {
        $this->patientRepository = $patientRepository ?? new PatientRepository();
        $this->dentistRepository = $dentistRepository ?? new DentistRepository();
        $this->userRepository = $userRepository ?? new UserRepository();
        $this->auditLogRepository = $auditLogRepository ?? new AuditLogRepository();
        $this->avatarStorageDir = $avatarStorageDir ?? (dirname(__DIR__, 2) . '/storage/uploads/avatars');
    }

    /**
     * GET /api/v1/admin/patients
     * Administrative paginated patient roster with search and filtering
     */
    public function index(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'patients.view', ['ADMIN', 'RECEPTIONIST']);

        $search = $request->getQuery('search');
        $isActive = $request->getQuery('is_active') ?? $request->getQuery('status');
        $gender = $request->getQuery('gender');
        $sortBy = (string) ($request->getQuery('sort_by') ?? 'created_at');
        $sortDir = (string) ($request->getQuery('sort_dir') ?? 'DESC');
        $page = (int) ($request->getQuery('page') ?? 1);
        $perPage = (int) ($request->getQuery('per_page') ?? 15);

        $filters = [
            'search' => $search,
            'is_active' => $isActive,
            'gender' => $gender,
        ];

        $result = $this->patientRepository->list($filters, $sortBy, $sortDir, $page, $perPage);

        return Response::paginated($result['data'], $result['meta']);
    }

    /**
     * GET /api/v1/patients/me
     * Retrieve authenticated patient's own profile with full identity info.
     */
    public function me(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $userId = (int) $user['id'];
        $patient = $this->patientRepository->findByUserId($userId);
        if ($patient === null) {
            throw HttpException::notFound('Patient profile not found for this account.');
        }

        $fullPatient = $this->patientRepository->findWithUserById((int) $patient['id']) ?? $patient;
        $fullPatient['appointment_count'] = $this->patientRepository->countAppointmentsReferencing((int) $patient['id']);

        return Response::success($this->patientRepository->stripInternalFields($fullPatient));
    }

    /**
     * PATCH /api/v1/patients/me
     * Update authenticated patient's own profile with server-side validation.
     */
    public function updateMe(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $userId = (int) $user['id'];
        $patient = $this->patientRepository->findByUserId($userId);
        if ($patient === null) {
            throw HttpException::notFound('Patient profile not found for this account.');
        }

        $patientId = (int) $patient['id'];
        $body = $request->getBody();
        unset($body['id'], $body['user_id'], $body['created_at']);

        $validated = PatientValidator::validate($body, true);
        $this->patientRepository->update($patientId, $validated);

        $fresh = $this->patientRepository->findWithUserById($patientId) ?? $this->patientRepository->findById($patientId);
        if (isset($validated['first_name']) || isset($validated['last_name'])) {
            $this->userRepository->updateName(
                $userId,
                $fresh['first_name'] ?? $validated['first_name'] ?? null,
                $fresh['last_name'] ?? $validated['last_name'] ?? null
            );
        }

        $this->auditLogRepository->record(
            'PATIENT_SELF_PROFILE_UPDATED',
            'patients',
            $patientId,
            $userId,
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            ['updated_fields' => array_keys($validated)]
        );

        return Response::success($this->patientRepository->stripInternalFields($fresh));
    }

    /**
     * POST /api/v1/patients/me/avatar
     * Upload or replace the authenticated patient's profile picture (JPEG, PNG, WebP up to 2 MB).
     */
    public function uploadMyAvatar(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $userId = (int) $user['id'];
        $patient = $this->patientRepository->findByUserId($userId);
        if ($patient === null) {
            throw HttpException::notFound('Patient profile not found for this account.');
        }

        $file = $request->getFile('avatar');
        if ($file === null || !isset($file['tmp_name'])) {
            throw HttpException::unprocessableEntity(
                'Please select an image file to upload.',
                ['avatar' => ['Please select a JPG, PNG, or WebP image.']]
            );
        }

        $errorCode = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($errorCode === UPLOAD_ERR_INI_SIZE || $errorCode === UPLOAD_ERR_FORM_SIZE) {
            throw HttpException::unprocessableEntity(
                'Profile photo must be 2 MB or smaller.',
                ['avatar' => ['Profile photo must be 2 MB or smaller.']]
            );
        }
        if ($errorCode !== UPLOAD_ERR_OK) {
            throw HttpException::unprocessableEntity(
                'Unable to process uploaded image.',
                ['avatar' => ['Please upload a valid JPG, PNG, or WebP image file.']]
            );
        }

        $tmpPath = (string) $file['tmp_name'];
        $isValidUploadSource = PHP_SAPI === 'cli'
            ? ($tmpPath !== '' && is_file($tmpPath))
            : ($tmpPath !== '' && is_uploaded_file($tmpPath));

        if (!$isValidUploadSource) {
            throw HttpException::unprocessableEntity(
                'Invalid uploaded file.',
                ['avatar' => ['Uploaded file could not be verified.']]
            );
        }

        $actualSize = (int) (filesize($tmpPath) ?: ($file['size'] ?? 0));
        if ($actualSize <= 0 || $actualSize > self::MAX_AVATAR_BYTES) {
            throw HttpException::unprocessableEntity(
                'Profile photo must be between 1 byte and 2 MB.',
                ['avatar' => ['Profile photo must be 2 MB or smaller.']]
            );
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $detectedMime = strtolower((string) $finfo->file($tmpPath));
        if (!isset(self::ALLOWED_AVATAR_MIMES[$detectedMime])) {
            throw HttpException::unprocessableEntity(
                'Unsupported image format. Please use JPG, PNG, or WebP.',
                ['avatar' => ['Only JPG, PNG, and WebP images are supported.']]
            );
        }

        $imageInfo = @getimagesize($tmpPath);
        $expectedType = self::ALLOWED_AVATAR_MIMES[$detectedMime]['type'];
        if ($imageInfo === false || ($imageInfo[0] ?? 0) <= 0 || ($imageInfo[1] ?? 0) <= 0 || ($imageInfo[2] ?? 0) !== $expectedType) {
            throw HttpException::unprocessableEntity(
                'Uploaded file does not appear to be a valid image.',
                ['avatar' => ['The selected file is corrupted or does not match its image type.']]
            );
        }

        if (!is_dir($this->avatarStorageDir) && !mkdir($this->avatarStorageDir, 0755, true) && !is_dir($this->avatarStorageDir)) {
            throw HttpException::internalError('Failed to prepare profile photo storage directory.');
        }

        $extension = self::ALLOWED_AVATAR_MIMES[$detectedMime]['ext'];
        $filename = bin2hex(random_bytes(16)) . '.' . $extension;
        $destination = $this->avatarStorageDir . DIRECTORY_SEPARATOR . $filename;

        $stored = is_uploaded_file($tmpPath)
            ? @move_uploaded_file($tmpPath, $destination)
            : @copy($tmpPath, $destination);

        if (!$stored || !is_file($destination)) {
            throw HttpException::internalError('Failed to store uploaded profile photo.');
        }

        $patientId = (int) $patient['id'];
        $oldFilename = !empty($patient['avatar_path']) ? basename((string) $patient['avatar_path']) : null;

        try {
            $this->patientRepository->updateAvatar($patientId, $filename, $detectedMime);
        } catch (\Throwable $e) {
            @unlink($destination);
            throw $e;
        }

        if ($oldFilename !== null && $oldFilename !== '' && $oldFilename !== $filename) {
            $oldPath = $this->avatarStorageDir . DIRECTORY_SEPARATOR . $oldFilename;
            if (is_file($oldPath)) {
                @unlink($oldPath);
            }
        }

        $fresh = $this->patientRepository->findWithUserById($patientId) ?? $this->patientRepository->findById($patientId);
        if ($fresh !== null) {
            $fresh['appointment_count'] = $this->patientRepository->countAppointmentsReferencing($patientId);
        }

        $this->auditLogRepository->record(
            'PATIENT_AVATAR_UPDATED',
            'patients',
            $patientId,
            $userId,
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            ['mime' => $detectedMime, 'size_bytes' => $actualSize]
        );

        return Response::success($fresh !== null ? $this->patientRepository->stripInternalFields($fresh) : null);
    }

    /**
     * DELETE /api/v1/patients/me/avatar
     * Remove the authenticated patient's profile picture.
     */
    public function deleteMyAvatar(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $userId = (int) $user['id'];
        $patient = $this->patientRepository->findByUserId($userId);
        if ($patient === null) {
            throw HttpException::notFound('Patient profile not found for this account.');
        }

        $patientId = (int) $patient['id'];
        $oldFilename = !empty($patient['avatar_path']) ? basename((string) $patient['avatar_path']) : null;

        $this->patientRepository->clearAvatar($patientId);

        if ($oldFilename !== null && $oldFilename !== '') {
            $oldPath = $this->avatarStorageDir . DIRECTORY_SEPARATOR . $oldFilename;
            if (is_file($oldPath)) {
                @unlink($oldPath);
            }
        }

        $fresh = $this->patientRepository->findWithUserById($patientId) ?? $this->patientRepository->findById($patientId);
        if ($fresh !== null) {
            $fresh['appointment_count'] = $this->patientRepository->countAppointmentsReferencing($patientId);
        }

        $this->auditLogRepository->record(
            'PATIENT_AVATAR_REMOVED',
            'patients',
            $patientId,
            $userId,
            $request->getClientIp(),
            $request->getHeader('user-agent')
        );

        return Response::success($fresh !== null ? $this->patientRepository->stripInternalFields($fresh) : null);
    }

    /**
     * GET /api/v1/patients/me/avatar
     * Serve authenticated patient's own profile photo securely.
     */
    public function serveMyAvatar(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $patient = $this->patientRepository->findByUserId((int) $user['id']);
        if ($patient === null) {
            throw HttpException::notFound('Patient profile not found for this account.');
        }

        return $this->buildAvatarFileResponse($patient);
    }

    /**
     * GET /api/v1/patients/{id}/avatar
     * Serve patient profile photo to the owning patient or authorized clinical/front-desk staff.
     */
    public function serveAvatar(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $patientId = (int) $request->getParam('id');
        $patient = $this->patientRepository->findById($patientId);
        if ($patient === null) {
            throw HttpException::notFound("Patient record #{$patientId} was not found.");
        }

        $this->assertCanAccessPatient($request, $patient);

        return $this->buildAvatarFileResponse($patient);
    }

    /**
     * @param array<string, mixed> $patient
     */
    private function buildAvatarFileResponse(array $patient): Response
    {
        $filename = !empty($patient['avatar_path']) ? basename((string) $patient['avatar_path']) : '';
        if ($filename === '') {
            throw HttpException::notFound('Profile photo not found.');
        }

        $filePath = $this->avatarStorageDir . DIRECTORY_SEPARATOR . $filename;
        if (!is_file($filePath)) {
            throw HttpException::notFound('Profile photo not found.');
        }

        $bytes = @file_get_contents($filePath);
        if ($bytes === false) {
            throw HttpException::internalError('Failed to read profile photo.');
        }

        $mime = strtolower((string) ($patient['avatar_mime'] ?? ''));
        if (!isset(self::ALLOWED_AVATAR_MIMES[$mime])) {
            $mime = 'application/octet-stream';
        }

        return Response::raw($bytes, 200, [
            'Content-Type' => $mime,
            'Content-Length' => (string) strlen($bytes),
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=3600',
            'Content-Disposition' => 'inline',
        ]);
    }

    /**
     * GET /api/v1/patients/{id} or /api/v1/admin/patients/{id}
     * Retrieve patient details with strict ownership verification
     */
    public function show(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $patientId = (int) $request->getParam('id');
        $patient = $this->patientRepository->findWithUserById($patientId)
            ?? $this->patientRepository->findById($patientId);

        if ($patient === null) {
            throw HttpException::notFound("Patient record #{$patientId} was not found.");
        }

        $this->assertCanAccessPatient($request, $patient);

        // Include appointment count for administrative context
        $patient['appointment_count'] = $this->patientRepository->countAppointmentsReferencing($patientId);

        return Response::success($this->patientRepository->stripInternalFields($patient));
    }

    /**
     * PATCH /api/v1/patients/{id} or PUT /api/v1/admin/patients/{id}
     * Update patient profile with strict ownership verification
     */
    public function update(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $patientId = (int) $request->getParam('id');
        $patient = $this->patientRepository->findById($patientId);

        if ($patient === null) {
            throw HttpException::notFound("Patient record #{$patientId} was not found.");
        }

        $this->assertCanModifyPatient($request, $patient);

        $body = $request->getBody();
        // Prevent modification of identity IDs
        unset($body['id'], $body['user_id'], $body['created_at']);

        $validated = PatientValidator::validate($body, true);

        $this->patientRepository->update($patientId, $validated);

        $freshPatient = $this->patientRepository->findWithUserById($patientId)
            ?? $this->patientRepository->findById($patientId);

        if ((isset($validated['first_name']) || isset($validated['last_name'])) && !empty($patient['user_id'])) {
            $this->userRepository->updateName(
                (int) $patient['user_id'],
                $freshPatient['first_name'] ?? $validated['first_name'] ?? null,
                $freshPatient['last_name'] ?? $validated['last_name'] ?? null
            );
        }

        $this->auditLogRepository->record(
            'PATIENT_PROFILE_UPDATED',
            'patients',
            $patientId,
            (int) $user['id'],
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            ['updated_fields' => array_keys($validated)]
        );

        return Response::success($freshPatient);
    }

    /**
     * PATCH /api/v1/admin/patients/{id}/status
     * Activate or deactivate patient account, preserving clinical history.
     */
    public function updateStatus(Request $request): Response
    {
        $user = AuthorizationMiddleware::requireUserPermission($request, 'users.manage', ['ADMIN']);

        $patientId = (int) $request->getParam('id');
        $patient = $this->patientRepository->findWithUserById($patientId)
            ?? $this->patientRepository->findById($patientId);

        if ($patient === null) {
            throw HttpException::notFound("Patient record #{$patientId} was not found.");
        }

        $body = $request->getBody();
        $isActive = PatientValidator::validateStatus($body);

        $this->userRepository->updateStatus((int) $patient['user_id'], $isActive);

        $action = $isActive === 1 ? 'PATIENT_ACTIVATED' : 'PATIENT_DEACTIVATED';
        $this->auditLogRepository->record(
            $action,
            'patients',
            $patientId,
            (int) $user['id'],
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            [
                'user_id' => (int) $patient['user_id'],
                'is_active' => $isActive,
                'historical_appointments_preserved' => true,
            ]
        );

        $freshPatient = $this->patientRepository->findWithUserById($patientId);

        return Response::success($freshPatient !== null ? $this->patientRepository->stripInternalFields($freshPatient) : null);
    }

    /**
     * Enforce strict server-side resource ownership for reading patient data
     *
     * @param array<string, mixed> $patient
     */
    private function assertCanAccessPatient(Request $request, array $patient): void
    {
        $user = $request->getUser();
        if ($user === null) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $userRole = strtoupper((string) $user['role']);
        $userId = (int) $user['id'];
        $patientUserId = (int) $patient['user_id'];

        // 1. Patient role: MUST own the record
        if ($userRole === 'PATIENT') {
            if ($userId !== $patientUserId) {
                throw HttpException::forbidden(
                    'You do not have permission to access another patient\'s private records.',
                    'FORBIDDEN'
                );
            }
            return;
        }

        // 2. Staff & clinical roles: Governed by DRBAC permission (`patients.view`)
        AuthorizationMiddleware::requireUserPermission($request, 'patients.view', ['ADMIN', 'RECEPTIONIST', 'DENTIST']);

        if ($userRole === 'DENTIST') {
            $dentist = $this->dentistRepository->findByUserId($userId);
            if ($dentist === null) {
                throw HttpException::forbidden('Unauthorized clinical provider.', 'FORBIDDEN');
            }
        }
    }

    /**
     * Enforce strict server-side resource ownership for modifying patient data
     *
     * @param array<string, mixed> $patient
     */
    private function assertCanModifyPatient(Request $request, array $patient): void
    {
        $user = $request->getUser();
        if ($user === null) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $userRole = strtoupper((string) $user['role']);
        $userId = (int) $user['id'];
        $patientUserId = (int) $patient['user_id'];

        if ($userRole === 'PATIENT') {
            if ($userId !== $patientUserId) {
                throw HttpException::forbidden(
                    'You do not have permission to modify this patient profile.',
                    'FORBIDDEN'
                );
            }
            return;
        }

        AuthorizationMiddleware::requireUserPermission($request, 'patients.manage', ['ADMIN', 'RECEPTIONIST']);
    }
}
