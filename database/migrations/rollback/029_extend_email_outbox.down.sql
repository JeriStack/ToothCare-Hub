-- Rollback for migration 029 (manual, destructive for new columns only).
-- Rows with NULL body_html/body_text must be rendered or removed before restoring NOT NULL.
-- Run only after confirming no template-based rows are pending:
--   SELECT COUNT(*) FROM email_outbox WHERE body_html IS NULL OR body_text IS NULL;
ALTER TABLE email_outbox
    DROP FOREIGN KEY fk_email_outbox_appointment,
    DROP CHECK chk_email_outbox_payload_json,
    DROP INDEX uq_email_outbox_event_key,
    DROP INDEX idx_email_outbox_claim,
    DROP INDEX idx_email_outbox_locks,
    DROP INDEX idx_email_outbox_appointment,
    DROP INDEX idx_email_outbox_event_type,
    DROP INDEX idx_email_outbox_failures,
    DROP COLUMN event_key, DROP COLUMN event_type, DROP COLUMN template_key, DROP COLUMN payload_json,
    DROP COLUMN appointment_id, DROP COLUMN locked_at, DROP COLUMN locked_by, DROP COLUMN failed_at,
    DROP COLUMN last_error_code, DROP COLUMN failure_category;
UPDATE email_outbox SET status = 'FAILED_PERMANENT' WHERE status = 'CANCELLED';
ALTER TABLE email_outbox
    MODIFY COLUMN status ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED_RETRYABLE', 'FAILED_PERMANENT') NOT NULL DEFAULT 'PENDING';