<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Repositories\AuditLogRepository;
use App\Repositories\ClinicScheduleRepository;
use App\Validators\ScheduleValidator;

/**
 * Clinic Facility Schedule Controller
 * Manages weekly facility hours, operating shifts, and clinic-wide holiday/maintenance closures.
 */
class ClinicScheduleController
{
    private ClinicScheduleRepository $clinicRepo;
    private AuditLogRepository $auditLogRepo;
    private Database $database;

    public function __construct(
        ?ClinicScheduleRepository $clinicRepo = null,
        ?AuditLogRepository $auditLogRepo = null,
        ?Database $database = null
    ) {
        $this->database = $database ?? Database::getInstance();
        $this->clinicRepo = $clinicRepo ?? new ClinicScheduleRepository($this->database);
        $this->auditLogRepo = $auditLogRepo ?? new AuditLogRepository($this->database);
    }

    /**
     * GET /api/v1/clinic/hours
     * Public or authenticated retrieval of facility operating hours.
     */
    public function getHours(Request $request): Response
    {
        $hours = $this->clinicRepo->getOperatingHours();
        return Response::success($hours);
    }

    /**
     * PUT /api/v1/admin/clinic/hours
     * Administrative configuration of weekly operating hours.
     * Supports either a single day update or bulk 7-day array.
     */
    public function updateHours(Request $request): Response
    {
        $body = $request->getBody();
        $adminUser = $request->getUser();

        // Support bulk update if 'hours' array provided
        if (isset($body['hours']) && is_array($body['hours'])) {
            foreach ($body['hours'] as $dayData) {
                if (!is_array($dayData)) {
                    continue;
                }
                $validated = ScheduleValidator::validateClinicOperatingHours($dayData);
                $this->clinicRepo->setOperatingHours(
                    $validated['day_of_week'],
                    $validated['opening_time'],
                    $validated['closing_time'],
                    $validated['is_closed']
                );
            }
        } else {
            $validated = ScheduleValidator::validateClinicOperatingHours($body);
            $this->clinicRepo->setOperatingHours(
                $validated['day_of_week'],
                $validated['opening_time'],
                $validated['closing_time'],
                $validated['is_closed']
            );
        }

        $this->auditLogRepo->record(
            'CLINIC_OPERATING_HOURS_UPDATED',
            'clinic_operating_hours',
            null,
            $adminUser ? (int) $adminUser['id'] : null,
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            ['payload' => $body]
        );

        $hours = $this->clinicRepo->getOperatingHours();
        return Response::success($hours, 200);
    }

    /**
     * GET /api/v1/clinic/closures
     * List scheduled facility closures (holidays, renovations, emergency).
     */
    public function getClosures(Request $request): Response
    {
        $startDate = $request->getQuery('start_date');
        $endDate = $request->getQuery('end_date');

        $closures = $this->clinicRepo->getClosures($startDate, $endDate);
        return Response::success($closures);
    }

    /**
     * POST /api/v1/admin/clinic/closures
     * Schedule a new clinic closure window.
     */
    public function storeClosure(Request $request): Response
    {
        $validated = ScheduleValidator::validateClinicClosure($request->getBody());
        $adminUser = $request->getUser();

        $validated['created_by_user_id'] = $adminUser ? (int) $adminUser['id'] : null;

        $id = $this->clinicRepo->createClosure($validated);
        $closure = $this->clinicRepo->findClosureById($id);

        $this->auditLogRepo->record(
            'CLINIC_CLOSURE_CREATED',
            'clinic_closures',
            $id,
            $adminUser ? (int) $adminUser['id'] : null,
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            [
                'title' => $validated['title'],
                'start_at' => $validated['start_at'],
                'end_at' => $validated['end_at'],
                'closure_type' => $validated['closure_type'],
            ]
        );

        return Response::created($closure);
    }

    /**
     * DELETE /api/v1/admin/clinic/closures/{id}
     * Remove a scheduled clinic closure.
     */
    public function destroyClosure(Request $request): Response
    {
        $id = (int) $request->getParam('id');
        $closure = $this->clinicRepo->findClosureById($id);

        if (!$closure) {
            throw HttpException::notFound('Clinic closure not found.');
        }

        $this->clinicRepo->deleteClosure($id);

        $adminUser = $request->getUser();
        $this->auditLogRepo->record(
            'CLINIC_CLOSURE_DELETED',
            'clinic_closures',
            $id,
            $adminUser ? (int) $adminUser['id'] : null,
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            ['closure_id' => $id, 'title' => $closure['title']]
        );

        return Response::success(null);
    }
}
