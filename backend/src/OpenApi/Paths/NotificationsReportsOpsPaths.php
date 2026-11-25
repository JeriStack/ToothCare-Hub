<?php

declare(strict_types=1);

namespace App\OpenApi\Paths;

use OpenApi\Attributes as OA;

/**
 * OpenAPI 3.0.3 Path Definitions: Dashboards, Reports, Notifications, Real-Time Tickets, Audit Logs, Outbox, and Settings.
 */
final class NotificationsReportsOpsPaths
{
    // --- Role Dashboards ---
    #[OA\Get(path: '/admin/dashboard', operationId: 'getAdminDashboard', summary: 'Administrator Dashboard Metrics & Operational Summary', tags: ['Dashboards'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Executive dashboard metrics'), new OA\Response(response: 403, description: 'Requires dashboard.view')])]
    public function adminDashboard(): void {}

    #[OA\Get(path: '/admin/dashboard/summary', operationId: 'getAdminDashboardSummary', summary: 'Administrator Dashboard Summary (Alias)', tags: ['Dashboards'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Executive dashboard summary'), new OA\Response(response: 403, description: 'Requires dashboard.view')])]
    public function adminDashboardSummary(): void {}

    #[OA\Get(path: '/receptionist/dashboard', operationId: 'getReceptionistDashboard', summary: 'Receptionist Front-Desk Dashboard Summary', tags: ['Dashboards'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Front-desk KPIs and queues')])]
    public function receptionistDashboard(): void {}

    #[OA\Get(path: '/dentist/dashboard', operationId: 'getDentistDashboard', summary: 'Dentist Scoped Clinical Workload Dashboard', tags: ['Dashboards'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Dentist workload KPIs')])]
    public function dentistDashboard(): void {}

    #[OA\Get(path: '/patient/dashboard', operationId: 'getPatientDashboard', summary: 'Patient Personal Dashboard Summary', tags: ['Dashboards'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Patient upcoming visits, counts, and unread notifications')])]
    public function patientDashboard(): void {}

