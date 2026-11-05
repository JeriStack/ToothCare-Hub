<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Services\AvailabilityService;
use App\Validators\ScheduleValidator;

/**
 * Public & Patient Availability Controller
 * Computes bookable appointment slots for practitioners and dental services.
 */
class AvailabilityController
{
    private AvailabilityService $availabilityService;

    public function __construct(?AvailabilityService $availabilityService = null)
    {
        $this->availabilityService = $availabilityService ?? new AvailabilityService();
    }

    /**
     * GET /api/v1/availability
     *
     * Query Parameters:
     * - dentist_id (int, required)
     * - service_id (int, required)
     * - date / start_date (YYYY-MM-DD, required)
     * - end_date (YYYY-MM-DD, optional, max 14 days from start_date)
     */
    public function getAvailability(Request $request): Response
    {
        $queryParams = $request->getQueryParams();
        $validated = ScheduleValidator::validateAvailabilityQuery($queryParams);

        $result = $this->availabilityService->getAvailability(
            $validated['dentist_id'],
            $validated['service_id'],
            $validated['start_date'],
            $validated['end_date']
        );

        return Response::success($result);
    }
}

