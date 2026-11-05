<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Repositories\AuditLogRepository;
use App\Repositories\ServiceRepository;
use App\Validators\ServiceValidator;

/**
 * Dental Service Controller
 * Provides administrative CRUD, status toggling, and public procedure catalog access.
 */
class ServiceController
{
    private ServiceRepository $serviceRepository;
    private AuditLogRepository $auditLogRepository;

    public function __construct(
        ?ServiceRepository $serviceRepository = null,
        ?AuditLogRepository $auditLogRepository = null
    ) {
        $this->serviceRepository = $serviceRepository ?? new ServiceRepository();
        $this->auditLogRepository = $auditLogRepository ?? new AuditLogRepository();
    }

    /**
     * GET /api/v1/admin/services
     * Administrative paginated list with search, filter, and sorting
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
            'category' => $request->getQuery('category'),
        ];

        $result = $this->serviceRepository->list($filters, $sortBy, $sortDir, $page, $perPage);

        return Response::success($result['items'], 200, $result['pagination']);
    }

    /**
     * GET /api/v1/services
     * Public/patient active services list for appointment booking
     */
    public function listPublic(Request $request): Response
    {
        $services = $this->serviceRepository->listActive();
        return Response::success($services);
    }

    /**
     * GET /api/v1/admin/services/{id} or GET /api/v1/services/{id}
     */
    public function show(Request $request): Response
    {
        $id = (int) $request->getParam('id');
        $service = $this->serviceRepository->findById($id);

        if ($service === null) {
            throw HttpException::notFound("Dental service #{$id} was not found.");
        }

        return Response::success($service);
    }

    /**
     * POST /api/v1/admin/services
     * Create a new dental service
     */
    public function create(Request $request): Response
    {
        $body = $request->getBody();
        $validated = ServiceValidator::validate($body, false);

        // Enforce uniqueness on name
        $existing = $this->serviceRepository->findByName($validated['name']);
        if ($existing !== null) {
            throw HttpException::conflict(
                "A dental service named '{$validated['name']}' already exists.",
                'SERVICE_NAME_EXISTS',
                ['name' => 'Service name must be unique.']
            );
        }

        $serviceId = $this->serviceRepository->create($validated);
        $service = $this->serviceRepository->findById($serviceId);

        $user = $request->getUser();
        $this->auditLogRepository->record(
            'SERVICE_CREATED',
            'services',
            $serviceId,
            $user ? (int) $user['id'] : null,
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            ['name' => $validated['name'], 'price' => $validated['price']]
        );

        return Response::created($service);
    }

    /**
     * PUT /api/v1/admin/services/{id}
     * Update dental service information
     */
    public function update(Request $request): Response
    {
        $id = (int) $request->getParam('id');
        $service = $this->serviceRepository->findById($id);

        if ($service === null) {
            throw HttpException::notFound("Dental service #{$id} was not found.");
        }

        $body = $request->getBody();
        $validated = ServiceValidator::validate($body, true);

        // Check uniqueness if name is changing
        if (isset($validated['name']) && strtolower(trim($validated['name'])) !== strtolower((string) $service['name'])) {
            $existing = $this->serviceRepository->findByName($validated['name']);
            if ($existing !== null && (int) $existing['id'] !== $id) {
                throw HttpException::conflict(
                    "A dental service named '{$validated['name']}' already exists.",
                    'SERVICE_NAME_EXISTS',
                    ['name' => 'Service name must be unique.']
                );
            }
        }

        $this->serviceRepository->update($id, $validated);
        $updatedService = $this->serviceRepository->findById($id);

        $user = $request->getUser();
        $this->auditLogRepository->record(
            'SERVICE_UPDATED',
            'services',
            $id,
            $user ? (int) $user['id'] : null,
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            ['updated_fields' => array_keys($validated)]
        );

        return Response::success($updatedService);
    }

    /**
     * PATCH /api/v1/admin/services/{id}/status
     * Activate or deactivate a dental service (never deletes historical appointments)
     */
    public function updateStatus(Request $request): Response
    {
        $id = (int) $request->getParam('id');
        $service = $this->serviceRepository->findById($id);

        if ($service === null) {
            throw HttpException::notFound("Dental service #{$id} was not found.");
        }

        $body = $request->getBody();
        $newStatus = ServiceValidator::validateStatus($body);

        $this->serviceRepository->updateStatus($id, $newStatus);
        $updatedService = $this->serviceRepository->findById($id);

        $user = $request->getUser();
        $action = $newStatus === 1 ? 'SERVICE_ACTIVATED' : 'SERVICE_DEACTIVATED';
        $this->auditLogRepository->record(
            $action,
            'services',
            $id,
            $user ? (int) $user['id'] : null,
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            [
                'name' => $service['name'],
                'is_active' => $newStatus,
                'historical_appointments_preserved' => $this->serviceRepository->countAppointmentsReferencing($id),
            ]
        );

        return Response::success($updatedService);
    }
}
