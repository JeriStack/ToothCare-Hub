<?php

declare(strict_types=1);

use App\Controllers\AppointmentController;
use App\Controllers\AuditLogController;
use App\Controllers\EmailOutboxController;
use App\Controllers\AuthController;
use App\Controllers\AvailabilityController;
use App\Controllers\ClinicScheduleController;
use App\Controllers\ClinicSettingsController;
use App\Controllers\DashboardController;
use App\Controllers\DentistController;
use App\Controllers\DentistScheduleController;
use App\Controllers\DentistTimeOffController;
use App\Controllers\HealthController;
use App\Controllers\MetricsController;
use App\Controllers\NotificationController;
use App\Controllers\PatientController;
use App\Controllers\RealtimeController;
use App\Controllers\ReceptionistController;
use App\Controllers\ReportController;
use App\Controllers\RolePermissionController;
use App\Controllers\ServiceController;
use App\Controllers\TreatmentRecordController;
use App\Controllers\UserController;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;
use App\Middleware\AuthenticationMiddleware;
use App\Middleware\AuthorizationMiddleware;

/**
 * ToothCare Hub API Route Definitions
 * Versioned under /api/v1
 */

/** @var Router $router */

// Root health and metrics aliases for container orchestrators
$router->get('/health', [HealthController::class, 'check']);
$router->get('/metrics', [MetricsController::class, 'metrics']);

