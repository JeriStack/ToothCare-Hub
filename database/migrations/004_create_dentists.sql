-- Migration 004: Create dentists table
-- Stores licensed dental practitioner profiles, PRC numbers, specialties, and active practice flags.

CREATE TABLE IF NOT EXISTS dentists (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    specialization VARCHAR(150) NOT NULL,
    license_number VARCHAR(50) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    default_operatory_chair VARCHAR(50) NOT NULL DEFAULT 'Chair 1',
    bio TEXT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_dentists_user_id UNIQUE (user_id),
    CONSTRAINT uq_dentists_license_number UNIQUE (license_number),
    CONSTRAINT fk_dentists_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_dentists_active (is_active),
    INDEX idx_dentists_specialization (specialization)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
