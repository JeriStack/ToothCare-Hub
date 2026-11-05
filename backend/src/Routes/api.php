<?php

declare(strict_types=1);

use App\Controllers\HealthController;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Router;

/**
 * ToothCare Hub API Route Definitions
 * Versioned under /api/v1
 */

/** @var Router $router */

// Root health and metrics aliases for container orchestrators
$router->get('/health', [HealthController::class, 'check']);
$router->get('/metrics', [\App\Controllers\MetricsController::class, 'metrics']);

$router->group('/api/v1', function (Router $r): void {
    // 1. Health & Liveness (Implemented in Phase 5)
    $r->get('/health', [HealthController::class, 'check']);
    $r->get('/metrics', [\App\Controllers\MetricsController::class, 'metrics']);

    // 2. Authentication & Session Group (Planned for Phase 6)
    $notImplemented = fn (string $name) => function (Request $req) use ($name) {
        throw HttpException::notImplemented("Endpoint '{$name}' is planned for Phase 6+ implementation.");
    };

    $r->post('/auth/register', $notImplemented('POST /api/v1/auth/register'));
    $r->post('/auth/login', $notImplemented('POST /api/v1/auth/login'));
    $r->post('/auth/logout', $notImplemented('POST /api/v1/auth/logout'));
    $r->get('/auth/csrf-token', function (Request $req) {
        $token = \App\Middleware\CsrfMiddleware::getToken();
        return \App\Core\Response::success(['csrf_token' => $token]);
    });
    $r->post('/auth/verify-email', $notImplemented('POST /api/v1/auth/verify-email'));
    $r->post('/auth/forgot-password', $notImplemented('POST /api/v1/auth/forgot-password'));
    $r->post('/auth/reset-password', $notImplemented('POST /api/v1/auth/reset-password'));

    // 3. Patients Management Group
    $r->get('/patients', $notImplemented('GET /api/v1/patients'));
    $r->post('/patients', $notImplemented('POST /api/v1/patients'));
    $r->get('/patients/{id}', $notImplemented('GET /api/v1/patients/{id}'));
    $r->patch('/patients/{id}', $notImplemented('PATCH /api/v1/patients/{id}'));

    // 4. Dentists & Schedule Group
    $r->get('/dentists', $notImplemented('GET /api/v1/dentists'));
    $r->post('/dentists', $notImplemented('POST /api/v1/dentists'));
    $r->get('/dentists/{id}', $notImplemented('GET /api/v1/dentists/{id}'));
    $r->patch('/dentists/{id}', $notImplemented('PATCH /api/v1/dentists/{id}'));

    // 5. Clinic Services Group
    $r->get('/services', $notImplemented('GET /api/v1/services'));
    $r->post('/services', $notImplemented('POST /api/v1/services'));
    $r->get('/services/{id}', $notImplemented('GET /api/v1/services/{id}'));
    $r->patch('/services/{id}', $notImplemented('PATCH /api/v1/services/{id}'));
    $r->delete('/services/{id}', $notImplemented('DELETE /api/v1/services/{id}'));

    // 6. Availability & Slots Query
    $r->get('/availability', $notImplemented('GET /api/v1/availability'));

    // 7. Appointments Lifecycle Group
    $r->get('/appointments', $notImplemented('GET /api/v1/appointments'));
    $r->post('/appointments', $notImplemented('POST /api/v1/appointments'));
    $r->get('/appointments/{id}', $notImplemented('GET /api/v1/appointments/{id}'));
    $r->patch('/appointments/{id}', $notImplemented('PATCH /api/v1/appointments/{id}'));
    $r->post('/appointments/{id}/cancel', $notImplemented('POST /api/v1/appointments/{id}/cancel'));
    $r->post('/appointments/{id}/reschedule', $notImplemented('POST /api/v1/appointments/{id}/reschedule'));

    // 8. Treatment Records Group
    $r->get('/treatment-records', $notImplemented('GET /api/v1/treatment-records'));
    $r->post('/treatment-records', $notImplemented('POST /api/v1/treatment-records'));
    $r->get('/treatment-records/{id}', $notImplemented('GET /api/v1/treatment-records/{id}'));
    $r->patch('/treatment-records/{id}', $notImplemented('PATCH /api/v1/treatment-records/{id}'));

    // 9. Notifications Group
    $r->get('/notifications', $notImplemented('GET /api/v1/notifications'));
    $r->patch('/notifications/{id}/read', $notImplemented('PATCH /api/v1/notifications/{id}/read'));

    // 10. Reports Group
    $r->get('/reports/overview', $notImplemented('GET /api/v1/reports/overview'));
    $r->get('/reports/appointments', $notImplemented('GET /api/v1/reports/appointments'));

    // 11. Realtime Ticket Group
    $r->post('/realtime/ticket', $notImplemented('POST /api/v1/realtime/ticket'));
});
