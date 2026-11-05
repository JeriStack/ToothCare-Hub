<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Repositories\AuditLogRepository;
use App\Repositories\DentistRepository;
use App\Repositories\DentistScheduleRepository;
use App\Validators\ScheduleValidator;

/**
 * Dentist Weekly Schedule Administration Controller
 * Manages weekly recurring working shifts, operatory chair allocations, and shift conflict validations.
 */
class DentistScheduleController
{
    private DentistScheduleRepository $scheduleRepo;
    private DentistRepository $dentistRepo;
    private AuditLogRepository $auditLogRepo;
    private Database $database;

    public function __construct(
        ?DentistScheduleRepository $scheduleRepo = null,
        ?DentistRepository $dentistRepo = null,
        ?AuditLogRepository $auditLogRepo = null,
        ?Database $database = null
    ) {
        $this->database = $database ?? Database::getInstance();
        $this->scheduleRepo = $scheduleRepo ?? new DentistScheduleRepository($this->database);
        $this->dentistRepo = $dentistRepo ?? new DentistRepository($this->database);
        $this->auditLogRepo = $auditLogRepo ?? new AuditLogRepository($this->database);
    }

    /**
     * GET /api/v1/dentists/{id}/schedules
     * GET /api/v1/admin/dentists/{id}/schedules
     * List all weekly recurring shifts for a specific dentist.
     */
    public function index(Request $request): Response
    {
        $dentistId = (int) $request->getParam('id');
        $dentist = $this->dentistRepo->findById($dentistId);
        if (!$dentist) {
            throw HttpException::notFound('Dentist profile not found.');
        }

        $activeOnly = (bool) $request->getQuery('active_only', false);
        $schedules = $this->scheduleRepo->findByDentistId($dentistId, $activeOnly);

        return Response::success([
            'dentist' => [
                'id' => (int) $dentist['id'],
                'name' => 'Dr. ' . $dentist['first_name'] . ' ' . $dentist['last_name'],
                'specialization' => $dentist['specialization'],
            ],
            'schedules' => $schedules,
        ]);
    }

    /**
     * POST /api/v1/admin/dentists/{id}/schedules
     * Create a new recurring weekly shift for a dentist.
     */
    public function store(Request $request): Response
    {
        $dentistId = (int) $request->getParam('id');
        $dentist = $this->dentistRepo->findById($dentistId);
        if (!$dentist) {
            throw HttpException::notFound('Dentist profile not found.');
        }

        $validated = ScheduleValidator::validateWeeklySchedule($request->getBody());
        $validated['dentist_id'] = $dentistId;

        // Check if shift fits within clinic facility hours
        if (!$this->scheduleRepo->fitsClinicHours($validated['day_of_week'], $validated['start_time'], $validated['end_time'])) {
            throw HttpException::unprocessableEntity(
                'Shift must fall within clinic operating hours for that day and clinic must be open.'
            );
        }

        // Check for shift collision on same day for this dentist
        if ($this->scheduleRepo->hasOverlap($dentistId, $validated['day_of_week'], $validated['start_time'], $validated['end_time'])) {
            throw HttpException::conflict('Shift overlaps with an existing active schedule for this dentist.');
        }

        $id = $this->scheduleRepo->create($validated);
        $schedule = $this->scheduleRepo->findById($id);

        $adminUser = $request->getUser();
        $this->auditLogRepo->record(
            'DENTIST_SCHEDULE_CREATED',
            'dentist_schedules',
            $id,
            $adminUser ? (int) $adminUser['id'] : null,
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            [
                'dentist_id' => $dentistId,
                'day_of_week' => $validated['day_of_week'],
                'start_time' => $validated['start_time'],
                'end_time' => $validated['end_time'],
            ]
        );

        return Response::created($schedule);
    }

    /**
     * PUT /api/v1/admin/dentists/{id}/schedules/{scheduleId}
     * Update an existing recurring weekly shift.
     */
    public function update(Request $request): Response
    {
        $dentistId = (int) $request->getParam('id');
        $scheduleId = (int) ($request->getParam('scheduleId') ?? $request->getParam('schedule_id'));

        $schedule = $this->scheduleRepo->findById($scheduleId);
        if (!$schedule || (int) $schedule['dentist_id'] !== $dentistId) {
            throw HttpException::notFound('Dentist schedule shift not found.');
        }

        $validated = ScheduleValidator::validateWeeklySchedule($request->getBody());

        // Check clinic hours fit
        if (!$this->scheduleRepo->fitsClinicHours($validated['day_of_week'], $validated['start_time'], $validated['end_time'])) {
            throw HttpException::unprocessableEntity(
                'Shift must fall within clinic operating hours for that day and clinic must be open.'
            );
        }

        // Check shift collision, excluding current shift
        if ($this->scheduleRepo->hasOverlap($dentistId, $validated['day_of_week'], $validated['start_time'], $validated['end_time'], $scheduleId)) {
            throw HttpException::conflict('Updated shift overlaps with another existing schedule for this dentist.');
        }

        $this->scheduleRepo->update($scheduleId, $validated);
        $updated = $this->scheduleRepo->findById($scheduleId);

        $adminUser = $request->getUser();
        $this->auditLogRepo->record(
            'DENTIST_SCHEDULE_UPDATED',
            'dentist_schedules',
            $scheduleId,
            $adminUser ? (int) $adminUser['id'] : null,
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            [
                'dentist_id' => $dentistId,
                'schedule_id' => $scheduleId,
                'day_of_week' => $validated['day_of_week'],
            ]
        );

        return Response::success($updated);
    }

    /**
     * DELETE /api/v1/admin/dentists/{id}/schedules/{scheduleId}
     * Remove a recurring weekly shift.
     */
    public function destroy(Request $request): Response
    {
        $dentistId = (int) $request->getParam('id');
        $scheduleId = (int) ($request->getParam('scheduleId') ?? $request->getParam('schedule_id'));

        $schedule = $this->scheduleRepo->findById($scheduleId);
        if (!$schedule || (int) $schedule['dentist_id'] !== $dentistId) {
            throw HttpException::notFound('Dentist schedule shift not found.');
        }

        $this->scheduleRepo->delete($scheduleId);

        $adminUser = $request->getUser();
        $this->auditLogRepo->record(
            'DENTIST_SCHEDULE_DELETED',
            'dentist_schedules',
            $scheduleId,
            $adminUser ? (int) $adminUser['id'] : null,
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            ['dentist_id' => $dentistId, 'schedule_id' => $scheduleId]
        );

        return Response::success(null);
    }
}
