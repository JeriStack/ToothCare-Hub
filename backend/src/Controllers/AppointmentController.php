<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Services\AppointmentService;

/**
 * Appointment Controller
 * Handles patient booking, listing, cancellation, rescheduling, and administrative review actions.
 */
class AppointmentController
{
    private AppointmentService $appointmentService;

    public function __construct(?AppointmentService $appointmentService = null)
    {
        $this->appointmentService = $appointmentService ?? new AppointmentService();
    }

    /**
     * POST /api/v1/appointments
     * Book a new dental appointment (Patient only).
     */
    public function book(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required to book an appointment.');
        }

        $body = $request->getBody();
        $appointment = $this->appointmentService->bookAppointment((int) $user['id'], $body);

        return Response::created($appointment, ['message' => 'Appointment request submitted successfully.']);
    }

    /**
     * GET /api/v1/appointments
     * List appointments for the authenticated patient.
     */
    public function index(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required to view your appointments.');
        }

        $queryParams = $request->getQueryParams();
        $result = $this->appointmentService->listPatientAppointments((int) $user['id'], $queryParams);

        return Response::success($result);
    }

    /**
     * GET /api/v1/appointments/{id}
     * Get single appointment details (Patient scoped or Admin).
     */
    public function show(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $id = (int) $request->getParam('id');
        if ($id <= 0) {
            throw HttpException::badRequest('Invalid appointment ID.');
        }

        $appointment = $this->appointmentService->getAppointment(
            (int) $user['id'],
            (string) ($user['role'] ?? 'PATIENT'),
            $id
        );

        return Response::success($appointment);
    }

    /**
     * POST /api/v1/appointments/{id}/cancel
     * Cancel an existing appointment.
     */
    public function cancel(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $id = (int) $request->getParam('id');
        if ($id <= 0) {
            throw HttpException::badRequest('Invalid appointment ID.');
        }

        $body = $request->getBody();
        $appointment = $this->appointmentService->cancelAppointment(
            (int) $user['id'],
            (string) ($user['role'] ?? 'PATIENT'),
            $id,
            $body
        );

        return Response::success($appointment, 200, ['message' => 'Appointment cancelled successfully.']);
    }

    /**
     * POST /api/v1/appointments/{id}/reschedule
     * Reschedule an appointment (Option A: Cancel-and-create with relational linkage).
     */
    public function reschedule(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $id = (int) $request->getParam('id');
        if ($id <= 0) {
            throw HttpException::badRequest('Invalid appointment ID.');
        }

        $body = $request->getBody();
        $newAppointment = $this->appointmentService->rescheduleAppointment(
            (int) $user['id'],
            (string) ($user['role'] ?? 'PATIENT'),
            $id,
            $body
        );

        return Response::created($newAppointment, ['message' => 'Appointment rescheduled successfully.']);
    }

    /**
     * GET /api/v1/dentist/appointments
     * List appointments assigned to the authenticated dentist.
     */
    public function dentistIndex(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required to view dentist appointments.');
        }

        $queryParams = $request->getQueryParams();
        $result = $this->appointmentService->listDentistAppointments((int) $user['id'], $queryParams);

        return Response::success($result);
    }

    /**
     * GET /api/v1/admin/appointments
     * Administrative filterable & paginated appointments overview.
     */
    public function adminIndex(Request $request): Response
    {
        $queryParams = $request->getQueryParams();
        $page = isset($queryParams['page']) ? max(1, (int) $queryParams['page']) : 1;
        $perPage = isset($queryParams['per_page']) ? max(1, min(100, (int) $queryParams['per_page'])) : 20;

        $result = $this->appointmentService->listAdminAppointments($queryParams, $page, $perPage);

        return Response::success($result);
    }

    /**
     * GET /api/v1/admin/appointments/{id}
     * Administrative single appointment details with full audit trail.
     */
    public function adminShow(Request $request): Response
    {
        $user = $request->getUser();
        $id = (int) $request->getParam('id');
        if ($id <= 0) {
            throw HttpException::badRequest('Invalid appointment ID.');
        }

        $appointment = $this->appointmentService->getAppointment(
            (int) ($user['id'] ?? 0),
            'ADMIN',
            $id
        );

        return Response::success($appointment);
    }

    /**
     * PATCH /api/v1/admin/appointments/{id}/confirm
     * Confirm a pending appointment.
     */
    public function confirm(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $id = (int) $request->getParam('id');
        if ($id <= 0) {
            throw HttpException::badRequest('Invalid appointment ID.');
        }

        $appointment = $this->appointmentService->confirmAppointment((int) $user['id'], $id);

        return Response::success($appointment, 200, ['message' => 'Appointment confirmed successfully.']);
    }

    /**
     * PATCH /api/v1/admin/appointments/{id}/reject
     * Reject a pending appointment with reason.
     */
    public function reject(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $id = (int) $request->getParam('id');
        if ($id <= 0) {
            throw HttpException::badRequest('Invalid appointment ID.');
        }

        $body = $request->getBody();
        $appointment = $this->appointmentService->rejectAppointment((int) $user['id'], $id, $body);

        return Response::success($appointment, 200, ['message' => 'Appointment request declined.']);
    }

    /**
     * PATCH /api/v1/admin/appointments/{id}/complete
     * Mark a confirmed appointment as completed.
     */
    public function complete(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $id = (int) $request->getParam('id');
        if ($id <= 0) {
            throw HttpException::badRequest('Invalid appointment ID.');
        }

        $appointment = $this->appointmentService->completeAppointment((int) $user['id'], $id);

        return Response::success($appointment, 200, ['message' => 'Appointment visit marked as completed.']);
    }
}
