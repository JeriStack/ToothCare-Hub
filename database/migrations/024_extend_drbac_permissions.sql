-- Migration 024: Extend DRBAC permissions catalog for Administrator Control Center modules
-- Adds granular capabilities for Dashboard, DRBAC Matrix, Audit Export, Reports, and System Health.

INSERT INTO permissions (name, slug, module, description) VALUES
('View Admin Dashboard', 'dashboard.view', 'dashboard', 'View clinic executive dashboard and real-time operational overview'),
('Manage Roles & Permissions', 'roles.manage', 'security', 'Configure role capabilities and dynamic permission matrix (DRBAC)'),
('Export Audit Logs', 'audit_logs.export', 'security', 'Export forensic audit logs to downloadable CSV'),
('View Reports & Analytics', 'reports.view', 'reports', 'Access appointment throughput, revenue realization, and provider workload reports'),
('View System Health', 'system.health', 'system', 'Inspect database telemetry, runtime services, and infrastructure diagnostics')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    module = VALUES(module),
    description = VALUES(description);

-- Ensure Administrator role holds all system permissions including the newly registered ones
INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'admin'
ON DUPLICATE KEY UPDATE role_id = role_permissions.role_id;
