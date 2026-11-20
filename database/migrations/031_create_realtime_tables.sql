-- Migration 031: Real-time notification tickets, delivery outbox, and receptionist notification support
-- Phase 14: Real-Time Notifications with Node.js and Socket.IO

-- 1. Extend notifications.role ENUM to include RECEPTIONIST without dropping existing data
ALTER TABLE notifications
    MODIFY COLUMN role ENUM('ADMIN', 'RECEPTIONIST', 'DENTIST', 'PATIENT') NOT NULL;

-- 2. Short-lived, single-use, server-stored hashed Socket.IO connection tickets
CREATE TABLE IF NOT EXISTS realtime_tickets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ticket_hash CHAR(64) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    role VARCHAR(32) NOT NULL,
    dentist_id BIGINT UNSIGNED NULL,
    session_id_hash CHAR(64) NULL,
    permissions_json TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    revoked_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_realtime_tickets_hash UNIQUE (ticket_hash),
    CONSTRAINT fk_realtime_tickets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_realtime_tickets_user_active (user_id, revoked_at, expires_at),
    INDEX idx_realtime_tickets_session (session_id_hash),
    INDEX idx_realtime_tickets_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Transactional real-time notification delivery outbox
CREATE TABLE IF NOT EXISTS realtime_outbox (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    notification_id BIGINT UNSIGNED NULL,
    recipient_user_id BIGINT UNSIGNED NOT NULL,
    payload JSON NOT NULL,
    status ENUM('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED_RETRYABLE', 'FAILED_PERMANENT') NOT NULL DEFAULT 'PENDING',
    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    max_attempts INT UNSIGNED NOT NULL DEFAULT 5,
    available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_at DATETIME NULL,
    locked_by VARCHAR(100) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at DATETIME NULL,
    last_error TEXT NULL,
    CONSTRAINT uq_realtime_outbox_event_id UNIQUE (event_id),
    CONSTRAINT fk_realtime_outbox_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_realtime_outbox_notification FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_realtime_outbox_poll (status, available_at, id),
    INDEX idx_realtime_outbox_lock (status, locked_at),
    INDEX idx_realtime_outbox_recipient (recipient_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
