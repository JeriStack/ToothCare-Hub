-- Migration 021: Create email_verification_tokens, password_reset_tokens, and security_events tables
-- Delivers specialized token lifecycle tables and forensic security event telemetry.

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_verify_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_verify_token_hash UNIQUE (token_hash),
    INDEX idx_verify_tokens_lookup (user_id, expires_at, consumed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_reset_token_hash UNIQUE (token_hash),
    INDEX idx_reset_tokens_lookup (user_id, expires_at, consumed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS security_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    event_type VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    metadata JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_security_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_security_events_type_time (event_type, created_at),
    INDEX idx_security_events_user_time (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate existing tokens from auth_tokens where applicable
INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, consumed_at, created_at)
SELECT user_id, token_hash, expires_at, used_at, created_at 
FROM auth_tokens 
WHERE token_type = 'EMAIL_VERIFY'
ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash);

INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, consumed_at, created_at)
SELECT user_id, token_hash, expires_at, used_at, created_at 
FROM auth_tokens 
WHERE token_type = 'PASSWORD_RESET'
ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash);
