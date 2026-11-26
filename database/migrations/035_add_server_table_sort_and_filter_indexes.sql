-- Migration 035: Targeted composite indexes for server-side data table sorting and filtering
-- Eliminates filesorts on high-traffic administrative data table views without over-indexing.

-- Accelerates newest-submitted sorting on Appointment Triage & Management
CREATE INDEX idx_appointments_created_id ON appointments (created_at, id);

-- Accelerates module-filtered Audit Trail queries ordered by newest timestamp
CREATE INDEX idx_audit_logs_target_created ON audit_logs (target_type, created_at, id);

-- Accelerates User Management queries combining role + active status + created_at sorting
CREATE INDEX idx_users_role_active_created ON users (role, is_active, created_at);
