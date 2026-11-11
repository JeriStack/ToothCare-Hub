<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthorizationMiddleware;
use App\Repositories\AuditLogRepository;
use App\Repositories\ClinicSettingsRepository;

/**
 * Clinic Configuration & Settings Controller
 */
class ClinicSettingsController
{
    private ClinicSettingsRepository $settingsRepository;
    private AuditLogRepository $auditLogRepository;

    public function __construct(
        ?ClinicSettingsRepository $settingsRepository = null,
        ?AuditLogRepository $auditLogRepository = null
    ) {
        $this->settingsRepository = $settingsRepository ?? new ClinicSettingsRepository();
        $this->auditLogRepository = $auditLogRepository ?? new AuditLogRepository();
    }

    /**
     * GET /api/v1/admin/clinic/settings
     */
    public function index(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'settings.manage', ['ADMIN']);
        return Response::success($this->settingsRepository->getAll());
    }

    /**
     * PUT /api/v1/admin/clinic/settings
     */
    public function update(Request $request): Response
    {
        $admin = AuthorizationMiddleware::requireUserPermission($request, 'settings.manage', ['ADMIN']);
        $body = $request->getBody();

        if (empty($body) || !is_array($body)) {
            throw HttpException::unprocessable('Settings payload is required.');
        }

        $allowedKeys = [
            'clinic_name',
            'clinic_tagline',
            'clinic_phone',
            'clinic_email',
            'clinic_address',
            'clinic_timezone',
            'booking_advance_days_max',
            'cancellation_cutoff_hours',
            'slot_duration_default_minutes',
            'compliance_lock_hours',
        ];

        $toUpdate = [];
        foreach ($body as $key => $value) {
            if (in_array($key, $allowedKeys, true)) {
                $toUpdate[$key] = $value;
            }
        }

        if (count($toUpdate) === 0) {
            throw HttpException::unprocessable('No valid setting keys provided.');
        }

        $currentSettings = $this->settingsRepository->getAll();
        $before = [];
        foreach (array_keys($toUpdate) as $key) {
            $before[$key] = $currentSettings[$key]['value'] ?? null;
        }

        $this->settingsRepository->updateMultiple($toUpdate);

        $updatedSettings = $this->settingsRepository->getAll();
        $after = [];
        foreach (array_keys($toUpdate) as $key) {
            $after[$key] = $updatedSettings[$key]['value'] ?? $toUpdate[$key];
        }

        $this->auditLogRepository->record(
            'CLINIC_SETTINGS_UPDATED',
            'clinic_settings',
            null,
            (int) $admin['id'],
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            [
                'updated_keys' => array_keys($toUpdate),
                'before' => $before,
                'after' => $after,
                'values' => $toUpdate,
            ]
        );

        return Response::success($updatedSettings);
    }
}
