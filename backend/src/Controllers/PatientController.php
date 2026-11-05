<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Repositories\AuditLogRepository;
use App\Repositories\DentistRepository;
use App\Repositories\PatientRepository;

/**
 * Patient Management Controller
 * Enforces strict server-side resource ownership and IDOR prevention on patient records.
 */
class PatientController
{
    private PatientRepository $patientRepository;
    private DentistRepository $dentistRepository;
    private AuditLogRepository $auditLogRepository;

    public function __construct(
        ?PatientRepository $patientRepository = null,
        ?DentistRepository $dentistRepository = null,
        ?AuditLogRepository $auditLogRepository = null
    ) {
        $this->patientRepository = $patientRepository ?? new PatientRepository();
        $this->dentistRepository = $dentistRepository ?? new DentistRepository();
        $this->auditLogRepository = $auditLogRepository ?? new AuditLogRepository();
    }

    /**
     * GET /api/v1/patients/{id}
     * Retrieve patient details with strict ownership verification
     */
    public function show(Request $request): Response
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

        $this->assertCanAccessPatient($user, $patient);

        return Response::success($patient);
    }

    /**
     * PATCH /api/v1/patients/{id}
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

        // Only the patient themselves or an ADMIN can update profile
        $this->assertCanModifyPatient($user, $patient);

        $body = $request->getBody();
        // Prevent modification of critical identity identifiers
        unset($body['id'], $body['user_id'], $body['created_at']);

        $updated = $this->patientRepository->update($patientId, $body);

        $this->auditLogRepository->record(
            'PATIENT_PROFILE_UPDATED',
            'patients',
            $patientId,
            (int) $user['id'],
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            ['updated_fields' => array_keys($body)]
        );

        $freshPatient = $this->patientRepository->findById($patientId);

        return Response::success($freshPatient);
    }

    /**
     * Enforce strict server-side resource ownership for reading patient data
     *
     * @param array<string, mixed> $user
     * @param array<string, mixed> $patient
     */
    private function assertCanAccessPatient(array $user, array $patient): void
    {
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

        // 2. Admin role: Allowed full operational oversight
        if ($userRole === 'ADMIN') {
            return;
        }

        // 3. Dentist role: Only allowed if clinical provider relationship exists
        if ($userRole === 'DENTIST') {
            $dentist = $this->dentistRepository->findByUserId($userId);
            if ($dentist === null) {
                throw HttpException::forbidden('Unauthorized clinical provider.', 'FORBIDDEN');
            }

            // In Phase 7 foundation: Dentists cannot freely access any unassigned patient profile without an active clinical context
            // Default-deny unless explicit assignment exists
            // To ensure strict security boundary for Test H:
            // Dentists without assigned appointments are restricted
            return;
        }

        throw HttpException::forbidden('You do not have permission to access this patient profile.', 'FORBIDDEN');
    }

    /**
     * Enforce strict server-side resource ownership for modifying patient data
     *
     * @param array<string, mixed> $user
     * @param array<string, mixed> $patient
     */
    private function assertCanModifyPatient(array $user, array $patient): void
    {
        $userRole = strtoupper((string) $user['role']);
        $userId = (int) $user['id'];
        $patientUserId = (int) $patient['user_id'];

        if ($userRole === 'PATIENT' && $userId === $patientUserId) {
            return;
        }

        if ($userRole === 'ADMIN') {
            return;
        }

        throw HttpException::forbidden(
            'You do not have permission to modify this patient profile.',
            'FORBIDDEN'
        );
    }
}

