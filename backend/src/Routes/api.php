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
use App\Controllers\PatientController;
use App\Controllers\ServiceController;
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

    // 4. Patients Self-Management Group (Phase 7 ownership checks)
    $r->get('/patients/{id}', [PatientController::class, 'show'], [AuthenticationMiddleware::class]);
    $r->patch('/patients/{id}', [PatientController::class, 'update'], [AuthenticationMiddleware::class]);

    // 5. Phase 9: Scheduling, Operating Hours & Availability Engine
    // Public/booking availability computation
    $r->get('/availability', [AvailabilityController::class, 'getAvailability']);
    $r->get('/clinic/hours', [ClinicScheduleController::class, 'getHours']);
    $r->get('/clinic/closures', [ClinicScheduleController::class, 'getClosures']);
    $r->get('/dentists/{id}/schedules', [DentistScheduleController::class, 'index']);
    $r->get('/dentists/{id}/time-off', [DentistTimeOffController::class, 'index']);

    // 6. Administrative Modules (Phase 8 & 9 Master CRUD)
    $adminAuth = [AuthenticationMiddleware::class, new AuthorizationMiddleware(['ADMIN'])];

    // Admin Dashboard Aggregates
    $r->get('/admin/dashboard', [DashboardController::class, 'metrics'], $adminAuth);

    // Admin Dental Services CRUD
    $r->get('/admin/services', [ServiceController::class, 'index'], $adminAuth);
    $r->post('/admin/services', [ServiceController::class, 'create'], $adminAuth);
    $r->get('/admin/services/{id}', [ServiceController::class, 'show'], $adminAuth);
    $r->put('/admin/services/{id}', [ServiceController::class, 'update'], $adminAuth);
    $r->patch('/admin/services/{id}', [ServiceController::class, 'update'], $adminAuth);
    $r->patch('/admin/services/{id}/status', [ServiceController::class, 'updateStatus'], $adminAuth);

    // Admin Dentists CRUD
    $r->get('/admin/dentists', [DentistController::class, 'index'], $adminAuth);
    $r->post('/admin/dentists', [DentistController::class, 'create'], $adminAuth);
    $r->get('/admin/dentists/{id}', [DentistController::class, 'show'], $adminAuth);
    $r->put('/admin/dentists/{id}', [DentistController::class, 'update'], $adminAuth);
    $r->patch('/admin/dentists/{id}', [DentistController::class, 'update'], $adminAuth);
    $r->patch('/admin/dentists/{id}/status', [DentistController::class, 'updateStatus'], $adminAuth);

    // Admin Clinic Operating Hours & Closures Management (Phase 9)
    $r->put('/admin/clinic/hours', [ClinicScheduleController::class, 'updateHours'], $adminAuth);
    $r->get('/admin/clinic/closures', [ClinicScheduleController::class, 'getClosures'], $adminAuth);
    $r->post('/admin/clinic/closures', [ClinicScheduleController::class, 'storeClosure'], $adminAuth);
    $r->delete('/admin/clinic/closures/{id}', [ClinicScheduleController::class, 'destroyClosure'], $adminAuth);

    // Admin Dentist Schedules Management (Phase 9)
    $r->get('/admin/dentists/{id}/schedules', [DentistScheduleController::class, 'index'], $adminAuth);
    $r->post('/admin/dentists/{id}/schedules', [DentistScheduleController::class, 'store'], $adminAuth);
    $r->put('/admin/dentists/{id}/schedules/{scheduleId}', [DentistScheduleController::class, 'update'], $adminAuth);
    $r->delete('/admin/dentists/{id}/schedules/{scheduleId}', [DentistScheduleController::class, 'destroy'], $adminAuth);

    // Admin Dentist Time-Off Management (Phase 9)
    $r->get('/admin/dentists/{id}/time-off', [DentistTimeOffController::class, 'index'], $adminAuth);
    $r->post('/admin/dentists/{id}/time-off', [DentistTimeOffController::class, 'store'], $adminAuth);
    $r->delete('/admin/dentists/{id}/time-off/{timeOffId}', [DentistTimeOffController::class, 'destroy'], $adminAuth);

    // Admin Patients Management
    $r->get('/admin/patients', [PatientController::class, 'index'], $adminAuth);
    $r->get('/admin/patients/{id}', [PatientController::class, 'show'], $adminAuth);
    $r->put('/admin/patients/{id}', [PatientController::class, 'update'], $adminAuth);
    $r->patch('/admin/patients/{id}', [PatientController::class, 'update'], $adminAuth);
    $r->patch('/admin/patients/{id}/status', [PatientController::class, 'updateStatus'], $adminAuth);

    // Admin Appointments Lifecycle Review (Phase 10)
    $r->get('/admin/appointments', [AppointmentController::class, 'adminIndex'], $adminAuth);
    $r->get('/admin/appointments/{id}', [AppointmentController::class, 'adminShow'], $adminAuth);
    $r->patch('/admin/appointments/{id}/confirm', [AppointmentController::class, 'confirm'], $adminAuth);
    $r->patch('/admin/appointments/{id}/reject', [AppointmentController::class, 'reject'], $adminAuth);
    $r->patch('/admin/appointments/{id}/complete', [AppointmentController::class, 'complete'], $adminAuth);

    // Admin Audit Logs
    $r->get('/admin/audit-logs', function (Request $req): Response {
        $user = $req->getUser();
        return Response::success([
            'message' => 'Admin audit logs accessed successfully.',
            'actor' => $user['email'] ?? 'admin',
        ]);
    }, $adminAuth);

    // 7. Patient Appointment Booking & Lifecycle (Phase 10)
    $patientAuth = [AuthenticationMiddleware::class];
    $r->post('/appointments', [AppointmentController::class, 'book'], $patientAuth);
    $r->get('/appointments', [AppointmentController::class, 'index'], $patientAuth);
    $r->get('/appointments/{id}', [AppointmentController::class, 'show'], $patientAuth);
    $r->post('/appointments/{id}/cancel', [AppointmentController::class, 'cancel'], $patientAuth);
    $r->post('/appointments/{id}/reschedule', [AppointmentController::class, 'reschedule'], $patientAuth);

    // 8. Future Phases - Structured Placeholders
    $notImplemented = fn (string $name) => function (Request $req) use ($name) {
        throw HttpException::notImplemented("Endpoint '{$name}' is planned for Phase 11+ implementation.");
    };

    // Future Patient self-listing or public directory
    $r->get('/patients', $notImplemented('GET /api/v1/patients'));
    $r->post('/patients', $notImplemented('POST /api/v1/patients'));

    // Treatment Records Group
    $r->get('/treatment-records', $notImplemented('GET /api/v1/treatment-records'));
    $r->post('/treatment-records', $notImplemented('POST /api/v1/treatment-records'));
    $r->get('/treatment-records/{id}', $notImplemented('GET /api/v1/treatment-records/{id}'));
    $r->patch('/treatment-records/{id}', $notImplemented('PATCH /api/v1/treatment-records/{id}'));

    // Notifications Group
    $r->get('/notifications', $notImplemented('GET /api/v1/notifications'));
    $r->patch('/notifications/{id}/read', $notImplemented('PATCH /api/v1/notifications/{id}/read'));

    // Reports Group
    $r->get('/reports/overview', $notImplemented('GET /api/v1/reports/overview'));
    $r->get('/reports/appointments', $notImplemented('GET /api/v1/reports/appointments'));

    // Realtime Ticket Group
    $r->post('/realtime/ticket', $notImplemented('POST /api/v1/realtime/ticket'));
});
