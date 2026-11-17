-- Migration 029: Extend email_outbox for the transactional outbox (Phase 13)
-- Additive and non-destructive: existing rows and columns are preserved.
--  * event_key         unique logical event / idempotency key (NULL allowed for legacy rows)
--  * event_type        notification event, e.g. APPOINTMENT_CONFIRMED
--  * template_key      approved template identifier rendered by the worker at send time
--  * payload_json      minimal non-sensitive template data (sensitive values are encrypted)
--  * appointment_id    optional link used to invalidate obsolete reminders
--  * locked_at/by      worker claim ownership for safe concurrent processing
--  * failed_at, last_error_code, failure_category   sanitized failure metadata
-- body_html/body_text become nullable: new rows are rendered from template_key + payload_json.
-- status gains CANCELLED (job invalidated before delivery, e.g. obsolete reminder).
-- Rollback: see database/migrations/rollback/029_extend_email_outbox.down.sql
ALTER TABLE email_outbox
    MODIFY COLUMN body_html MEDIUMTEXT NULL,
    MODIFY COLUMN body_text TEXT NULL,
    MODIFY COLUMN status ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED_RETRYABLE', 'FAILED_PERMANENT', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN event_key VARCHAR(191) NULL AFTER id,
    ADD COLUMN event_type VARCHAR(64) NULL AFTER event_key,
    ADD COLUMN template_key VARCHAR(64) NULL AFTER event_type,
    ADD COLUMN payload_json JSON NULL AFTER template_key,
    ADD COLUMN appointment_id BIGINT UNSIGNED NULL AFTER user_id,
    ADD COLUMN locked_at DATETIME NULL AFTER next_attempt_at,
    ADD COLUMN locked_by VARCHAR(64) NULL AFTER locked_at,
    ADD COLUMN failed_at DATETIME NULL AFTER sent_at,
    ADD COLUMN last_error_code VARCHAR(64) NULL AFTER last_error,
    ADD COLUMN failure_category VARCHAR(16) NULL AFTER last_error_code,
    ADD CONSTRAINT chk_email_outbox_payload_json CHECK (payload_json IS NULL OR JSON_VALID(payload_json)),
    ADD CONSTRAINT fk_email_outbox_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD UNIQUE KEY uq_email_outbox_event_key (event_key),
    ADD INDEX idx_email_outbox_claim (status, next_attempt_at, id),
    ADD INDEX idx_email_outbox_locks (status, locked_at),
    ADD INDEX idx_email_outbox_appointment (appointment_id, event_type, status),
    ADD INDEX idx_email_outbox_event_type (event_type, status),
    ADD INDEX idx_email_outbox_failures (status, failed_at);