    // --- Database-Driven Operational Reports ---
    #[OA\Get(
        path: '/admin/reports/appointments',
        operationId: 'getAdminAppointmentsReport',
        summary: 'Appointments Volume, Status Counts & Filterable Appointment List Report (Admin)',
        tags: ['Reports'],
        security: [['CookieAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'start_date', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'end_date', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'dentist_id', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1)),
            new OA\Parameter(name: 'service_id', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1)),
            new OA\Parameter(name: 'patient_id', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1)),
            new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED'])),
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, default: 1)),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 100, default: 25)),
        ],
        responses: [new OA\Response(response: 200, description: 'Appointment counts and filterable appointment list'), new OA\Response(response: 403, description: 'Requires reports.view'), new OA\Response(response: 422, description: 'Invalid date range or filter parameter')]
    )]
    public function reportsAppointments(): void {}

    #[OA\Get(
        path: '/admin/reports/services',
        operationId: 'getAdminServiceUtilizationReport',
        summary: 'Dental Service Utilization Report (Admin)',
        tags: ['Reports'],
        security: [['CookieAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'start_date', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'end_date', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [new OA\Response(response: 200, description: 'Service utilization breakdown'), new OA\Response(response: 422, description: 'Invalid date range')]
    )]
    public function reportsServices(): void {}

    #[OA\Get(
        path: '/admin/reports/patients',
        operationId: 'getAdminPatientRegistrationReport',
        summary: 'Patient Directory & Registration Trend Report (Admin)',
        tags: ['Reports'],
        security: [['CookieAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'start_date', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'end_date', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [new OA\Response(response: 200, description: 'Patient totals & registration timeline'), new OA\Response(response: 422, description: 'Invalid date range')]
    )]
    public function reportsPatients(): void {}

    #[OA\Get(
        path: '/admin/reports/dentists',
        operationId: 'getAdminDentistsWorkloadReport',
        summary: 'Dentist Clinical Workload Report (Admin)',
        tags: ['Reports'],
        security: [['CookieAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'start_date', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'end_date', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [new OA\Response(response: 200, description: 'Dentist workload metrics'), new OA\Response(response: 422, description: 'Invalid date range')]
    )]
    public function reportsDentists(): void {}

    #[OA\Get(
        path: '/admin/reports/revenue',
        operationId: 'getAdminLegacyRevenueReport',
        summary: 'Legacy Procedure Catalog Summary (Deprecated — Use /admin/reports/services)',
        deprecated: true,
        tags: ['Reports'],
        security: [['CookieAuth' => []]],
        responses: [new OA\Response(response: 200, description: 'Legacy procedure summary'), new OA\Response(response: 422, description: 'Invalid date range')]
    )]
    public function reportsRevenue(): void {}

    // --- Notifications & Real-Time Connection Tickets ---
    #[OA\Get(
        path: '/notifications',
        operationId: 'listNotifications',
        summary: 'List Authenticated User Notifications (Paginated)',
        tags: ['Notifications'],
        security: [['CookieAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, default: 1)),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 100, default: 20)),
            new OA\Parameter(name: 'limit', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 100)),
            new OA\Parameter(name: 'unread_only', in: 'query', schema: new OA\Schema(type: 'boolean')),
        ],
        responses: [new OA\Response(response: 200, description: 'Paginated notifications'), new OA\Response(response: 401, description: 'Unauthenticated')]
    )]
    public function notifications(): void {}

    #[OA\Get(path: '/notifications/unread-count', operationId: 'getUnreadNotificationCount', summary: 'Get Unread Notification Count', tags: ['Notifications'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Unread count')])]
    public function notificationsUnreadCount(): void {}

    #[OA\Get(
        path: '/notifications/sync',
        operationId: 'syncNotifications',
        summary: 'Cursor-Based Incremental Notification Synchronization',
        tags: ['Notifications'],
        security: [['CookieAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'after_id', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 0)),
            new OA\Parameter(name: 'since', in: 'query', schema: new OA\Schema(type: 'string', format: 'date-time')),
            new OA\Parameter(name: 'limit', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 100, default: 50)),
        ],
        responses: [new OA\Response(response: 200, description: 'Incremental missed notifications and authoritative unread count'), new OA\Response(response: 400, description: 'Invalid since timestamp'), new OA\Response(response: 401, description: 'Unauthenticated')]
    )]
    public function notificationsSync(): void {}

    #[OA\Get(
        path: '/notifications/{id}',
        operationId: 'getNotificationById',
        summary: 'Retrieve Single Notification (Strict Ownership)',
        tags: ['Notifications'],
        security: [['CookieAuth' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer', minimum: 1))],
        responses: [new OA\Response(response: 200, description: 'Notification record'), new OA\Response(response: 403, description: 'Forbidden (not owner)'), new OA\Response(response: 404, description: 'Not found')]
    )]
    public function notificationShow(): void {}

    #[OA\Delete(
        path: '/notifications/{id}',
        operationId: 'deleteNotificationById',
        summary: 'Delete Single Notification (Strict Ownership)',
        tags: ['Notifications'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer', minimum: 1))],
        responses: [new OA\Response(response: 200, description: 'Notification deleted'), new OA\Response(response: 400, description: 'Invalid notification ID'), new OA\Response(response: 401, description: 'Unauthenticated'), new OA\Response(response: 403, description: 'Forbidden (not owner)'), new OA\Response(response: 404, description: 'Not found')]
    )]
    public function deleteNotification(): void {}

    #[OA\Patch(
        path: '/notifications/{id}/read',
        operationId: 'markNotificationRead',
        summary: 'Mark Single Notification Read (Strict Ownership)',
        tags: ['Notifications'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Marked read'), new OA\Response(response: 403, description: 'Forbidden'), new OA\Response(response: 404, description: 'Not found')]
    )]
    public function markNotificationRead(): void {}

    #[OA\Post(path: '/notifications/read-all', operationId: 'markAllNotificationsReadPost', summary: 'Mark All Notifications Read (POST)', tags: ['Notifications'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 200, description: 'All marked read')])]
    #[OA\Patch(path: '/notifications/read-all', operationId: 'markAllNotificationsReadPatch', summary: 'Mark All Notifications Read (PATCH)', tags: ['Notifications'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 200, description: 'All marked read')])]
    public function markAllNotificationsRead(): void {}

    #[OA\Post(
        path: '/realtime/ticket',
        operationId: 'issueRealtimeTicket',
        summary: 'Issue Short-Lived Single-Use Socket.IO Connection Ticket',
        description: 'Returns a short-lived opaque ticket stored as SHA-256 hash server-side and bound to the authenticated PHP session. Never pass tickets in URLs or store in localStorage.',
        tags: ['Notifications'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        responses: [new OA\Response(response: 200, description: 'Connection ticket issued'), new OA\Response(response: 401, description: 'Unauthenticated')]
    )]
    public function realtimeTicket(): void {}

    // --- Audit Logs, Outbox, Operations, & System Health ---
    #[OA\Get(path: '/admin/audit-logs', operationId: 'listAuditLogs', summary: 'List Append-Only Forensic Audit Logs (Admin, Paginated)', tags: ['Operations'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Paginated audit logs')])]
    public function auditLogs(): void {}

    #[OA\Get(path: '/admin/audit-logs/export', operationId: 'exportAuditLogsCsv', summary: 'Export Filtered Audit Logs CSV (Admin)', tags: ['Operations'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'CSV export stream')])]
    public function auditLogsExport(): void {}

    #[OA\Get(path: '/admin/security/events', operationId: 'listSecurityEvents', summary: 'List Security & Access-Control Events (Admin, Paginated)', tags: ['Operations'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Paginated security events')])]
    public function securityEvents(): void {}

    #[OA\Get(path: '/admin/email-outbox/stats', operationId: 'getEmailOutboxStats', summary: 'Get Email Outbox Queue Metrics (DRBAC email_outbox.view)', tags: ['Operations'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Email outbox stats')])]
    public function emailOutboxStats(): void {}

    #[OA\Get(path: '/admin/email-outbox/jobs', operationId: 'listEmailOutboxJobs', summary: 'List Email Outbox Jobs (DRBAC email_outbox.view_failures, Paginated)', tags: ['Operations'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Paginated email jobs')])]
    public function emailOutboxJobs(): void {}

    #[OA\Get(path: '/admin/email-outbox/jobs/{id}', operationId: 'getEmailOutboxJob', summary: 'Get Single Email Outbox Job Metadata', tags: ['Operations'], security: [['CookieAuth' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Job metadata')])]
    public function emailOutboxJobById(): void {}

    #[OA\Post(path: '/admin/email-outbox/jobs/{id}/retry', operationId: 'retryEmailOutboxJob', summary: 'Requeue Failed Email Outbox Job (DRBAC email_outbox.retry)', tags: ['Operations'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Job requeued')])]
    public function emailOutboxJobRetry(): void {}

    #[OA\Post(path: '/admin/email-outbox/jobs/{id}/abandon', operationId: 'abandonEmailOutboxJob', summary: 'Abandon Failed Email Outbox Job (DRBAC email_outbox.manage)', tags: ['Operations'], security: [['CookieAuth' => [], 'CsrfToken' => []]], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))], responses: [new OA\Response(response: 200, description: 'Job abandoned')])]
    public function emailOutboxJobAbandon(): void {}

    #[OA\Get(
        path: '/admin/operations/outbox',
        operationId: 'getAdminOutboxOperations',
        summary: 'Unified Email & Realtime Outbox Monitoring (Admin, Paginated)',
        tags: ['Operations'],
        security: [['CookieAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'channel', in: 'query', schema: new OA\Schema(type: 'string', enum: ['email', 'realtime'], default: 'email')),
            new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, default: 1)),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 100, default: 20)),
        ],
        responses: [new OA\Response(response: 200, description: 'Unified outbox summary & redacted jobs'), new OA\Response(response: 422, description: 'Invalid channel')]
    )]
    public function operationsOutbox(): void {}

    #[OA\Get(
        path: '/admin/operations/errors',
        operationId: 'getAdminOperationalErrors',
        summary: 'Safe Redacted Operational Errors Feed (Admin, Paginated)',
        tags: ['Operations'],
        security: [['CookieAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, default: 1)),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 100, default: 20)),
        ],
        responses: [new OA\Response(response: 200, description: 'Paginated redacted operational errors')]
    )]
    public function operationsErrors(): void {}

    #[OA\Get(path: '/admin/system/health', operationId: 'getAdminSystemHealth', summary: 'System Infrastructure & Dependency Health Diagnostics (Admin)', tags: ['Operations'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Database, PHP-FPM, Realtime, Rate Limiter, & Backup diagnostics')])]
    public function systemHealth(): void {}

    #[OA\Get(path: '/admin/clinic/settings', operationId: 'getClinicSettings', summary: 'Get Clinic Settings (Admin)', tags: ['Settings'], security: [['CookieAuth' => []]], responses: [new OA\Response(response: 200, description: 'Settings map')])]
    #[OA\Put(path: '/admin/clinic/settings', operationId: 'updateClinicSettings', summary: 'Update Clinic Settings (Admin)', tags: ['Settings'], security: [['CookieAuth' => [], 'CsrfToken' => []]], responses: [new OA\Response(response: 200, description: 'Settings updated')])]
    public function clinicSettings(): void {}
}
