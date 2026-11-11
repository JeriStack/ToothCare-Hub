<?php

declare(strict_types=1);

use App\Controllers\AppointmentController;
use App\Controllers\AuthController;
use App\Controllers\AvailabilityController;
use App\Controllers\ClinicScheduleController;
use App\Controllers\DashboardController;
use App\Controllers\DentistController;
use App\Controllers\DentistScheduleController;
use App\Controllers\DentistTimeOffController;
use App\Controllers\HealthController;
use App\Controllers\MetricsController;
use App\Controllers\NotificationController;
use App\Controllers\PatientController;
use App\Controllers\ReceptionistController;
use App\Controllers\ServiceController;
use App\Controllers\TreatmentRecordController;
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

    // 3. Public Catalog Endpoints (Active items for booking/discovery)
    $r->get('/services', [ServiceController::class, 'listPublic']);
    $r->get('/dentists', [DentistController::class, 'listPublic']);
    $r->get('/dentists/{id}', [DentistController::class, 'showPublic']);

    // 4. Patients Self-Management Group (Phase 7 & 11 ownership checks)
    $r->get('/patients/me', [PatientController::class, 'me'], [AuthenticationMiddleware::class]);
    $r->patch('/patients/me', [PatientController::class, 'updateMe'], [AuthenticationMiddleware::class]);
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

    // Front Desk / Receptionist Dedicated Workspace Endpoints
    $r->get('/receptionist/dashboard', [ReceptionistController::class, 'dashboard'], $receptionistAuth);
    $r->get('/receptionist/schedule/today', [ReceptionistController::class, 'todaySchedule'], $receptionistAuth);
    $r->post('/receptionist/appointments/{id}/check-in', [ReceptionistController::class, 'checkIn'], $receptionistAuth);
    $r->patch('/receptionist/appointments/{id}/attendance', [ReceptionistController::class, 'updateAttendance'], $receptionistAuth);
    $r->get('/receptionist/waiting-list', [ReceptionistController::class, 'waitingList'], $receptionistAuth);
    $r->post('/receptionist/patients', [ReceptionistController::class, 'registerPatient'], $receptionistAuth);
    $r->post('/receptionist/appointments', [ReceptionistController::class, 'createAppointment'], $receptionistAuth);

    // Admin Dashboard Aggregates
    $r->get('/admin/dashboard', [DashboardController::class, 'metrics'], $adminOnlyAuth);

    // Dental Services (Viewing for front desk scheduling; creation/updates restricted to Admin)
    $r->get('/admin/services', [ServiceController::class, 'index'], $receptionistAuth);
    $r->get('/admin/services/{id}', [ServiceController::class, 'show'], $receptionistAuth);
    $r->post('/admin/services', [ServiceController::class, 'create'], $adminOnlyAuth);
    $r->put('/admin/services/{id}', [ServiceController::class, 'update'], $adminOnlyAuth);
    $r->patch('/admin/services/{id}', [ServiceController::class, 'update'], $adminOnlyAuth);
    $r->patch('/admin/services/{id}/status', [ServiceController::class, 'updateStatus'], $adminOnlyAuth);

    // Dentists Roster (Viewing for front desk scheduling; creation/updates restricted to Admin)
    $r->get('/admin/dentists', [DentistController::class, 'index'], $receptionistAuth);
    $r->get('/admin/dentists/{id}', [DentistController::class, 'show'], $receptionistAuth);
    $r->post('/admin/dentists', [DentistController::class, 'create'], $adminOnlyAuth);
    $r->put('/admin/dentists/{id}', [DentistController::class, 'update'], $adminOnlyAuth);
    $r->patch('/admin/dentists/{id}', [DentistController::class, 'update'], $adminOnlyAuth);
    $r->patch('/admin/dentists/{id}/status', [DentistController::class, 'updateStatus'], $adminOnlyAuth);

    // Admin Clinic Operating Hours & Closures Management (Phase 9)
    $r->put('/admin/clinic/hours', [ClinicScheduleController::class, 'updateHours'], $adminOnlyAuth);
    $r->get('/admin/clinic/closures', [ClinicScheduleController::class, 'getClosures'], $receptionistAuth);
    $r->post('/admin/clinic/closures', [ClinicScheduleController::class, 'storeClosure'], $adminOnlyAuth);
    $r->delete('/admin/clinic/closures/{id}', [ClinicScheduleController::class, 'destroyClosure'], $adminOnlyAuth);

    // Dentist Schedules & Time-Off Inspection (Front Desk can view; modifications restricted to Admin)
    $r->get('/admin/dentists/{id}/schedules', [DentistScheduleController::class, 'index'], $receptionistAuth);
    $r->post('/admin/dentists/{id}/schedules', [DentistScheduleController::class, 'store'], $adminOnlyAuth);
    $r->put('/admin/dentists/{id}/schedules/{scheduleId}', [DentistScheduleController::class, 'update'], $adminOnlyAuth);
    $r->delete('/admin/dentists/{id}/schedules/{scheduleId}', [DentistScheduleController::class, 'destroy'], $adminOnlyAuth);

    $r->get('/admin/dentists/{id}/time-off', [DentistTimeOffController::class, 'index'], $receptionistAuth);
    $r->post('/admin/dentists/{id}/time-off', [DentistTimeOffController::class, 'store'], $adminOnlyAuth);
    $r->delete('/admin/dentists/{id}/time-off/{timeOffId}', [DentistTimeOffController::class, 'destroy'], $adminOnlyAuth);

    // Patients Directory (Front desk & Admin)
    $r->get('/admin/patients', [PatientController::class, 'index'], $receptionistAuth);
    $r->get('/admin/patients/{id}', [PatientController::class, 'show'], $receptionistAuth);
    $r->put('/admin/patients/{id}', [PatientController::class, 'update'], $receptionistAuth);
    $r->patch('/admin/patients/{id}', [PatientController::class, 'update'], $receptionistAuth);
    $r->patch('/admin/patients/{id}/status', [PatientController::class, 'updateStatus'], $adminOnlyAuth);

    // Appointments Lifecycle Review & Triage (Front Desk & Admin)
    $r->get('/admin/appointments', [AppointmentController::class, 'adminIndex'], $receptionistAuth);
    $r->get('/admin/appointments/{id}', [AppointmentController::class, 'adminShow'], $receptionistAuth);
    $r->patch('/admin/appointments/{id}/confirm', [AppointmentController::class, 'confirm'], $receptionistAuth);
    $r->patch('/admin/appointments/{id}/reject', [AppointmentController::class, 'reject'], $receptionistAuth);
    $r->patch('/admin/appointments/{id}/complete', [AppointmentController::class, 'complete'], $adminOnlyAuth);

    // Admin Audit Logs (Strictly Administrator)
    $r->get('/admin/audit-logs', function (Request $req): Response {
        $user = $req->getUser();
        return Response::success([
            'message' => 'Admin audit logs accessed successfully.',
            'actor' => $user['email'] ?? 'admin',
        ]);
    }, $adminOnlyAuth);

    // 7. Patient Appointment Booking & Lifecycle (Phase 10)
    $patientAuth = [AuthenticationMiddleware::class];
    $r->get('/patient/dashboard', [AppointmentController::class, 'patientDashboard'], $patientAuth);
    $r->post('/appointments', [AppointmentController::class, 'book'], $patientAuth);
    $r->get('/appointments', [AppointmentController::class, 'index'], $patientAuth);
    $r->get('/appointments/{id}', [AppointmentController::class, 'show'], $patientAuth);
    $r->post('/appointments/{id}/cancel', [AppointmentController::class, 'cancel'], $patientAuth);
    $r->post('/appointments/{id}/reschedule', [AppointmentController::class, 'reschedule'], $patientAuth);

    // Dentist Scoped Endpoints (Phase 12 Dentist Dashboard & Assigned Workload)
    $dentistAuth = [AuthenticationMiddleware::class, new AuthorizationMiddleware(['DENTIST', 'ADMIN'])];
    $r->get('/dentist/dashboard', [AppointmentController::class, 'dentistDashboard'], $dentistAuth);
    $r->get('/dentist/appointments', [AppointmentController::class, 'dentistIndex'], $dentistAuth);
    $r->get('/dentist/appointments/{id}', [AppointmentController::class, 'dentistShow'], $dentistAuth);
    $r->patch('/dentist/appointments/{id}/complete', [AppointmentController::class, 'dentistComplete'], $dentistAuth);
    $r->post('/dentist/appointments/{id}/complete', [AppointmentController::class, 'dentistComplete'], $dentistAuth);
    $r->post('/dentist/time-off', [DentistTimeOffController::class, 'requestTimeOff'], $dentistAuth);

    // Treatment Records Group (Phase 12 Treatment Records & Clinical Documentation)
    $r->get('/treatment-records', [TreatmentRecordController::class, 'index'], $dentistAuth);
    $r->post('/treatment-records', [TreatmentRecordController::class, 'create'], $dentistAuth);
    $r->get('/treatment-records/{id}', [TreatmentRecordController::class, 'show'], $dentistAuth);
    $r->patch('/treatment-records/{id}', [TreatmentRecordController::class, 'update'], $dentistAuth);
    $r->put('/treatment-records/{id}', [TreatmentRecordController::class, 'update'], $dentistAuth);
    $r->get('/appointments/{id}/treatment-record', [TreatmentRecordController::class, 'showByAppointment'], $dentistAuth);

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

    // Realtime Ticket Group
    $r->post('/realtime/ticket', $notImplemented('POST /api/v1/realtime/ticket'));
});
