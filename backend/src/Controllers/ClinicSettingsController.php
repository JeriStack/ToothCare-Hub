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
     * GET /api/v1/clinic/settings
     * Publicly readable clinic branding, contact info, and booking policy settings.
     */
    public function publicIndex(Request $request): Response
    {
        return Response::success($this->settingsRepository->getPublicSettings());
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
        $errors = [];
        foreach ($body as $key => $value) {
            if (!in_array($key, $allowedKeys, true)) {
                continue;
            }

            if (in_array($key, ['clinic_name', 'clinic_tagline', 'clinic_phone', 'clinic_email', 'clinic_address', 'clinic_timezone'], true)) {
                $clean = trim((string) $value);
                if ($key === 'clinic_name') {
                    if ($clean === '') {
                        $errors['clinic_name'] = ['Clinic display name cannot be empty.'];
                    } elseif (mb_strlen($clean) > 120) {
                        $errors['clinic_name'] = ['Clinic display name must be 120 characters or fewer.'];
                    }
                } elseif ($key === 'clinic_email' && $clean !== '' && !filter_var($clean, FILTER_VALIDATE_EMAIL)) {
                    $errors['clinic_email'] = ['Please provide a valid official contact email address.'];
                } elseif (mb_strlen($clean) > 255) {
                    $errors[$key] = ['Value must be 255 characters or fewer.'];
                }
                $toUpdate[$key] = $clean;
            } elseif ($key === 'booking_advance_days_max') {
                if (!is_numeric($value) || (int) $value < 7 || (int) $value > 365) {
                    $errors[$key] = ['Max booking advance must be between 7 and 365 days.'];
                } else {
                    $toUpdate[$key] = (int) $value;
                }
            } elseif ($key === 'cancellation_cutoff_hours') {
                if (!is_numeric($value) || (int) $value < 0 || (int) $value > 168) {
                    $errors[$key] = ['Cancellation cutoff must be between 0 and 168 hours.'];
                } else {
                    $toUpdate[$key] = (int) $value;
                }
            } elseif ($key === 'slot_duration_default_minutes') {
                $mins = is_numeric($value) ? (int) $value : 0;
                if ($mins < 15 || $mins > 120 || $mins % 5 !== 0) {
                    $errors[$key] = ['Default slot duration must be between 15 and 120 minutes in 5-minute increments.'];
                } else {
                    $toUpdate[$key] = $mins;
                }
            } elseif ($key === 'compliance_lock_hours') {
                if (!is_numeric($value) || (int) $value < 0 || (int) $value > 720) {
                    $errors[$key] = ['Compliance lock hours must be between 0 and 720.'];
                } else {
                    $toUpdate[$key] = (int) $value;
                }
            }
        }

        if (count($errors) > 0) {
            throw HttpException::unprocessableEntity('Please fix the invalid clinic configuration fields.', $errors);
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
