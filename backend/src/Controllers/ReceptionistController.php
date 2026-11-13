<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Services\ReceptionistService;

/**
 * Receptionist Controller
 * Endpoints for Front Desk operations: dashboard KPIs, daily arrival schedule,
 * patient check-in, live waiting queue, walk-in registration, and direct booking.
 */
class ReceptionistController
{
    private ReceptionistService $receptionistService;

    public function __construct(?ReceptionistService $receptionistService = null)
    {
        $this->receptionistService = $receptionistService ?? new ReceptionistService();
    }

    /**
     * GET /api/v1/receptionist/dashboard
     * Front desk practice overview with live Asia/Manila clinic time and operational KPIs.
     */
    public function dashboard(Request $request): Response
    {
        $summary = $this->receptionistService->getDashboardSummary();
        return Response::success($summary);
    }

    /**
     * GET /api/v1/receptionist/schedule/today
     * Today's chronological clinic schedule with attendance states and filtering.
     */
    public function todaySchedule(Request $request): Response
    {
        $queryParams = $request->getQueryParams();
        $schedule = $this->receptionistService->getTodaySchedule($queryParams);
        return Response::success($schedule);
    }

    /**
     * POST /api/v1/receptionist/appointments/{id}/check-in
     * Check in an arriving patient for their scheduled confirmed appointment.
     */
    public function checkIn(Request $request): Response
    {
        $user = $request->getUser();
        $userId = (int) ($user['id'] ?? 0);
        $appointmentId = (int) ($request->getParam('id') ?? 0);

        if ($appointmentId <= 0) {
            throw HttpException::badRequest('Invalid appointment ID specified.');
        }

        $body = $request->getBody();
        $notes = isset($body['notes']) ? trim((string) $body['notes']) : null;

        $result = $this->receptionistService->checkInPatient($appointmentId, $userId, $notes);
        return Response::success($result);
    }

    /**
     * PATCH /api/v1/receptionist/appointments/{id}/attendance
     * Update patient operational attendance state (WAITING, IN_CONSULTATION, FINISHED, NO_SHOW).
     */
    public function updateAttendance(Request $request): Response
    {
        $user = $request->getUser();
        $userId = (int) ($user['id'] ?? 0);
        $appointmentId = (int) ($request->getParam('id') ?? 0);

        if ($appointmentId <= 0) {
            throw HttpException::badRequest('Invalid appointment ID specified.');
        }

        $body = $request->getBody();
        $status = isset($body['status']) ? (string) $body['status'] : '';
        $notes = isset($body['notes']) ? trim((string) $body['notes']) : null;

        if ($status === '') {
            throw HttpException::badRequest('Attendance status is required.');
        }

        $result = $this->receptionistService->updateAttendance($appointmentId, $status, $notes, $userId);
        return Response::success($result);
    }

    /**
     * GET /api/v1/receptionist/waiting-list
     * Live clinic waiting list of arrived patients waiting for consultation.
     */
    public function waitingList(Request $request): Response
    {
        $summary = $this->receptionistService->getDashboardSummary();
        return Response::success($summary['waiting_list'] ?? []);
    }

    /**
     * POST /api/v1/receptionist/patients
     * Front desk intake / walk-in patient registration.
     */
    public function registerPatient(Request $request): Response
    {
        $user = $request->getUser();
        $userId = (int) ($user['id'] ?? 0);

        $body = $request->getBody();
        $result = $this->receptionistService->registerPatient($body, $userId);

        return Response::created($result['patient'] ?? [], ['message' => $result['message'] ?? 'Patient registered.']);
    }

    /**
     * POST /api/v1/receptionist/appointments
     * Direct front desk appointment booking.
     */
    public function createAppointment(Request $request): Response
    {
        $user = $request->getUser();
        $userId = (int) ($user['id'] ?? 0);

        $body = $request->getBody();
        $result = $this->receptionistService->createAppointment($body, $userId);

        return Response::created($result['appointment'] ?? [], ['message' => $result['message'] ?? 'Appointment booked.']);
    }
}
