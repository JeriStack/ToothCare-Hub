-- Migration 017: Create RBAC tables (roles, permissions, user_roles, role_permissions)
-- Implements enterprise Role-Based Access Control and populates defaults from existing users.

CREATE TABLE IF NOT EXISTS roles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(50) NOT NULL,
    description VARCHAR(255) NULL,
    is_system TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_roles_slug UNIQUE (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL,
    description VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_permissions_slug UNIQUE (slug),
    INDEX idx_permissions_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_roles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_user_roles UNIQUE (user_id, role_id),
    INDEX idx_user_roles_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_id BIGINT UNSIGNED NOT NULL,
    permission_id BIGINT UNSIGNED NOT NULL,
    granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_role_permissions UNIQUE (role_id, permission_id),
    INDEX idx_role_permissions_permission (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed system roles
INSERT INTO roles (name, slug, description, is_system) VALUES
('Administrator', 'admin', 'Full clinic system management, user administration, reports and settings', 1),
('Dentist', 'dentist', 'Clinical practitioner managing appointments, treatment documentation, and patient charts', 1),
('Patient', 'patient', 'Clinic patient managing profile, booking appointments, and viewing treatment history', 1),
('Receptionist', 'receptionist', 'Front desk staff handling check-ins, appointment scheduling, and patient intake', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Seed core permissions
INSERT INTO permissions (name, slug, module, description) VALUES
('View Users', 'users.view', 'users', 'View clinic user listings and account details'),
('Manage Users', 'users.manage', 'users', 'Create, update, activate, and deactivate users'),
('View Patients', 'patients.view', 'patients', 'View patient directory and contact details'),
('Manage Patients', 'patients.manage', 'patients', 'Create and edit patient demographic profiles'),
('View Dentists', 'dentists.view', 'dentists', 'View dentist roster and specialties'),
('Manage Dentists', 'dentists.manage', 'dentists', 'Configure dentist profiles, bio, and license info'),
('View Services', 'services.view', 'services', 'Browse catalog of clinical dental services'),
('Manage Services', 'services.manage', 'services', 'Create, edit, and adjust pricing of dental services'),
('View Appointments', 'appointments.view', 'appointments', 'View appointment schedules and calendar'),
('Book Appointments', 'appointments.book', 'appointments', 'Request and book new dental appointments'),
('Manage Appointments', 'appointments.manage', 'appointments', 'Confirm, reschedule, or cancel appointments'),
('Complete Appointments', 'appointments.complete', 'appointments', 'Mark appointments completed with clinical discharge'),
('View Treatment Records', 'treatment_records.view', 'clinical', 'Read patient dental charts and treatment records'),
('Create Treatment Records', 'treatment_records.create', 'clinical', 'Document dental treatments with FDI tooth mapping'),
('Amend Treatment Records', 'treatment_records.amend', 'clinical', 'Amend treatment records within compliance windows'),
('View Audit Logs', 'audit_logs.view', 'security', 'Inspect forensic audit logs and security events'),
('Manage Clinic Settings', 'settings.manage', 'settings', 'Configure facility hours, closures, and preferences')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Assign permissions to Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.slug = 'admin'
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Assign permissions to Dentist
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.slug = 'dentist' AND p.slug IN (
    'patients.view', 'dentists.view', 'services.view',
    'appointments.view', 'appointments.manage', 'appointments.complete',
    'treatment_records.view', 'treatment_records.create', 'treatment_records.amend'
)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Assign permissions to Patient
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.slug = 'patient' AND p.slug IN (
    'dentists.view', 'services.view', 'appointments.view', 'appointments.book', 'treatment_records.view'
)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Map existing users to user_roles based on their users.role enum
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id 
FROM users u
JOIN roles r ON LOWER(u.role) = r.slug
ON DUPLICATE KEY UPDATE user_id = user_id;
