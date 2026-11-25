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

    /**
     * GET /api/v1/availability/validate
     *
     * Validate a specific requested slot (dentist_id, service_id, start_at) against all
     * clinic operating hours, dentist working shifts, leaves, closures, and conflicts.
     */
    public function validateSlot(Request $request): Response
    {
        $queryParams = $request->getQueryParams();
        $dentistId = isset($queryParams['dentist_id']) ? (int) $queryParams['dentist_id'] : 0;
        $serviceId = isset($queryParams['service_id']) ? (int) $queryParams['service_id'] : 0;
        $startAtRaw = trim((string) ($queryParams['start_at'] ?? ''));

        $errors = [];
        if ($dentistId <= 0) {
            $errors['dentist_id'] = 'A valid dentist_id is required.';
        }
        if ($serviceId <= 0) {
            $errors['service_id'] = 'A valid service_id is required.';
        }
        $startAtDt = $startAtRaw !== ''
            ? \App\Validators\AppointmentValidator::parseDateTime($startAtRaw, $this->availabilityService->getTimezone())
            : null;
        if ($startAtDt === null) {
            $errors['start_at'] = 'A valid start_at datetime (ISO 8601 or YYYY-MM-DD HH:MM:SS) is required.';
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Slot validation parameters are invalid.', $errors);
        }

        $validation = $this->availabilityService->validateSlot(
            $dentistId,
            $serviceId,
            $startAtDt
        );

        $alternatives = null;
        $alternativesAvailable = false;
        if (!$validation['available']) {
            $alternatives = $this->availabilityService->findAlternatives(
                $dentistId,
                $serviceId,
                $startAtDt->setTimezone($this->availabilityService->getTimezone())->format('Y-m-d')
            );
            $alternativesAvailable = !empty($alternatives['next_available_dates'])
                || !empty($alternatives['alternative_dentists']);
        }

        return Response::success([
            'available' => $validation['available'],
            'availability_status' => $validation['availability_status'],
            'reason_code' => $validation['reason_code'],
            'message' => $validation['message'],
            'operatory_chair' => $validation['operatory_chair'],
            'alternatives_available' => $alternativesAvailable,
            'alternatives' => $alternatives,
        ]);
    }
}

