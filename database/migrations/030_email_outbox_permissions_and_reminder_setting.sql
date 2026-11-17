-- Migration 030: Email outbox administration permissions and reminder policy setting (Phase 13)
-- Permissions are granted explicitly to the admin role only. Receptionist, dentist and patient
-- roles receive no email outbox access.
INSERT INTO permissions (name, slug, module, description) VALUES
('View Email Outbox', 'email_outbox.view', 'email', 'View email delivery statistics and queue health'),
('View Email Failures', 'email_outbox.view_failures', 'email', 'Inspect failed and exhausted email jobs with masked recipients and sanitized errors'),
('Retry Email Jobs', 'email_outbox.retry', 'email', 'Manually retry or requeue an eligible failed email job'),
('Manage Email Outbox', 'email_outbox.manage', 'email', 'Abandon permanently failed email jobs and manage outbox operations')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    module = VALUES(module),
    description = VALUES(description);
INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
JOIN permissions p ON p.slug IN ('email_outbox.view', 'email_outbox.view_failures', 'email_outbox.retry', 'email_outbox.manage')
WHERE r.slug = 'admin'
ON DUPLICATE KEY UPDATE role_id = role_permissions.role_id;
-- Reminder policy: hours before the appointment start when a reminder becomes eligible.
-- Default 24 is a documented starting value pending clinic approval.
INSERT INTO clinic_settings (setting_key, setting_value, description, value_type, is_public) VALUES
('reminder_lead_hours', '24', 'Hours before an appointment when an email reminder is queued (pending clinic approval)', 'integer', 0)
ON DUPLICATE KEY UPDATE setting_key = setting_key;