<?php

declare(strict_types=1);

use App\Controllers\AuthController;
use App\Controllers\HealthController;
use App\Controllers\MetricsController;
use App\Controllers\PatientController;
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

    // 3. Patients Management Group (Implemented Ownership checks in Phase 7)
    $r->get('/patients/{id}', [PatientController::class, 'show'], [AuthenticationMiddleware::class]);
    $r->patch('/patients/{id}', [PatientController::class, 'update'], [AuthenticationMiddleware::class]);

    // 4. Administrative RBAC verification route
    $r->get('/admin/audit-logs', function (Request $req): Response {
        $user = $req->getUser();
        return Response::success([
            'message' => 'Admin audit logs accessed successfully.',
            'actor' => $user['email'] ?? 'admin',
        ]);
    }, [AuthenticationMiddleware::class, new AuthorizationMiddleware(['ADMIN'])]);

    // 5. Future Phases - Structured Placeholders
    $notImplemented = fn (string $name) => function (Request $req) use ($name) {
        throw HttpException::notImplemented("Endpoint '{$name}' is planned for Phase 8+ implementation.");
    };

    $r->get('/patients', $notImplemented('GET /api/v1/patients'));
    $r->post('/patients', $notImplemented('POST /api/v1/patients'));

    // Dentists & Schedule Group
    $r->get('/dentists', $notImplemented('GET /api/v1/dentists'));
    $r->post('/dentists', $notImplemented('POST /api/v1/dentists'));
    $r->get('/dentists/{id}', $notImplemented('GET /api/v1/dentists/{id}'));
    $r->patch('/dentists/{id}', $notImplemented('PATCH /api/v1/dentists/{id}'));

    // Clinic Services Group
    $r->get('/services', $notImplemented('GET /api/v1/services'));
    $r->post('/services', $notImplemented('POST /api/v1/services'));
    $r->get('/services/{id}', $notImplemented('GET /api/v1/services/{id}'));
    $r->patch('/services/{id}', $notImplemented('PATCH /api/v1/services/{id}'));
    $r->delete('/services/{id}', $notImplemented('DELETE /api/v1/services/{id}'));

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
