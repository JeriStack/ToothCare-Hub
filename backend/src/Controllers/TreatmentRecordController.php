<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Services\TreatmentRecordService;

/**
 * Treatment Record Controller
 * Clinical documentation, FDI teeth charting, 24h edit window compliance, and patient treatment history.
 */
class TreatmentRecordController
{
    private TreatmentRecordService $treatmentRecordService;

    public function __construct(?TreatmentRecordService $treatmentRecordService = null)
    {
        $this->treatmentRecordService = $treatmentRecordService ?? new TreatmentRecordService();
    }

    /**
     * GET /api/v1/treatment-records
     * List treatment records authored by the authenticated dentist.
     */
    public function index(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required to view treatment records.');
        }

        $page = $request->getQueryInt('page', 1);
        $perPage = $request->getQueryInt('per_page', 20);

        $result = $this->treatmentRecordService->listDentistRecords(
            (int) $user['id'],
            (string) ($user['role'] ?? 'DENTIST'),
            $page,
            $perPage
        );

        return Response::success($result);
    }

    /**
     * GET /api/v1/treatment-records/{id}
     * Retrieve single treatment record with ownership enforcement.
     */
    public function show(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $id = (int) $request->getParam('id');
        $record = $this->treatmentRecordService->getRecord(
            (int) $user['id'],
            (string) ($user['role'] ?? 'DENTIST'),
            $id
        );

        return Response::success($record);
    }

    /**
     * GET /api/v1/appointments/{id}/treatment-record
     * Retrieve treatment record associated with a specific appointment.
     */
    public function showByAppointment(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $appointmentId = (int) $request->getParam('id');
        $record = $this->treatmentRecordService->getRecordByAppointment(
            (int) $user['id'],
            (string) ($user['role'] ?? 'DENTIST'),
            $appointmentId
        );

        if (!$record) {
            return Response::success(null, 200);
        }

        return Response::success($record);
    }

    /**
     * POST /api/v1/treatment-records
     * Create treatment record for an eligible, assigned appointment.
     */
    public function create(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $data = $request->getBody() ?? [];
        $created = $this->treatmentRecordService->createRecord(
            (int) $user['id'],
            (string) ($user['role'] ?? 'DENTIST'),
            $data
        );

        return Response::success($created, 201);
    }

    /**
     * PATCH /api/v1/treatment-records/{id}
     * Update clinical notes within the 24-hour edit window.
     */
    public function update(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $id = (int) $request->getParam('id');
        $data = $request->getBody() ?? [];
        $updated = $this->treatmentRecordService->updateRecord(
            (int) $user['id'],
            (string) ($user['role'] ?? 'DENTIST'),
            $id,
            $data
        );

        return Response::success($updated);
    }
}
