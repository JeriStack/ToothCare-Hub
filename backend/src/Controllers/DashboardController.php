<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthorizationMiddleware;
use App\Repositories\DashboardRepository;

/**
 * Administrative Dashboard & Operational Views Controller
 * Provides real-time aggregated metrics, outbox monitoring, and safe operational error feeds.
 */
class DashboardController
{
    private DashboardRepository $dashboardRepository;

    public function __construct(?DashboardRepository $dashboardRepository = null)
    {
        $this->dashboardRepository = $dashboardRepository ?? new DashboardRepository();
    }

    /**
     * GET /api/v1/admin/dashboard
     * GET /api/v1/admin/dashboard/summary
     * Retrieve aggregated statistics for patients, dentists, services, appointments, and operations.
     */
    public function metrics(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'dashboard.view', ['ADMIN']);

        $metrics = $this->dashboardRepository->getMetrics();

        return Response::success($metrics);
    }

    /**
     * GET /api/v1/admin/operations/outbox
     * Read-only paginated outbox status and job listing across email & realtime delivery queues.
     */
    public function outboxOperations(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'system.health', ['ADMIN']);

        $channel = strtolower(trim((string) ($request->getQuery('channel') ?? 'email')));
        if (!in_array($channel, ['email', 'realtime'], true)) {
            throw HttpException::unprocessableEntity('Invalid outbox channel. Allowed values: email, realtime.');
        }

        $status = $request->getQuery('status');
        $status = is_string($status) && trim($status) !== '' ? strtoupper(trim($status)) : null;

        $page = max(1, (int) ($request->getQuery('page') ?? 1));
        $rawLimit = $request->getQuery('per_page') ?? $request->getQuery('limit') ?? 20;
        $perPage = max(1, min(100, (int) $rawLimit));

        $result = $this->dashboardRepository->getOutboxJobs($channel, $status, $page, $perPage);

        return Response::success([
            'channel' => $channel,
            'summary' => $result['summary'],
            'items' => $result['items'],
            'pagination' => [
                'current_page' => $result['meta']['page'],
                'per_page' => $result['meta']['per_page'],
                'total' => $result['meta']['total'],
                'total_pages' => $result['meta']['last_page'],
            ],
        ]);
    }

    /**
     * GET /api/v1/admin/operations/errors
     * Safe, paginated operational error feed (redacted — never exposes stack traces or credentials).
     */
    public function operationalErrors(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'system.health', ['ADMIN']);

        $page = max(1, (int) ($request->getQuery('page') ?? 1));
        $rawLimit = $request->getQuery('per_page') ?? $request->getQuery('limit') ?? 20;
        $perPage = max(1, min(100, (int) $rawLimit));

        $result = $this->dashboardRepository->getOperationalErrors($page, $perPage);

        return Response::paginated($result['items'], $result['meta']);
    }
}
