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

    public function __construct(
        ?DentistRepository $dentistRepository = null,
        ?UserRepository $userRepository = null,
        ?AuditLogRepository $auditLogRepository = null,
        ?Database $database = null
    ) {
        $this->database = $database ?? Database::getInstance();
        $this->dentistRepository = $dentistRepository ?? new DentistRepository($this->database);
        $this->userRepository = $userRepository ?? new UserRepository($this->database);
        $this->auditLogRepository = $auditLogRepository ?? new AuditLogRepository($this->database);
    }

    /**
     * GET /api/v1/admin/dentists
     * Paginated list of dentists with search, specialization filter, and allowlisted sorting
     */
    public function index(Request $request): Response
    {
        $page = $request->getQueryInt('page', 1);
        $perPage = $request->getQueryInt('per_page', 10);
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
     * GET /api/v1/admin/dentists/{id} or GET /api/v1/dentists/{id}
     */
    public function show(Request $request): Response
    {
        $id = (int) $request->getParam('id');
        $dentist = $this->dentistRepository->findById($id);

        if ($dentist === null) {
            throw HttpException::notFound("Dentist profile #{$id} was not found.");
        }

        return Response::success($dentist);
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
                1 // Verified upon administrative onboarding
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

            return Response::created($dentist);
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

        return Response::success($updatedDentist);
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

        return Response::success($updatedDentist);
    }
}
