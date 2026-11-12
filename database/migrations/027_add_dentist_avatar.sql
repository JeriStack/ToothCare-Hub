-- Migration 027: Add avatar storage metadata to dentists table
-- Stores generated avatar filename, verified MIME type, and update timestamp for cache busting.

ALTER TABLE dentists
    ADD COLUMN avatar_path VARCHAR(255) NULL AFTER bio,
    ADD COLUMN avatar_mime VARCHAR(64) NULL AFTER avatar_path,
    ADD COLUMN avatar_updated_at DATETIME NULL AFTER avatar_mime;
