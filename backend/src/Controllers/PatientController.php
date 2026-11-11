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
    private PatientRepository $patientRepository;
    private DentistRepository $dentistRepository;
    private UserRepository $userRepository;
    private AuditLogRepository $auditLogRepository;

    public function __construct(
        ?PatientRepository $patientRepository = null,
        ?DentistRepository $dentistRepository = null,
        ?UserRepository $userRepository = null,
        ?AuditLogRepository $auditLogRepository = null
    ) {
        $this->patientRepository = $patientRepository ?? new PatientRepository();
        $this->dentistRepository = $dentistRepository ?? new DentistRepository();
        $this->userRepository = $userRepository ?? new UserRepository();
        $this->auditLogRepository = $auditLogRepository ?? new AuditLogRepository();
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

        return Response::success($fullPatient);
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

        $this->auditLogRepository->record(
            'PATIENT_SELF_PROFILE_UPDATED',
            'patients',
            $patientId,
            $userId,
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            ['updated_fields' => array_keys($validated)]
        );

        $fresh = $this->patientRepository->findWithUserById($patientId) ?? $this->patientRepository->findById($patientId);
        return Response::success($fresh);
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

        return Response::success($patient);
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

        $this->auditLogRepository->record(
            'PATIENT_PROFILE_UPDATED',
            'patients',
            $patientId,
            (int) $user['id'],
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            ['updated_fields' => array_keys($validated)]
        );

        $freshPatient = $this->patientRepository->findWithUserById($patientId)
            ?? $this->patientRepository->findById($patientId);

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

        return Response::success($freshPatient);
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
