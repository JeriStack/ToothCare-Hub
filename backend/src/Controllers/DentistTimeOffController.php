<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Repositories\AuditLogRepository;
use App\Repositories\DentistRepository;
use App\Repositories\DentistTimeOffRepository;
use App\Validators\ScheduleValidator;

/**
 * Dentist Time-Off & Leave Controller
 * Manages practitioner leaves, vacations, and emergency blocked clinic hours with privacy protection.
 */
class DentistTimeOffController
{
    private DentistTimeOffRepository $timeOffRepo;
    private DentistRepository $dentistRepo;
    private AuditLogRepository $auditLogRepo;
    private Database $database;

    public function __construct(
        ?DentistTimeOffRepository $timeOffRepo = null,
        ?DentistRepository $dentistRepo = null,
        ?AuditLogRepository $auditLogRepo = null,
        ?Database $database = null
    ) {
        $this->database = $database ?? Database::getInstance();
        $this->timeOffRepo = $timeOffRepo ?? new DentistTimeOffRepository($this->database);
        $this->dentistRepo = $dentistRepo ?? new DentistRepository($this->database);
        $this->auditLogRepo = $auditLogRepo ?? new AuditLogRepository($this->database);
    }

    /**
     * GET /api/v1/dentists/{id}/time-off
     * GET /api/v1/admin/dentists/{id}/time-off
     * List time-off intervals for a dentist.
     * Mask reason for non-admin and other users.
     */
    public function index(Request $request): Response
    {
        $dentistId = (int) $request->getParam('id');
        $dentist = $this->dentistRepo->findById($dentistId);
        if (!$dentist) {
            throw HttpException::notFound('Dentist profile not found.');
        }

        $from = $request->getQuery('from');
        $to = $request->getQuery('to');

        $records = $this->timeOffRepo->findByDentistId($dentistId, $from, $to);

        $currentUser = $request->getUser();
        $isAdmin = $currentUser && ($currentUser['role'] ?? '') === 'ADMIN';
        $isOwnDentist = $currentUser && (int) ($currentUser['id'] ?? 0) === (int) $dentist['user_id'];

        // Mask reasons for non-authorized viewers
        $sanitized = array_map(function (array $rec) use ($isAdmin, $isOwnDentist): array {
            if (!$isAdmin && !$isOwnDentist) {
                $rec['reason'] = 'Unavailable';
            }
            return $rec;
        }, $records);

        return Response::success([
            'dentist' => [
                'id' => (int) $dentist['id'],
                'name' => 'Dr. ' . $dentist['first_name'] . ' ' . $dentist['last_name'],
            ],
            'time_off' => $sanitized,
        ]);
    }

    /**
     * POST /api/v1/admin/dentists/{id}/time-off
     * Schedule a new time-off period for a dentist.
     */
    public function store(Request $request): Response
    {
        $dentistId = (int) $request->getParam('id');
        $dentist = $this->dentistRepo->findById($dentistId);
        if (!$dentist) {
            throw HttpException::notFound('Dentist profile not found.');
        }

        $validated = ScheduleValidator::validateTimeOff($request->getBody());
        $validated['dentist_id'] = $dentistId;

        // Check for overlapping leaves for this dentist
        $overlapping = $this->timeOffRepo->findOverlapping($dentistId, $validated['start_at'], $validated['end_at']);
        if (!empty($overlapping)) {
            throw HttpException::conflict('Requested time-off interval overlaps with an existing leave period.');
        }

        $adminUser = $request->getUser();
        $validated['approved_by_user_id'] = $adminUser ? (int) $adminUser['id'] : null;

        $id = $this->timeOffRepo->create($validated);
        $record = $this->timeOffRepo->findById($id);

        $this->auditLogRepo->record(
            'DENTIST_TIME_OFF_SCHEDULED',
            'dentist_time_off',
            $id,
            $adminUser ? (int) $adminUser['id'] : null,
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            [
                'dentist_id' => $dentistId,
                'start_at' => $validated['start_at'],
                'end_at' => $validated['end_at'],
                'reason' => $validated['reason'],
            ]
        );

        return Response::created($record);
    }

    /**
     * DELETE /api/v1/admin/dentists/{id}/time-off/{timeOffId}
     * Remove a scheduled time-off period.
     */
    public function destroy(Request $request): Response
    {
        $dentistId = (int) $request->getParam('id');
        $timeOffId = (int) ($request->getParam('timeOffId') ?? $request->getParam('time_off_id'));

        $record = $this->timeOffRepo->findById($timeOffId);
        if (!$record || (int) $record['dentist_id'] !== $dentistId) {
            throw HttpException::notFound('Dentist time-off record not found.');
        }

        $this->timeOffRepo->delete($timeOffId);

        $adminUser = $request->getUser();
        $this->auditLogRepo->record(
            'DENTIST_TIME_OFF_DELETED',
            'dentist_time_off',
            $timeOffId,
            $adminUser ? (int) $adminUser['id'] : null,
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            ['dentist_id' => $dentistId, 'time_off_id' => $timeOffId]
        );

        return Response::success(null);
    }
}
