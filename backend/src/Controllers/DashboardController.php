<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
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
        $user = $request->getUser();
        if ($user === null) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        if (strtoupper((string) $user['role']) !== 'ADMIN') {
            throw HttpException::forbidden('Administrative access required.', 'FORBIDDEN');
        }

        $metrics = $this->dashboardRepository->getMetrics();

        return Response::success($metrics);
    }
}
