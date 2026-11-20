-- Migration 032: Reporting, dashboard analytics, and appointment search composite indexes
-- Phase 15: Dashboards, Search, Reports, and Operational Views

-- Accelerate service-filtered appointment search and service utilization reports
CREATE INDEX idx_appointments_service_start ON appointments (service_id, start_at);

-- Accelerate date-range dashboard aggregations and daily appointment trend reports
CREATE INDEX idx_appointments_start_status ON appointments (start_at, status);

-- Accelerate patient registration trend queries
CREATE INDEX idx_patients_created_at ON patients (created_at);

-- Accelerate active dentist counts joined against users.is_active
CREATE INDEX idx_dentists_active_user ON dentists (is_active, user_id);
