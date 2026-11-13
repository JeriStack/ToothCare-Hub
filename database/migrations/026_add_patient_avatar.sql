-- Migration 026: Add avatar storage metadata to patients table
-- Stores generated avatar filename, verified MIME type, and update timestamp for cache busting.

ALTER TABLE patients
    ADD COLUMN avatar_path VARCHAR(255) NULL AFTER medical_alerts,
    ADD COLUMN avatar_mime VARCHAR(64) NULL AFTER avatar_path,
    ADD COLUMN avatar_updated_at DATETIME NULL AFTER avatar_mime;
