<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthorizationMiddleware;
use App\Repositories\AuditLogRepository;

/**
 * System-Wide Forensic Audit Trail Controller
 */
class AuditLogController
{
    private AuditLogRepository $auditLogRepository;

    public function __construct(?AuditLogRepository $auditLogRepository = null)
    {
        $this->auditLogRepository = $auditLogRepository ?? new AuditLogRepository();
    }

    /**
     * GET /api/v1/admin/audit-logs
     * Searchable and filterable audit trail
     */
    public function index(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'audit_logs.view', ['ADMIN']);

        $filters = [
            'search' => $request->getQuery('search'),
            'action' => $request->getQuery('action'),
            'target_type' => $request->getQuery('target_type'),
            'actor_user_id' => $request->getQuery('actor_user_id'),
            'date_from' => $request->getQuery('date_from'),
            'date_to' => $request->getQuery('date_to'),
        ];

        $page = max(1, (int) ($request->getQuery('page') ?? 1));
        $rawPerPage = $request->getQuery('per_page') ?? $request->getQuery('limit') ?? 25;
        $perPage = max(1, min(100, (int) $rawPerPage));
        $sortBy = (string) ($request->getQuery('sort_by') ?? 'created_at');
        $sortDir = (string) ($request->getQuery('sort_dir') ?? 'DESC');

        $result = $this->auditLogRepository->list($filters, $sortBy, $sortDir, $page, $perPage);

        return Response::paginated($result['data'], $result['meta']);
    }

    /**
     * GET /api/v1/admin/audit-logs/export
     * Export audit trail to downloadable CSV
     */
    public function export(Request $request): Response
    {
        $admin = AuthorizationMiddleware::requireUserPermission($request, 'audit_logs.export', ['ADMIN']);

        $filters = [
            'search' => $request->getQuery('search'),
            'action' => $request->getQuery('action'),
            'target_type' => $request->getQuery('target_type'),
            'actor_user_id' => $request->getQuery('actor_user_id'),
            'date_from' => $request->getQuery('date_from'),
            'date_to' => $request->getQuery('date_to'),
        ];

        $csv = $this->auditLogRepository->exportCsv($filters);

        // Record audit export event
        $this->auditLogRepository->record(
            'AUDIT_LOG_EXPORTED',
            'audit_logs',
            null,
            (int) $admin['id'],
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            ['filters' => array_filter($filters)]
        );

        $filename = 'audit-logs-' . date('Y-m-d-His') . '.csv';

        return new Response(
            200,
            $csv,
            [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => "attachment; filename=\"{$filename}\"",
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
            ]
        );
    }

    /**
     * GET /api/v1/admin/security/events
     * Forensic stream of failed logins, lockouts, and authorization failures
     */
    public function securityEvents(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'audit_logs.view', ['ADMIN']);

        $filters = [
            'search' => $request->getQuery('search'),
            'date_from' => $request->getQuery('date_from'),
            'date_to' => $request->getQuery('date_to'),
        ];

        $securityActions = [
            'AUTH_LOGIN_FAILED',
            'AUTH_LOGIN_RATE_LIMITED',
            'AUTH_LOGIN_BLOCKED',
            'AUTH_PASSWORD_RESET_REQUESTED',
            'AUTH_PASSWORD_RESET_COMPLETED',
            'USER_ACTIVATED',
            'USER_DEACTIVATED',
            'USER_STATUS_UPDATED',
            'USER_ROLE_UPDATED',
            'PATIENT_ACTIVATED',
            'PATIENT_DEACTIVATED',
            'ROLE_PERMISSIONS_UPDATED',
            'ADMIN_LOCKOUT_PREVENTED',
        ];

        $page = max(1, (int) ($request->getQuery('page') ?? 1));
        $rawPerPage = $request->getQuery('per_page') ?? $request->getQuery('limit') ?? 25;
        $perPage = max(1, min(100, (int) $rawPerPage));

        $result = $this->auditLogRepository->list(
            [...$filters, 'actions' => $securityActions],
            'created_at',
            'DESC',
            $page,
            $perPage
        );

        return Response::paginated($result['data'], $result['meta']);
    }
}
