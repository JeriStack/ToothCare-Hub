<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Services\HistoryService;

/**
 * History Records & Individual Record Timeline Controller
 *
 * Exposes DRBAC-protected endpoints for centralized History Records
 * and chronological timelines for Patients, Dentists, Staff, and Appointments.
 */
class HistoryController
{
    private HistoryService $historyService;

    public function __construct(?HistoryService $historyService = null)
    {
        $this->historyService = $historyService ?? new HistoryService();
    }

    /**
     * GET /api/v1/history
     * Server-side paginated, searchable, filterable, sortable History Records table.
     */
    public function index(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $result = $this->historyService->listHistory($user, $request->getQueryParams());
        return Response::paginated($result['data'], $result['meta']);
    }

    /**
     * GET /api/v1/history/summary
     * Database-calculated KPI summary counts for History Records dashboard.
     */
    public function summary(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        return Response::success($this->historyService->getSummary($user));
    }

    /**
     * GET /api/v1/history/{id}
     * Retrieve a single history event with sanitized previous/updated value comparison.
     */
    public function show(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $id = (int) $request->getParam('id');
        if ($id <= 0) {
            throw HttpException::badRequest('Invalid history event ID.');
        }

        return Response::success($this->historyService->getEventDetail($user, $id));
    }

    /**
     * GET /api/v1/history/patients/{id}
     * Chronological Patient lifecycle timeline.
     */
    public function patientTimeline(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $patientId = (int) $request->getParam('id');
        if ($patientId <= 0) {
            throw HttpException::badRequest('Invalid patient ID.');
        }

        return Response::success($this->historyService->getPatientTimeline($user, $patientId));
    }

    /**
     * GET /api/v1/history/dentists/{id}
     * Chronological Dentist practice timeline.
     */
    public function dentistTimeline(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $dentistId = (int) $request->getParam('id');
        if ($dentistId <= 0) {
            throw HttpException::badRequest('Invalid dentist ID.');
        }

        return Response::success($this->historyService->getDentistTimeline($user, $dentistId));
    }

    /**
     * GET /api/v1/history/staff/{id}
     * Chronological Receptionist / Administrator activity timeline.
     */
    public function staffTimeline(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $staffUserId = (int) $request->getParam('id');
        if ($staffUserId <= 0) {
            throw HttpException::badRequest('Invalid staff user ID.');
        }

        return Response::success($this->historyService->getStaffTimeline($user, $staffUserId));
    }

    /**
     * GET /api/v1/history/appointments/{id}
     * Chronological Appointment lifecycle timeline.
     */
    public function appointmentTimeline(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $appointmentId = (int) $request->getParam('id');
        if ($appointmentId <= 0) {
            throw HttpException::badRequest('Invalid appointment ID.');
        }

        return Response::success($this->historyService->getAppointmentTimeline($user, $appointmentId));
    }
}