$router->group('/api/v1', function (Router $r): void {
    // 1. Health & Liveness
    $r->get('/health', [HealthController::class, 'check']);
    $r->get('/metrics', [MetricsController::class, 'metrics']);

    // 2. Authentication & Account Security (Phase 7)
    $r->post('/auth/register', [AuthController::class, 'register']);
    $r->post('/auth/login', [AuthController::class, 'login']);
    $r->get('/auth/csrf-token', [AuthController::class, 'csrfToken']);
    $r->post('/auth/verify-email', [AuthController::class, 'verifyEmail']);
    $r->post('/auth/resend-verification', [AuthController::class, 'resendVerification']);
    $r->post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
    $r->post('/auth/password/forgot', [AuthController::class, 'forgotPassword']);
    $r->post('/auth/reset-password', [AuthController::class, 'resetPassword']);
    $r->post('/auth/password/reset', [AuthController::class, 'resetPassword']);

    // Protected Auth Endpoints
    $r->post('/auth/logout', [AuthController::class, 'logout'], [AuthenticationMiddleware::class]);
    $r->get('/auth/me', [AuthController::class, 'me'], [AuthenticationMiddleware::class]);
    $r->patch('/auth/me', [UserController::class, 'updateMe'], [AuthenticationMiddleware::class]);
    $r->get('/auth/me/avatar', [UserController::class, 'serveMyAvatar'], [AuthenticationMiddleware::class]);
    $r->post('/auth/me/avatar', [UserController::class, 'uploadMyAvatar'], [AuthenticationMiddleware::class]);
    $r->delete('/auth/me/avatar', [UserController::class, 'deleteMyAvatar'], [AuthenticationMiddleware::class]);

    // User / Staff Self-Service Profile Endpoints
    $r->get('/user/profile', [UserController::class, 'me'], [AuthenticationMiddleware::class]);
    $r->patch('/user/profile', [UserController::class, 'updateMe'], [AuthenticationMiddleware::class]);
    $r->get('/user/profile/avatar', [UserController::class, 'serveMyAvatar'], [AuthenticationMiddleware::class]);
    $r->post('/user/profile/avatar', [UserController::class, 'uploadMyAvatar'], [AuthenticationMiddleware::class]);
    $r->delete('/user/profile/avatar', [UserController::class, 'deleteMyAvatar'], [AuthenticationMiddleware::class]);
    $r->get('/users/{id}/avatar', [UserController::class, 'serveAvatar']);

    // 3. Public Catalog Endpoints (Active items for booking/discovery)
    $r->get('/services', [ServiceController::class, 'listPublic']);
    $r->get('/dentists', [DentistController::class, 'listPublic']);
    $r->get('/dentists/{id}', [DentistController::class, 'showPublic']);
    $r->get('/dentists/{id}/avatar', [DentistController::class, 'serveAvatar']);

    // 4. Patients Self-Management Group (Phase 7 & 11 ownership checks)
    $r->get('/patients/me', [PatientController::class, 'me'], [AuthenticationMiddleware::class]);
    $r->patch('/patients/me', [PatientController::class, 'updateMe'], [AuthenticationMiddleware::class]);
    $r->get('/patients/me/avatar', [PatientController::class, 'serveMyAvatar'], [AuthenticationMiddleware::class]);
    $r->post('/patients/me/avatar', [PatientController::class, 'uploadMyAvatar'], [AuthenticationMiddleware::class]);
    $r->delete('/patients/me/avatar', [PatientController::class, 'deleteMyAvatar'], [AuthenticationMiddleware::class]);
    $r->get('/patients/{id}/avatar', [PatientController::class, 'serveAvatar'], [AuthenticationMiddleware::class]);
    $r->get('/patients/{id}', [PatientController::class, 'show'], [AuthenticationMiddleware::class]);
    $r->patch('/patients/{id}', [PatientController::class, 'update'], [AuthenticationMiddleware::class]);

    // 5. Phase 9: Scheduling, Operating Hours & Availability Engine
    // Public/booking availability computation
    $r->get('/availability', [AvailabilityController::class, 'getAvailability']);
    $r->get('/clinic/hours', [ClinicScheduleController::class, 'getHours']);
    $r->get('/clinic/closures', [ClinicScheduleController::class, 'getClosures']);
    $r->get('/dentists/{id}/schedules', [DentistScheduleController::class, 'index']);
    $r->get('/dentists/{id}/time-off', [DentistTimeOffController::class, 'index']);

    // 6. Front Desk & Administrative Modules
    $adminOnlyAuth = [AuthenticationMiddleware::class, new AuthorizationMiddleware(['ADMIN'])];
    $receptionistAuth = [AuthenticationMiddleware::class, new AuthorizationMiddleware(['RECEPTIONIST', 'ADMIN'])];

    $staffPortalGuard = new AuthorizationMiddleware(['ADMIN', 'RECEPTIONIST', 'DENTIST']);
    $frontDeskGuard = new AuthorizationMiddleware(['RECEPTIONIST', 'ADMIN']);

    // Front Desk / Receptionist Dedicated Workspace Endpoints
    $r->get('/receptionist/dashboard', [ReceptionistController::class, 'dashboard'], [AuthenticationMiddleware::class, $frontDeskGuard, AuthorizationMiddleware::hasPermission('appointments.view', ['RECEPTIONIST', 'ADMIN'])]);
    $r->get('/receptionist/schedule/today', [ReceptionistController::class, 'todaySchedule'], [AuthenticationMiddleware::class, $frontDeskGuard, AuthorizationMiddleware::hasPermission('appointments.view', ['RECEPTIONIST', 'ADMIN'])]);
    $r->post('/receptionist/appointments/{id}/check-in', [ReceptionistController::class, 'checkIn'], [AuthenticationMiddleware::class, $frontDeskGuard, AuthorizationMiddleware::hasPermission('appointments.manage', ['RECEPTIONIST', 'ADMIN'])]);
    $r->patch('/receptionist/appointments/{id}/attendance', [ReceptionistController::class, 'updateAttendance'], [AuthenticationMiddleware::class, $frontDeskGuard, AuthorizationMiddleware::hasPermission('appointments.manage', ['RECEPTIONIST', 'ADMIN'])]);
    $r->get('/receptionist/waiting-list', [ReceptionistController::class, 'waitingList'], [AuthenticationMiddleware::class, $frontDeskGuard, AuthorizationMiddleware::hasPermission('appointments.view', ['RECEPTIONIST', 'ADMIN'])]);
    $r->post('/receptionist/patients', [ReceptionistController::class, 'registerPatient'], [AuthenticationMiddleware::class, $frontDeskGuard, AuthorizationMiddleware::hasPermission('patients.manage', ['RECEPTIONIST', 'ADMIN'])]);
    $r->post('/receptionist/appointments', [ReceptionistController::class, 'createAppointment'], [AuthenticationMiddleware::class, $frontDeskGuard, AuthorizationMiddleware::hasPermission('appointments.book', ['RECEPTIONIST', 'ADMIN'])]);

    // Admin Dashboard Aggregates & Operational Visibility (Phase 15)
    $r->get('/admin/dashboard', [DashboardController::class, 'metrics'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('dashboard.view', ['ADMIN'])]);
    $r->get('/admin/dashboard/summary', [DashboardController::class, 'metrics'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('dashboard.view', ['ADMIN'])]);
    $r->get('/admin/operations/outbox', [DashboardController::class, 'outboxOperations'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('system.health', ['ADMIN'])]);
    $r->get('/admin/operations/errors', [DashboardController::class, 'operationalErrors'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('system.health', ['ADMIN'])]);

    // Dental Services (Viewing for front desk scheduling; creation/updates restricted by DRBAC)
    $r->get('/admin/services', [ServiceController::class, 'index'], [AuthenticationMiddleware::class, $staffPortalGuard, AuthorizationMiddleware::hasPermission('services.view', ['RECEPTIONIST', 'ADMIN'])]);
    $r->get('/admin/services/{id}', [ServiceController::class, 'show'], [AuthenticationMiddleware::class, $staffPortalGuard, AuthorizationMiddleware::hasPermission('services.view', ['RECEPTIONIST', 'ADMIN'])]);
    $r->post('/admin/services', [ServiceController::class, 'create'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('services.manage', ['ADMIN'])]);
    $r->put('/admin/services/{id}', [ServiceController::class, 'update'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('services.manage', ['ADMIN'])]);
    $r->patch('/admin/services/{id}', [ServiceController::class, 'update'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('services.manage', ['ADMIN'])]);
    $r->patch('/admin/services/{id}/status', [ServiceController::class, 'updateStatus'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('services.manage', ['ADMIN'])]);

    // Dentists Roster (Viewing for front desk scheduling; creation/updates restricted by DRBAC)
    $r->get('/admin/dentists', [DentistController::class, 'index'], [AuthenticationMiddleware::class, $staffPortalGuard, AuthorizationMiddleware::hasPermission('dentists.view', ['RECEPTIONIST', 'ADMIN'])]);
    $r->get('/admin/dentists/{id}', [DentistController::class, 'show'], [AuthenticationMiddleware::class, $staffPortalGuard, AuthorizationMiddleware::hasPermission('dentists.view', ['RECEPTIONIST', 'ADMIN'])]);
    $r->post('/admin/dentists', [DentistController::class, 'create'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('dentists.manage', ['ADMIN'])]);
    $r->put('/admin/dentists/{id}', [DentistController::class, 'update'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('dentists.manage', ['ADMIN'])]);
    $r->patch('/admin/dentists/{id}', [DentistController::class, 'update'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('dentists.manage', ['ADMIN'])]);
    $r->patch('/admin/dentists/{id}/status', [DentistController::class, 'updateStatus'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('dentists.manage', ['ADMIN'])]);

    // Admin Clinic Operating Hours & Closures Management (Phase 9)
    $r->put('/admin/clinic/hours', [ClinicScheduleController::class, 'updateHours'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('settings.manage', ['ADMIN'])]);
    $r->get('/admin/clinic/closures', [ClinicScheduleController::class, 'getClosures'], [AuthenticationMiddleware::class, $staffPortalGuard, AuthorizationMiddleware::hasPermission('appointments.view', ['RECEPTIONIST', 'ADMIN'])]);
    $r->post('/admin/clinic/closures', [ClinicScheduleController::class, 'storeClosure'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('settings.manage', ['ADMIN'])]);
    $r->delete('/admin/clinic/closures/{id}', [ClinicScheduleController::class, 'destroyClosure'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('settings.manage', ['ADMIN'])]);

    // Dentist Schedules & Time-Off Inspection (Front Desk can view; modifications restricted by DRBAC)
    $r->get('/admin/dentists/{id}/schedules', [DentistScheduleController::class, 'index'], [AuthenticationMiddleware::class, $staffPortalGuard, AuthorizationMiddleware::hasPermission('dentists.view', ['RECEPTIONIST', 'ADMIN'])]);
    $r->post('/admin/dentists/{id}/schedules', [DentistScheduleController::class, 'store'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('dentists.manage', ['ADMIN'])]);
    $r->put('/admin/dentists/{id}/schedules/{scheduleId}', [DentistScheduleController::class, 'update'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('dentists.manage', ['ADMIN'])]);
    $r->delete('/admin/dentists/{id}/schedules/{scheduleId}', [DentistScheduleController::class, 'destroy'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('dentists.manage', ['ADMIN'])]);

    $r->get('/admin/dentists/{id}/time-off', [DentistTimeOffController::class, 'index'], [AuthenticationMiddleware::class, $staffPortalGuard, AuthorizationMiddleware::hasPermission('dentists.view', ['RECEPTIONIST', 'ADMIN'])]);
    $r->post('/admin/dentists/{id}/time-off', [DentistTimeOffController::class, 'store'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('dentists.manage', ['ADMIN'])]);
    $r->delete('/admin/dentists/{id}/time-off/{timeOffId}', [DentistTimeOffController::class, 'destroy'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('dentists.manage', ['ADMIN'])]);

    // Patients Directory (Front desk & Admin)
    $r->get('/admin/patients', [PatientController::class, 'index'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('patients.view', ['ADMIN', 'RECEPTIONIST'])]);
    $r->get('/admin/patients/{id}', [PatientController::class, 'show'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('patients.view', ['ADMIN', 'RECEPTIONIST'])]);
    $r->put('/admin/patients/{id}', [PatientController::class, 'update'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('patients.manage', ['ADMIN', 'RECEPTIONIST'])]);
    $r->patch('/admin/patients/{id}', [PatientController::class, 'update'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('patients.manage', ['ADMIN', 'RECEPTIONIST'])]);
    $r->patch('/admin/patients/{id}/status', [PatientController::class, 'updateStatus'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('users.manage', ['ADMIN'])]);

    // Appointments Lifecycle Review & Triage (Front Desk & Admin)
    $r->get('/admin/appointments', [AppointmentController::class, 'adminIndex'], [AuthenticationMiddleware::class, $staffPortalGuard, AuthorizationMiddleware::hasPermission('appointments.view', ['RECEPTIONIST', 'ADMIN'])]);
    $r->get('/admin/appointments/{id}', [AppointmentController::class, 'adminShow'], [AuthenticationMiddleware::class, $staffPortalGuard, AuthorizationMiddleware::hasPermission('appointments.view', ['RECEPTIONIST', 'ADMIN'])]);
    $r->patch('/admin/appointments/{id}/confirm', [AppointmentController::class, 'confirm'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('appointments.manage', ['RECEPTIONIST', 'ADMIN'])]);
    $r->patch('/admin/appointments/{id}/reject', [AppointmentController::class, 'reject'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('appointments.manage', ['RECEPTIONIST', 'ADMIN'])]);
    $r->patch('/admin/appointments/{id}/complete', [AppointmentController::class, 'complete'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('appointments.complete', ['ADMIN'])]);

    // User & Staff Account Management (Administrator Only)
    $r->get('/admin/users', [UserController::class, 'index'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('users.view', ['ADMIN'])]);
    $r->post('/admin/users', [UserController::class, 'store'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('users.manage', ['ADMIN'])]);
    $r->get('/admin/users/{id}', [UserController::class, 'show'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('users.view', ['ADMIN'])]);
    $r->patch('/admin/users/{id}/status', [UserController::class, 'updateStatus'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('users.manage', ['ADMIN'])]);
    $r->patch('/admin/users/{id}/role', [UserController::class, 'updateRole'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('users.manage', ['ADMIN'])]);

    // Dynamic Role-Based Access Control (DRBAC) Matrix (Administrator Only)
    $r->get('/admin/roles', [RolePermissionController::class, 'getRoles'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('roles.manage', ['ADMIN'])]);
    $r->get('/admin/permissions', [RolePermissionController::class, 'getPermissions'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('roles.manage', ['ADMIN'])]);
    $r->put('/admin/roles/{id}/permissions', [RolePermissionController::class, 'syncRolePermissions'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('roles.manage', ['ADMIN'])]);

    // Forensic Audit Logs & Security Events (Administrator Only)
    $r->get('/admin/audit-logs', [AuditLogController::class, 'index'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('audit_logs.view', ['ADMIN'])]);
    $r->get('/admin/audit-logs/export', [AuditLogController::class, 'export'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('audit_logs.export', ['ADMIN'])]);
    // Email outbox operations (explicit DRBAC permissions, no role fallback)
    $r->get('/admin/email-outbox/stats', [EmailOutboxController::class, 'stats'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('email_outbox.view')]);
    $r->get('/admin/email-outbox/jobs', [EmailOutboxController::class, 'index'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('email_outbox.view_failures')]);
    $r->get('/admin/email-outbox/jobs/{id}', [EmailOutboxController::class, 'show'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('email_outbox.view_failures')]);
    $r->post('/admin/email-outbox/jobs/{id}/retry', [EmailOutboxController::class, 'retry'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('email_outbox.retry')]);
    $r->post('/admin/email-outbox/jobs/{id}/abandon', [EmailOutboxController::class, 'abandon'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('email_outbox.manage')]);
    $r->get('/admin/security/events', [AuditLogController::class, 'securityEvents'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('audit_logs.view', ['ADMIN'])]);

    // Clinic Settings Configuration (Administrator Only)
    $r->get('/admin/clinic/settings', [ClinicSettingsController::class, 'index'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('settings.manage', ['ADMIN'])]);
    $r->put('/admin/clinic/settings', [ClinicSettingsController::class, 'update'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('settings.manage', ['ADMIN'])]);

    // Reports & Analytics (Administrator Only)
    $r->get('/admin/reports/appointments', [ReportController::class, 'appointments'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('reports.view', ['ADMIN'])]);
    $r->get('/admin/reports/services', [ReportController::class, 'services'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('reports.view', ['ADMIN'])]);
    $r->get('/admin/reports/patients', [ReportController::class, 'patients'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('reports.view', ['ADMIN'])]);
    $r->get('/admin/reports/revenue', [ReportController::class, 'revenue'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('reports.view', ['ADMIN'])]);
    $r->get('/admin/reports/dentists', [ReportController::class, 'dentists'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('reports.view', ['ADMIN'])]);

    // System Health Diagnostics (Administrator Only)
    $r->get('/admin/system/health', [HealthController::class, 'systemHealth'], [AuthenticationMiddleware::class, AuthorizationMiddleware::hasPermission('system.health', ['ADMIN'])]);

    // 7. Patient Appointment Booking & Lifecycle (Phase 10)
    $patientAuth = [AuthenticationMiddleware::class];
    $r->get('/patient/dashboard', [AppointmentController::class, 'patientDashboard'], $patientAuth);
    $r->post('/appointments', [AppointmentController::class, 'book'], $patientAuth);
    $r->get('/appointments', [AppointmentController::class, 'index'], $patientAuth);
    $r->get('/appointments/search', [AppointmentController::class, 'search'], $patientAuth);
    $r->get('/appointments/{id}', [AppointmentController::class, 'show'], $patientAuth);
    $r->post('/appointments/{id}/cancel', [AppointmentController::class, 'cancel'], $patientAuth);
    $r->post('/appointments/{id}/reschedule', [AppointmentController::class, 'reschedule'], $patientAuth);

    // Dentist Scoped Endpoints (Phase 12 Dentist Dashboard & Assigned Workload)
    $dentistAuth = [AuthenticationMiddleware::class, new AuthorizationMiddleware(['DENTIST', 'ADMIN'])];
    $r->get('/dentist/profile', [DentistController::class, 'me'], $dentistAuth);
    $r->patch('/dentist/profile', [DentistController::class, 'updateMe'], $dentistAuth);
    $r->get('/dentist/profile/avatar', [DentistController::class, 'serveMyAvatar'], $dentistAuth);
    $r->post('/dentist/profile/avatar', [DentistController::class, 'uploadMyAvatar'], $dentistAuth);
    $r->delete('/dentist/profile/avatar', [DentistController::class, 'deleteMyAvatar'], $dentistAuth);
    $r->get('/dentist/dashboard', [AppointmentController::class, 'dentistDashboard'], [AuthenticationMiddleware::class, new AuthorizationMiddleware(['DENTIST', 'ADMIN']), AuthorizationMiddleware::hasPermission('appointments.view', ['DENTIST', 'ADMIN'])]);
    $r->get('/dentist/appointments', [AppointmentController::class, 'dentistIndex'], [AuthenticationMiddleware::class, new AuthorizationMiddleware(['DENTIST', 'ADMIN']), AuthorizationMiddleware::hasPermission('appointments.view', ['DENTIST', 'ADMIN'])]);
    $r->get('/dentist/appointments/{id}', [AppointmentController::class, 'dentistShow'], [AuthenticationMiddleware::class, new AuthorizationMiddleware(['DENTIST', 'ADMIN']), AuthorizationMiddleware::hasPermission('appointments.view', ['DENTIST', 'ADMIN'])]);
    $r->patch('/dentist/appointments/{id}/complete', [AppointmentController::class, 'dentistComplete'], [AuthenticationMiddleware::class, new AuthorizationMiddleware(['DENTIST', 'ADMIN']), AuthorizationMiddleware::hasPermission('appointments.complete', ['DENTIST', 'ADMIN'])]);
    $r->post('/dentist/appointments/{id}/complete', [AppointmentController::class, 'dentistComplete'], [AuthenticationMiddleware::class, new AuthorizationMiddleware(['DENTIST', 'ADMIN']), AuthorizationMiddleware::hasPermission('appointments.complete', ['DENTIST', 'ADMIN'])]);
    $r->post('/dentist/time-off', [DentistTimeOffController::class, 'requestTimeOff'], $dentistAuth);

    // Treatment Records Group (Phase 12 Treatment Records & Clinical Documentation)
    $r->get('/treatment-records', [TreatmentRecordController::class, 'index'], [AuthenticationMiddleware::class, new AuthorizationMiddleware(['DENTIST', 'ADMIN']), AuthorizationMiddleware::hasPermission('treatment_records.view', ['DENTIST', 'ADMIN'])]);
    $r->post('/treatment-records', [TreatmentRecordController::class, 'create'], [AuthenticationMiddleware::class, new AuthorizationMiddleware(['DENTIST', 'ADMIN']), AuthorizationMiddleware::hasPermission('treatment_records.create', ['DENTIST', 'ADMIN'])]);
    $r->get('/treatment-records/{id}', [TreatmentRecordController::class, 'show'], [AuthenticationMiddleware::class, new AuthorizationMiddleware(['DENTIST', 'ADMIN']), AuthorizationMiddleware::hasPermission('treatment_records.view', ['DENTIST', 'ADMIN'])]);
    $r->patch('/treatment-records/{id}', [TreatmentRecordController::class, 'update'], [AuthenticationMiddleware::class, new AuthorizationMiddleware(['DENTIST', 'ADMIN']), AuthorizationMiddleware::hasPermission('treatment_records.amend', ['DENTIST', 'ADMIN'])]);
    $r->put('/treatment-records/{id}', [TreatmentRecordController::class, 'update'], [AuthenticationMiddleware::class, new AuthorizationMiddleware(['DENTIST', 'ADMIN']), AuthorizationMiddleware::hasPermission('treatment_records.amend', ['DENTIST', 'ADMIN'])]);
    $r->get('/appointments/{id}/treatment-record', [TreatmentRecordController::class, 'showByAppointment'], [AuthenticationMiddleware::class, new AuthorizationMiddleware(['DENTIST', 'ADMIN']), AuthorizationMiddleware::hasPermission('treatment_records.view', ['DENTIST', 'ADMIN'])]);

    // 8. Future Phases - Structured Placeholders
    $notImplemented = fn (string $name) => function (Request $req) use ($name) {
        throw HttpException::notImplemented("Endpoint '{$name}' is planned for Phase 13+ implementation.");
    };

    // Future Patient self-listing or public directory
    $r->get('/patients', $notImplemented('GET /api/v1/patients'));
    $r->post('/patients', $notImplemented('POST /api/v1/patients'));

    // Notifications Group (Phase 11 Persistent In-App Notifications)
    $r->get('/notifications', [NotificationController::class, 'index'], $patientAuth);
    $r->get('/notifications/unread-count', [NotificationController::class, 'unreadCount'], $patientAuth);
    $r->patch('/notifications/{id}/read', [NotificationController::class, 'markRead'], $patientAuth);
    $r->post('/notifications/read-all', [NotificationController::class, 'markAllRead'], $patientAuth);
    $r->patch('/notifications/read-all', [NotificationController::class, 'markAllRead'], $patientAuth);

    // Reports Group
    $r->get('/reports/overview', $notImplemented('GET /api/v1/reports/overview'));
    $r->get('/reports/appointments', $notImplemented('GET /api/v1/reports/appointments'));

    // Realtime Ticket & Internal Service-to-Service Verification Group (Phase 14)
    $r->post('/realtime/ticket', [RealtimeController::class, 'issueTicket'], [AuthenticationMiddleware::class]);
    $r->post('/internal/realtime/tickets/verify', [RealtimeController::class, 'verifyTicket']);
    $r->post('/internal/realtime/sessions/verify', [RealtimeController::class, 'verifySession']);
});
