<?php

declare(strict_types=1);

use App\Controllers\AuthController;
use App\Controllers\DashboardController;
use App\Controllers\DentistController;
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

    // 5. Administrative Modules (Phase 8 Master CRUD)
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

    // Admin Patients Management
    $r->get('/admin/patients', [PatientController::class, 'index'], $adminAuth);
    $r->get('/admin/patients/{id}', [PatientController::class, 'show'], $adminAuth);
    $r->put('/admin/patients/{id}', [PatientController::class, 'update'], $adminAuth);
    $r->patch('/admin/patients/{id}', [PatientController::class, 'update'], $adminAuth);
    $r->patch('/admin/patients/{id}/status', [PatientController::class, 'updateStatus'], $adminAuth);

    // Admin Audit Logs
    $r->get('/admin/audit-logs', function (Request $req): Response {
        $user = $req->getUser();
        return Response::success([
            'message' => 'Admin audit logs accessed successfully.',
            'actor' => $user['email'] ?? 'admin',
        ]);
    }, $adminAuth);

    // 6. Future Phases - Structured Placeholders
    $notImplemented = fn (string $name) => function (Request $req) use ($name) {
        throw HttpException::notImplemented("Endpoint '{$name}' is planned for Phase 9+ implementation.");
    };

    // Future Patient self-listing or public directory (Phase 9+)
    $r->get('/patients', $notImplemented('GET /api/v1/patients'));
    $r->post('/patients', $notImplemented('POST /api/v1/patients'));

    // Availability & Slots Query
    $r->get('/availability', $notImplemented('GET /api/v1/availability'));

    // Appointments Lifecycle Group
    $r->get('/appointments', $notImplemented('GET /api/v1/appointments'));
    $r->post('/appointments', $notImplemented('POST /api/v1/appointments'));
    $r->get('/appointments/{id}', $notImplemented('GET /api/v1/appointments/{id}'));
    $r->patch('/appointments/{id}', $notImplemented('PATCH /api/v1/appointments/{id}'));
    $r->post('/appointments/{id}/cancel', $notImplemented('POST /api/v1/appointments/{id}/cancel'));
    $r->post('/appointments/{id}/reschedule', $notImplemented('POST /api/v1/appointments/{id}/reschedule'));

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
