-- Migration 005: Create services table
-- Stores dental procedures catalog, standard treatment durations (30, 45, 60, 90 min), and fees.

CREATE TABLE IF NOT EXISTS services (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    description TEXT NULL,
    price DECIMAL(10,2) NOT NULL,
    duration_minutes INT UNSIGNED NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_services_name UNIQUE (name),
    CONSTRAINT chk_services_price CHECK (price >= 0.00),
    CONSTRAINT chk_services_duration CHECK (duration_minutes IN (15, 30, 45, 60, 90, 120)),
    INDEX idx_services_category_active (category, is_active),
    INDEX idx_services_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
