<?php

declare(strict_types=1);

namespace App\OpenApi\Paths;

use OpenApi\Attributes as OA;

/**
 * OpenAPI 3.0.3 Path Definitions: Patients, Dentists, Services, Clinic Schedules, and Availability.
 */
final class PatientsDentistsServicesPaths
{
    // --- Public Catalog & Availability ---
    #[OA\Get(path: '/services', operationId: 'listPublicServices', summary: 'List Active Dental Services', tags: ['Services'], responses: [new OA\Response(response: 200, description: 'Active services array')])]
    public function publicServices(): void {}

    #[OA\Get(path: '/dentists', operationId: 'listPublicDentists', summary: 'List Active Dentists', tags: ['Dentists'], responses: [new OA\Response(response: 200, description: 'Active dentists array')])]
    public function publicDentists(): void {}

    #[OA\Get(
        path: '/dentists/{id}',
        operationId: 'getPublicDentist',
        summary: 'Get Public Dentist Profile by ID',
        tags: ['Dentists'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Dentist profile'), new OA\Response(response: 404, description: 'Not found')]
    )]
    public function publicDentistById(): void {}

    #[OA\Get(
        path: '/dentists/{id}/avatar',
        operationId: 'getDentistAvatarById',
        summary: 'Serve Dentist Avatar Image',
        tags: ['Dentists'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Image binary'), new OA\Response(response: 404, description: 'Not found')]
    )]
    public function dentistAvatarById(): void {}

    #[OA\Get(
        path: '/availability',
        operationId: 'getAvailabilitySlots',
        summary: 'Compute Available Appointment Slots (Asia/Manila)',
        tags: ['Scheduling'],
        parameters: [
            new OA\Parameter(name: 'dentist_id', in: 'query', required: true, schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'service_id', in: 'query', required: true, schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'date', in: 'query', required: true, schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [new OA\Response(response: 200, description: 'Available time slots with reason messages and validated alternatives when unavailable'), new OA\Response(response: 422, description: 'Invalid parameters')]
    )]
    public function availability(): void {}

    #[OA\Get(
        path: '/availability/validate',
        operationId: 'validateAvailabilitySlot',
        summary: 'Validate a Specific Appointment Slot Against Clinic & Dentist Availability Rules',
        tags: ['Scheduling'],
        parameters: [
            new OA\Parameter(name: 'dentist_id', in: 'query', required: true, schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'service_id', in: 'query', required: true, schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'start_at', in: 'query', required: true, schema: new OA\Schema(type: 'string')),
        ],
        responses: [new OA\Response(response: 200, description: 'Structured availability validation result and alternatives'), new OA\Response(response: 422, description: 'Invalid parameters')]
    )]
    public function validateAvailabilitySlot(): void {}

    #[OA\Get(path: '/clinic/hours', operationId: 'getClinicHours', summary: 'Get Clinic Weekly Operating Hours', tags: ['Scheduling'], responses: [new OA\Response(response: 200, description: 'Operating hours')])]
    public function clinicHours(): void {}

    #[OA\Get(path: '/clinic/closures', operationId: 'getClinicClosures', summary: 'Get Scheduled Clinic Closures & Holidays', tags: ['Scheduling'], responses: [new OA\Response(response: 200, description: 'Closures list')])]
    public function clinicClosures(): void {}

    #[OA\Get(
        path: '/dentists/{id}/schedules',
        operationId: 'getPublicDentistSchedules',
        summary: 'Get Dentist Weekly Working Shifts',
        tags: ['Scheduling'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Dentist shifts')]
    )]
    public function dentistSchedulesPublic(): void {}

    #[OA\Get(
        path: '/dentists/{id}/time-off',
        operationId: 'getPublicDentistTimeOff',
        summary: 'Get Dentist Scheduled Time-Off Blocks',
        tags: ['Scheduling'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Time-off list')]
    )]
    public function dentistTimeOffPublic(): void {}

    // --- Patients Self-Management & Ownership ---
    #[OA\Get(path: '/patients/me', operationId: 'getMyPatientProfile', summary: 'Get Authenticated Patient Profile', tags: ['Patients'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Patient profile')])]
    #[OA\Patch(path: '/patients/me', operationId: 'updateMyPatientProfile', summary: 'Update Authenticated Patient Profile', tags: ['Patients'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 200, description: 'Profile updated')])]
    public function patientsMe(): void {}

    #[OA\Get(path: '/patients/me/avatar', operationId: 'getMyPatientAvatar', summary: 'Serve Authenticated Patient Avatar', tags: ['Patients'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Image binary')])]
    #[OA\Post(path: '/patients/me/avatar', operationId: 'uploadMyPatientAvatar', summary: 'Upload Authenticated Patient Avatar', tags: ['Patients'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 200, description: 'Avatar uploaded')])]
    #[OA\Delete(path: '/patients/me/avatar', operationId: 'deleteMyPatientAvatar', summary: 'Delete Authenticated Patient Avatar', tags: ['Patients'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 200, description: 'Avatar removed')])]
    public function patientsMeAvatar(): void {}

    #[OA\Get(
        path: '/patients/{id}/avatar',
        operationId: 'getPatientAvatarById',
        summary: 'Serve Patient Avatar by ID (Owner/Authorized Staff)',
        tags: ['Patients'],
        security: [['CookieAuth' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Image binary'), new OA\Response(response: 403, description: 'Forbidden')]
    )]
    public function patientAvatarById(): void {}

    #[OA\Get(
        path: '/patients/{id}',
        operationId: 'getPatientById',
        summary: 'Get Patient Profile (Strict Ownership / Staff)',
        tags: ['Patients'],
        security: [['CookieAuth' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Patient profile'), new OA\Response(response: 403, description: 'Forbidden')]
    )]
    #[OA\Patch(
        path: '/patients/{id}',
        operationId: 'updatePatientById',
        summary: 'Update Patient Profile (Strict Ownership / Staff)',
        tags: ['Patients'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Patient updated'), new OA\Response(response: 403, description: 'Forbidden')]
    )]
    public function patientById(): void {}

    // --- Dentist Self-Service ---
    #[OA\Get(path: '/dentist/profile', operationId: 'getMyDentistProfile', summary: 'Get Authenticated Dentist Profile', tags: ['Dentists'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Dentist profile')])]
    #[OA\Patch(path: '/dentist/profile', operationId: 'updateMyDentistProfile', summary: 'Update Authenticated Dentist Profile', tags: ['Dentists'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 200, description: 'Profile updated')])]
    public function dentistProfile(): void {}

    #[OA\Get(path: '/dentist/profile/avatar', operationId: 'getMyDentistAvatar', summary: 'Serve Authenticated Dentist Avatar', tags: ['Dentists'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Image binary')])]
    #[OA\Post(path: '/dentist/profile/avatar', operationId: 'uploadMyDentistAvatar', summary: 'Upload Authenticated Dentist Avatar', tags: ['Dentists'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 200, description: 'Avatar uploaded')])]
    #[OA\Delete(path: '/dentist/profile/avatar', operationId: 'deleteMyDentistAvatar', summary: 'Delete Authenticated Dentist Avatar', tags: ['Dentists'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 200, description: 'Avatar removed')])]
    public function dentistProfileAvatar(): void {}

    #[OA\Post(path: '/dentist/time-off', operationId: 'requestDentistTimeOff', summary: 'Submit Dentist Time-Off Block', tags: ['Dentists'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 201, description: 'Time-off created')])]
    public function dentistTimeOffSelf(): void {}

    // --- Admin Services, Dentists, Patients, & Clinic Schedule ---
    #[OA\Get(path: '/admin/services', operationId: 'listAdminServices', summary: 'List All Services (Admin/Receptionist, Paginated)', tags: ['Services'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Paginated services')])]
    #[OA\Post(path: '/admin/services', operationId: 'createAdminService', summary: 'Create Dental Service (Admin)', tags: ['Services'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 201, description: 'Service created')])]
    public function adminServices(): void {}

    #[OA\Get(path: '/admin/services/{id}', operationId: 'getAdminService', summary: 'Get Service Details (Admin/Receptionist)', tags: ['Services'], security: [['CookieAuth' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Service details')])]
    #[OA\Put(path: '/admin/services/{id}', operationId: 'replaceAdminService', summary: 'Update Service (PUT, Admin)', tags: ['Services'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Service updated')])]
    #[OA\Patch(path: '/admin/services/{id}', operationId: 'patchAdminService', summary: 'Update Service (PATCH, Admin)', tags: ['Services'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Service updated')])]
    public function adminServiceById(): void {}

    #[OA\Patch(path: '/admin/services/{id}/status', operationId: 'updateAdminServiceStatus', summary: 'Toggle Service Active Status (Admin)', tags: ['Services'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Status updated')])]
    public function adminServiceStatus(): void {}

    #[OA\Get(path: '/admin/dentists', operationId: 'listAdminDentists', summary: 'List All Dentists (Admin/Receptionist, Paginated)', tags: ['Dentists'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Paginated dentists')])]
    #[OA\Post(path: '/admin/dentists', operationId: 'createAdminDentist', summary: 'Create Dentist Account & Profile (Admin)', tags: ['Dentists'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 201, description: 'Dentist created')])]
    public function adminDentists(): void {}

    #[OA\Get(path: '/admin/dentists/{id}', operationId: 'getAdminDentist', summary: 'Get Dentist Details (Admin/Receptionist)', tags: ['Dentists'], security: [['CookieAuth' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Dentist details')])]
    #[OA\Put(path: '/admin/dentists/{id}', operationId: 'replaceAdminDentist', summary: 'Update Dentist (PUT, Admin)', tags: ['Dentists'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Dentist updated')])]
    #[OA\Patch(path: '/admin/dentists/{id}', operationId: 'patchAdminDentist', summary: 'Update Dentist (PATCH, Admin)', tags: ['Dentists'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Dentist updated')])]
    public function adminDentistById(): void {}

    #[OA\Patch(path: '/admin/dentists/{id}/status', operationId: 'updateAdminDentistStatus', summary: 'Toggle Dentist Active Status (Admin)', tags: ['Dentists'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Status updated')])]
    public function adminDentistStatus(): void {}

    #[OA\Put(path: '/admin/clinic/hours', operationId: 'updateClinicHours', summary: 'Update Clinic Weekly Operating Hours (Admin)', tags: ['Scheduling'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 200, description: 'Operating hours updated')])]
    public function adminClinicHours(): void {}

    #[OA\Get(path: '/admin/clinic/closures', operationId: 'listAdminClinicClosures', summary: 'List Clinic Closures (Admin/Receptionist)', tags: ['Scheduling'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Closures list')])]
    #[OA\Post(path: '/admin/clinic/closures', operationId: 'createAdminClinicClosure', summary: 'Create Clinic Closure (Admin)', tags: ['Scheduling'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 201, description: 'Closure created')])]
    public function adminClinicClosures(): void {}

    #[OA\Delete(path: '/admin/clinic/closures/{id}', operationId: 'deleteAdminClinicClosure', summary: 'Delete Clinic Closure (Admin)', tags: ['Scheduling'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Closure deleted')])]
    public function adminClinicClosureById(): void {}

    #[OA\Get(path: '/admin/dentists/{id}/schedules', operationId: 'listAdminDentistSchedules', summary: 'List Dentist Working Shifts (Admin/Receptionist)', tags: ['Scheduling'], security: [['CookieAuth' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Shifts list')])]
    #[OA\Post(path: '/admin/dentists/{id}/schedules', operationId: 'createAdminDentistSchedule', summary: 'Add Dentist Working Shift (Admin)', tags: ['Scheduling'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 201, description: 'Shift created')])]
    public function adminDentistSchedules(): void {}

    #[OA\Put(
        path: '/admin/dentists/{id}/schedules/{scheduleId}',
        operationId: 'updateAdminDentistSchedule',
        summary: 'Update Dentist Working Shift (Admin)',
        tags: ['Scheduling'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'scheduleId', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [new OA\Response(response: 200, description: 'Shift updated')]
    )]
    #[OA\Delete(
        path: '/admin/dentists/{id}/schedules/{scheduleId}',
        operationId: 'deleteAdminDentistSchedule',
        summary: 'Delete Dentist Working Shift (Admin)',
        tags: ['Scheduling'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'scheduleId', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [new OA\Response(response: 200, description: 'Shift deleted')]
    )]
    public function adminDentistScheduleById(): void {}

    #[OA\Get(path: '/admin/dentists/{id}/time-off', operationId: 'listAdminDentistTimeOff', summary: 'List Dentist Time-Off (Admin/Receptionist)', tags: ['Scheduling'], security: [['CookieAuth' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Time-off list')])]
    #[OA\Post(path: '/admin/dentists/{id}/time-off', operationId: 'createAdminDentistTimeOff', summary: 'Create Dentist Time-Off Block (Admin)', tags: ['Scheduling'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 201, description: 'Time-off created')])]
    public function adminDentistTimeOff(): void {}

    #[OA\Delete(
        path: '/admin/dentists/{id}/time-off/{timeOffId}',
        operationId: 'deleteAdminDentistTimeOff',
        summary: 'Delete Dentist Time-Off Block (Admin)',
        tags: ['Scheduling'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'timeOffId', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [new OA\Response(response: 200, description: 'Time-off deleted')]
    )]
    public function adminDentistTimeOffById(): void {}

    #[OA\Get(path: '/admin/patients', operationId: 'listAdminPatients', summary: 'List All Patients (Admin/Receptionist, Paginated)', tags: ['Patients'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Paginated patient directory')])]
    public function adminPatients(): void {}

    #[OA\Get(path: '/admin/patients/{id}', operationId: 'getAdminPatient', summary: 'Get Patient Details (Admin/Receptionist)', tags: ['Patients'], security: [['CookieAuth' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Patient details')])]
    #[OA\Put(path: '/admin/patients/{id}', operationId: 'replaceAdminPatient', summary: 'Update Patient (PUT, Admin/Receptionist)', tags: ['Patients'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Patient updated')])]
    #[OA\Patch(path: '/admin/patients/{id}', operationId: 'patchAdminPatient', summary: 'Update Patient (PATCH, Admin/Receptionist)', tags: ['Patients'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Patient updated')])]
    public function adminPatientById(): void {}

    #[OA\Patch(path: '/admin/patients/{id}/status', operationId: 'updateAdminPatientStatus', summary: 'Activate or Deactivate Patient Account (Admin)', tags: ['Patients'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Status updated')])]
    public function adminPatientStatus(): void {}
}
