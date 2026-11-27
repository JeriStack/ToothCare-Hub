<?php

declare(strict_types=1);

namespace App\OpenApi\Paths;

use OpenApi\Attributes as OA;

/**
 * OpenAPI 3.0.3 Path Definitions: Appointments Lifecycle, Role-Scoped Search, Receptionist Workspace, and Treatment Records.
 */
final class AppointmentsClinicalPaths
{
    #[OA\Get(
        path: '/appointments',
        operationId: 'listPatientAppointments',
        summary: 'List Authenticated Patient Appointments (Paginated)',
        tags: ['Appointments'],
        security: [['CookieAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'])),
            new OA\Parameter(name: 'start_date', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'end_date', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'dentist_id', in: 'query', schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'service_id', in: 'query', schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, default: 1)),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 100, default: 20)),
        ],
        responses: [new OA\Response(response: 200, description: 'Paginated patient appointments'), new OA\Response(response: 401, description: 'Unauthenticated'), new OA\Response(response: 422, description: 'Invalid filter parameters')]
    )]
    #[OA\Post(
        path: '/appointments',
        operationId: 'bookAppointment',
        summary: 'Request New Dental Appointment (Patient)',
        description: 'Validates active dentist/service, working hours, time-off, clinic closures, and uses InnoDB row locking (SELECT ... FOR UPDATE) with half-open interval non-overlap checks to prevent double booking.',
        tags: ['Appointments'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['dentist_id', 'service_id', 'start_at'],
                properties: [
                    new OA\Property(property: 'dentist_id', type: 'integer', example: 2),
                    new OA\Property(property: 'service_id', type: 'integer', example: 1),
                    new OA\Property(property: 'start_at', type: 'string', example: '2026-12-01 09:00:00'),
                    new OA\Property(property: 'chief_complaint', type: 'string', nullable: true, example: 'Routine dental cleaning'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Appointment requested (status: PENDING)'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 409, description: 'Overlapping slot conflict'),
            new OA\Response(response: 422, description: 'Validation or scheduling policy violation'),
        ]
    )]
    public function appointments(): void {}

    #[OA\Get(
        path: '/appointments/search',
        operationId: 'searchAppointments',
        summary: 'Role-Scoped Appointment Search & Advanced Filtering',
        description: 'Enforces strict server-side role scoping: Admin/Receptionist search clinic-wide; Dentist strictly scoped to own dentist_id; Patient strictly scoped to own patient_id.',
        tags: ['Appointments'],
        security: [['CookieAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'start_date', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'end_date', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'dentist_id', in: 'query', schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'patient_id', in: 'query', schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'service_id', in: 'query', schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'])),
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, default: 1)),
            new OA\Parameter(name: 'limit', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 100, default: 20)),
        ],
        responses: [new OA\Response(response: 200, description: 'Paginated search results'), new OA\Response(response: 401, description: 'Unauthenticated'), new OA\Response(response: 422, description: 'Invalid filter or date range')]
    )]
    public function searchAppointments(): void {}

    #[OA\Get(
        path: '/appointments/{id}',
        operationId: 'getAppointmentById',
        summary: 'Get Single Appointment with Status History (Owner/Admin)',
        tags: ['Appointments'],
        security: [['CookieAuth' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Appointment details'), new OA\Response(response: 400, description: 'Invalid ID'), new OA\Response(response: 403, description: 'Forbidden'), new OA\Response(response: 404, description: 'Not found')]
    )]
    public function appointmentById(): void {}

    #[OA\Post(
        path: '/appointments/{id}/cancel',
        operationId: 'cancelAppointment',
        summary: 'Cancel Appointment (Enforces 24h Patient Cutoff for Confirmed Visits)',
        tags: ['Appointments'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Appointment cancelled'), new OA\Response(response: 403, description: 'Ownership denied'), new OA\Response(response: 422, description: 'Outside cancellation cutoff or invalid transition')]
    )]
    public function cancelAppointment(): void {}

    #[OA\Post(
        path: '/appointments/{id}/reschedule',
        operationId: 'rescheduleAppointment',
        summary: 'Reschedule Appointment (Atomic Cancel-and-Relink)',
        tags: ['Appointments'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 201, description: 'Replacement appointment created'), new OA\Response(response: 409, description: 'New slot conflict')]
    )]
    public function rescheduleAppointment(): void {}

    // --- Admin / Front Desk Appointments Triage ---
    #[OA\Get(
        path: '/admin/appointments',
        operationId: 'listAdminAppointments',
        summary: 'List & Filter Clinic Appointments (Admin/Receptionist, Server-Side Paginated & Sortable)',
        tags: ['Appointments'],
        security: [['CookieAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', minimum: 1, default: 1)),
            new OA\Parameter(name: 'per_page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 100, default: 20)),
            new OA\Parameter(name: 'search', in: 'query', required: false, schema: new OA\Schema(type: 'string', maxLength: 120)),
            new OA\Parameter(name: 'status', in: 'query', required: false, schema: new OA\Schema(type: 'string', enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'NO_SHOW'])),
            new OA\Parameter(name: 'dentist_id', in: 'query', required: false, schema: new OA\Schema(type: 'integer', minimum: 1)),
            new OA\Parameter(name: 'service_id', in: 'query', required: false, schema: new OA\Schema(type: 'integer', minimum: 1)),
            new OA\Parameter(name: 'start_date', in: 'query', required: false, schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'end_date', in: 'query', required: false, schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'sort_by', in: 'query', required: false, schema: new OA\Schema(type: 'string', enum: ['id', 'start_at', 'created_at', 'status', 'patient_name', 'dentist_name', 'service_name'], default: 'start_at')),
            new OA\Parameter(name: 'sort_dir', in: 'query', required: false, schema: new OA\Schema(type: 'string', enum: ['asc', 'desc'], default: 'desc')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Paginated appointments with total_records, filtered_records, sorting, and triage summary'),
            new OA\Response(response: 422, description: 'Invalid pagination, filter, date range, or sort parameters'),
        ]
    )]
    public function adminAppointments(): void {}

    #[OA\Get(path: '/admin/appointments/{id}', operationId: 'getAdminAppointment', summary: 'Get Appointment Details with Audit Trail (Admin/Receptionist)', tags: ['Appointments'], security: [['CookieAuth' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Appointment details')])]
    public function adminAppointmentById(): void {}

    #[OA\Get(path: '/admin/appointments/{id}/availability', operationId: 'checkAdminAppointmentAvailability', summary: 'Revalidate Dentist & Clinic Availability Prior to Approval (Admin/Receptionist)', tags: ['Appointments'], security: [['CookieAuth' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Structured availability validation result and suggested rejection reason'), new OA\Response(response: 404, description: 'Appointment not found')])]
    public function checkAdminAppointmentAvailability(): void {}

    #[OA\Patch(path: '/admin/appointments/{id}/confirm', operationId: 'confirmAppointment', summary: 'Approve & Confirm Pending Appointment (Admin/Receptionist)', tags: ['Appointments'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Appointment confirmed'), new OA\Response(response: 409, description: 'Invalid transition or slot conflict')])]
    public function confirmAppointment(): void {}

    #[OA\Patch(path: '/admin/appointments/{id}/reject', operationId: 'rejectAppointment', summary: 'Decline Pending Appointment with Reason (Admin/Receptionist)', tags: ['Appointments'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Appointment rejected')])]
    public function rejectAppointment(): void {}

    #[OA\Patch(path: '/admin/appointments/{id}/complete', operationId: 'completeAdminAppointment', summary: 'Mark Confirmed Appointment Completed (Admin)', tags: ['Appointments'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Appointment completed'), new OA\Response(response: 409, description: 'Invalid status transition')])]
    public function completeAdminAppointment(): void {}

    // --- Dentist Scoped Appointments ---
    #[OA\Get(path: '/dentist/appointments', operationId: 'listDentistAppointments', summary: 'List Assigned Dentist Appointments (SQL Paginated)', tags: ['Appointments'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Paginated assigned appointments')])]
    public function dentistAppointments(): void {}

    #[OA\Get(path: '/dentist/appointments/{id}', operationId: 'getDentistAppointment', summary: 'Get Assigned Dentist Appointment Detail (Ownership Enforced)', tags: ['Appointments'], security: [['CookieAuth' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Assigned appointment detail'), new OA\Response(response: 403, description: 'Not assigned to this dentist')])]
    public function dentistAppointmentById(): void {}

    #[OA\Patch(path: '/dentist/appointments/{id}/complete', operationId: 'completeDentistAppointmentPatch', summary: 'Complete Assigned Appointment (PATCH, Dentist)', tags: ['Appointments'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Appointment completed')])]
    #[OA\Post(path: '/dentist/appointments/{id}/complete', operationId: 'completeDentistAppointmentPost', summary: 'Complete Assigned Appointment (POST, Dentist)', tags: ['Appointments'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Appointment completed')])]
    public function completeDentistAppointment(): void {}

    // --- Receptionist Workspace ---
    #[OA\Get(path: '/receptionist/schedule/today', operationId: 'getReceptionistTodaySchedule', summary: 'Get Today Clinic Arrival Schedule (Receptionist/Admin)', tags: ['Receptionist'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Today schedule with attendance states')])]
    public function receptionistToday(): void {}

    #[OA\Post(path: '/receptionist/appointments/{id}/check-in', operationId: 'checkInPatient', summary: 'Check In Arriving Patient (Receptionist/Admin)', tags: ['Receptionist'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Patient checked in')])]
    public function receptionistCheckIn(): void {}

    #[OA\Patch(path: '/receptionist/appointments/{id}/attendance', operationId: 'updatePatientAttendance', summary: 'Update Operational Attendance State (Receptionist/Admin)', tags: ['Receptionist'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Attendance updated')])]
    public function receptionistAttendance(): void {}

    #[OA\Get(path: '/receptionist/waiting-list', operationId: 'getReceptionistWaitingList', summary: 'Get Live Clinic Waiting Queue (Receptionist/Admin)', tags: ['Receptionist'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Waiting queue')])]
    public function receptionistWaitingList(): void {}

    #[OA\Post(path: '/receptionist/patients', operationId: 'registerWalkInPatient', summary: 'Register Walk-In Patient (Receptionist/Admin)', tags: ['Receptionist'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 201, description: 'Patient registered')])]
    public function receptionistPatients(): void {}

    #[OA\Post(path: '/receptionist/appointments', operationId: 'createFrontDeskAppointment', summary: 'Create Front-Desk Appointment (Receptionist/Admin)', tags: ['Receptionist'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 201, description: 'Appointment created')])]
    public function receptionistAppointments(): void {}

    // --- Clinical Treatment Records ---
    #[OA\Get(path: '/treatment-records', operationId: 'listTreatmentRecords', summary: 'List Treatment Records (Dentist/Admin, Paginated)', tags: ['Clinical'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Paginated treatment records')])]
    #[OA\Post(path: '/treatment-records', operationId: 'createTreatmentRecord', summary: 'Create Clinical Treatment Record (Dentist/Admin)', tags: ['Clinical'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 201, description: 'Treatment record created')])]
    public function treatmentRecords(): void {}

    #[OA\Get(path: '/treatment-records/{id}', operationId: 'getTreatmentRecord', summary: 'Get Treatment Record by ID (Dentist/Admin)', tags: ['Clinical'], security: [['CookieAuth' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Treatment record')])]
    #[OA\Patch(path: '/treatment-records/{id}', operationId: 'patchTreatmentRecord', summary: 'Amend Treatment Record (PATCH, Dentist/Admin)', tags: ['Clinical'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Treatment record amended')])]
    #[OA\Put(path: '/treatment-records/{id}', operationId: 'putTreatmentRecord', summary: 'Amend Treatment Record (PUT, Dentist/Admin)', tags: ['Clinical'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Treatment record amended')])]
    public function treatmentRecordById(): void {}

    #[OA\Get(path: '/appointments/{id}/treatment-record', operationId: 'getAppointmentTreatmentRecord', summary: 'Get Treatment Record Linked to Appointment (Dentist/Admin)', tags: ['Clinical'], security: [['CookieAuth' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Treatment record')])]
    public function appointmentTreatmentRecord(): void {}
}
