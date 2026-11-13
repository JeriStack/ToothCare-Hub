<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthorizationMiddleware;
use App\Repositories\DashboardRepository;

/**
 * Administrative Dashboard Controller
 * Provides real-time aggregated metrics for operational clinic intelligence.
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
     * Retrieve aggregated statistics for patients, dentists, services, and appointments.
     */
    public function metrics(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'dashboard.view', ['ADMIN']);

        $metrics = $this->dashboardRepository->getMetrics();

        return Response::success($metrics);
    }
}
