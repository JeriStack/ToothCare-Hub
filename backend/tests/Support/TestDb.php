<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Core\Database;
use PDO;

/**
 * Test Database Helper
 * Configures an isolated SQLite in-memory database with production-matching schema for fast tests.
 */
class TestDb
{
    public static function create(): PDO
    {
        $pdo = new PDO('sqlite::memory:');
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        // Register MySQL function polyfills for SQLite (PHP 8.5 Pdo\Sqlite compatible)
        if (method_exists($pdo, 'createFunction')) {
            $pdo->createFunction('NOW', fn() => date('Y-m-d H:i:s'));
            $pdo->createFunction('UNIX_TIMESTAMP', fn(?string $d = null) => $d ? strtotime($d) : time());
            $pdo->createFunction('FROM_UNIXTIME', fn($ts) => date('Y-m-d H:i:s', (int) $ts));
        } elseif (method_exists($pdo, 'sqliteCreateFunction')) {
            @$pdo->sqliteCreateFunction('NOW', fn() => date('Y-m-d H:i:s'));
            @$pdo->sqliteCreateFunction('UNIX_TIMESTAMP', fn(?string $d = null) => $d ? strtotime($d) : time());
            @$pdo->sqliteCreateFunction('FROM_UNIXTIME', fn($ts) => date('Y-m-d H:i:s', (int) $ts));
        }

        $pdo->exec('
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                first_name TEXT NULL,
                last_name TEXT NULL,
                phone TEXT NULL,
                avatar_path TEXT NULL,
                avatar_mime TEXT NULL,
                avatar_updated_at TEXT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT "PATIENT",
                is_active INTEGER NOT NULL DEFAULT 1,
                email_verified INTEGER NOT NULL DEFAULT 0,
                email_verified_at TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                date_of_birth TEXT NOT NULL,
                phone TEXT NOT NULL,
                gender TEXT NOT NULL DEFAULT "PREFER_NOT_TO_SAY",
                address TEXT NULL,
                emergency_contact_name TEXT NULL,
                emergency_contact_phone TEXT NULL,
                medical_alerts TEXT NULL,
                avatar_path TEXT NULL,
                avatar_mime TEXT NULL,
                avatar_updated_at TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS dentists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                license_number TEXT NOT NULL UNIQUE,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                specialization TEXT NOT NULL,
                phone TEXT NOT NULL,
                default_operatory_chair TEXT NOT NULL DEFAULT "Chair 1",
                bio TEXT NULL,
                avatar_path TEXT NULL,
                avatar_mime TEXT NULL,
                avatar_updated_at TEXT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS services (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                category TEXT NOT NULL DEFAULT "General",
                description TEXT NULL,
                price REAL NOT NULL,
                duration_minutes INTEGER NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS dentist_schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dentist_id INTEGER NOT NULL,
                day_of_week INTEGER NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                operatory_chair TEXT NOT NULL DEFAULT "Chair 1",
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS dentist_time_off (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dentist_id INTEGER NOT NULL,
                start_at TEXT NOT NULL,
                end_at TEXT NOT NULL,
                reason TEXT NOT NULL,
                approved_by_user_id INTEGER NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS clinic_operating_hours (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                day_of_week INTEGER NOT NULL,
                opening_time TEXT NOT NULL DEFAULT "08:00:00",
                closing_time TEXT NOT NULL DEFAULT "17:00:00",
                is_closed INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS clinic_closures (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                start_at TEXT NOT NULL,
                end_at TEXT NOT NULL,
                closure_type TEXT NOT NULL DEFAULT "HOLIDAY",
                notes TEXT NULL,
                created_by_user_id INTEGER NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                dentist_id INTEGER NOT NULL,
                service_id INTEGER NOT NULL,
                start_at TEXT NOT NULL,
                end_at TEXT NOT NULL,
                duration_snapshot INTEGER NOT NULL,
                price_snapshot REAL NOT NULL,
                status TEXT NOT NULL DEFAULT "PENDING",
                chief_complaint TEXT NULL,
                operatory_chair TEXT NOT NULL DEFAULT "Chair 1",
                rescheduled_from_id INTEGER NULL,
                cancellation_reason TEXT NULL,
                cancelled_by_user_id INTEGER NULL,
                cancelled_at TEXT NULL,
                reviewed_by_user_id INTEGER NULL,
                reviewed_at TEXT NULL,
                completed_at TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                role TEXT NOT NULL DEFAULT "PATIENT",
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                reference_type TEXT DEFAULT "appointments",
                reference_id INTEGER NULL,
                read_at TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS appointment_status_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                appointment_id INTEGER NOT NULL,
                old_status TEXT NULL,
                new_status TEXT NOT NULL,
                actor_user_id INTEGER NULL,
                reason TEXT NULL,
                metadata TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS treatment_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                appointment_id INTEGER NOT NULL UNIQUE,
                dentist_id INTEGER NOT NULL,
                patient_id INTEGER NOT NULL,
                teeth_treated TEXT NULL,
                diagnosis TEXT NOT NULL,
                procedure_notes TEXT NOT NULL,
                prescription_notes TEXT NULL,
                home_care_advice TEXT NULL,
                locked_at TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS auth_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                token_type TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                used_at TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                actor_user_id INTEGER NULL,
                action TEXT NOT NULL,
                target_type TEXT NOT NULL,
                target_id INTEGER NULL,
                ip_address TEXT NULL,
                user_agent TEXT NULL,
                sanitized_payload TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS rate_limits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rate_key TEXT NOT NULL UNIQUE,
                hits INTEGER NOT NULL DEFAULT 1,
                reset_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS appointment_attendances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                appointment_id INTEGER NOT NULL UNIQUE,
                status TEXT NOT NULL DEFAULT "NOT_ARRIVED",
                checked_in_at TEXT NULL,
                checked_in_by_user_id INTEGER NULL,
                consultation_started_at TEXT NULL,
                consultation_ended_at TEXT NULL,
                notes TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                description TEXT NULL,
                is_system INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                module TEXT NOT NULL,
                description TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                role_id INTEGER NOT NULL,
                assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS role_permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role_id INTEGER NOT NULL,
                permission_id INTEGER NOT NULL,
                granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(role_id, permission_id)
            );

            CREATE TABLE IF NOT EXISTS clinic_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                setting_key TEXT NOT NULL UNIQUE,
                setting_value TEXT NOT NULL,
                description TEXT NULL,
                value_type TEXT NOT NULL DEFAULT "string",
                is_public INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            INSERT INTO roles (id, name, slug, description, is_system) VALUES
            (1, "Administrator", "admin", "Full clinic system management", 1),
            (2, "Dentist", "dentist", "Clinical practitioner", 1),
            (3, "Patient", "patient", "Clinic patient", 1),
            (4, "Receptionist", "receptionist", "Front desk staff", 1);

            INSERT INTO permissions (id, name, slug, module, description) VALUES
            (1, "View Users", "users.view", "users", "View user listings"),
            (2, "Manage Users", "users.manage", "users", "Create/update users"),
            (3, "View Patients", "patients.view", "patients", "View patient directory"),
            (4, "Manage Patients", "patients.manage", "patients", "Edit patient profiles"),
            (5, "View Dentists", "dentists.view", "dentists", "View dentist roster"),
            (6, "Manage Dentists", "dentists.manage", "dentists", "Edit dentist profiles"),
            (7, "View Services", "services.view", "services", "Browse service catalog"),
            (8, "Manage Services", "services.manage", "services", "Manage dental services"),
            (9, "View Appointments", "appointments.view", "appointments", "View appointment schedules"),
            (10, "Book Appointments", "appointments.book", "appointments", "Request appointments"),
            (11, "Manage Appointments", "appointments.manage", "appointments", "Confirm/reschedule/cancel"),
            (12, "Complete Appointments", "appointments.complete", "appointments", "Complete appointments"),
            (13, "View Treatment Records", "treatment_records.view", "clinical", "Read treatment records"),
            (14, "Create Treatment Records", "treatment_records.create", "clinical", "Document treatments"),
            (15, "Amend Treatment Records", "treatment_records.amend", "clinical", "Amend treatment records"),
            (16, "View Audit Logs", "audit_logs.view", "security", "Inspect forensic audit logs"),
            (17, "Manage Clinic Settings", "settings.manage", "settings", "Configure preferences"),
            (18, "View Admin Dashboard", "dashboard.view", "dashboard", "View clinic executive dashboard"),
            (19, "Manage Roles & Permissions", "roles.manage", "security", "Configure DRBAC permissions"),
            (20, "Export Audit Logs", "audit_logs.export", "security", "Export audit logs CSV"),
            (21, "View Reports & Analytics", "reports.view", "reports", "Access reports"),
            (22, "View System Health", "system.health", "system", "Inspect system health"),
            (23, "View Legal Documents", "legal_documents.view", "legal", "View legal documents and history"),
            (24, "Create Legal Document Drafts", "legal_documents.create", "legal", "Create legal document drafts"),
            (25, "Edit Legal Document Drafts", "legal_documents.edit", "legal", "Edit unpublished legal document drafts"),
            (26, "Publish Legal Documents", "legal_documents.publish", "legal", "Publish approved legal document versions"),
            (27, "View User Legal Acceptances", "legal_acceptances.view", "legal", "Inspect user legal acceptance records");

            INSERT INTO role_permissions (role_id, permission_id) VALUES
            (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10),
            (1, 11), (1, 12), (1, 13), (1, 14), (1, 15), (1, 16), (1, 17), (1, 18), (1, 19), (1, 20), (1, 21), (1, 22),
            (1, 23), (1, 24), (1, 25), (1, 27),
            (2, 3), (2, 5), (2, 7), (2, 9), (2, 11), (2, 12), (2, 13), (2, 14), (2, 15),
            (3, 5), (3, 7), (3, 9), (3, 10), (3, 13),
            (4, 3), (4, 4), (4, 5), (4, 7), (4, 9), (4, 10), (4, 11);

            INSERT INTO clinic_settings (setting_key, setting_value, description, value_type, is_public) VALUES
            ("clinic_name", "ToothCare Hub", "Clinic display name", "string", 1),
            ("clinic_phone", "+63 912 345 6789", "Clinic telephone", "string", 1),
            ("booking_advance_days_max", "60", "Max advance days", "integer", 1),
            ("cancellation_cutoff_hours", "24", "Cancellation cutoff", "integer", 1);

            CREATE TABLE IF NOT EXISTS email_outbox (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_key TEXT NULL UNIQUE,
                event_type TEXT NULL,
                template_key TEXT NULL,
                payload_json TEXT NULL,
                user_id INTEGER NULL,
                appointment_id INTEGER NULL,
                recipient_email TEXT NOT NULL,
                recipient_name TEXT NOT NULL,
                subject TEXT NOT NULL,
                body_html TEXT NULL,
                body_text TEXT NULL,
                status TEXT NOT NULL DEFAULT "PENDING",
                attempts INTEGER NOT NULL DEFAULT 0,
                max_attempts INTEGER NOT NULL DEFAULT 5,
                last_error TEXT NULL,
                last_error_code TEXT NULL,
                failure_category TEXT NULL,
                next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                locked_at TEXT NULL,
                locked_by TEXT NULL,
                sent_at TEXT NULL,
                failed_at TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS realtime_tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_hash TEXT NOT NULL UNIQUE,
                user_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                dentist_id INTEGER NULL,
                session_id_hash TEXT NULL,
                permissions_json TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                used_at TEXT NULL,
                revoked_at TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS realtime_outbox (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT NOT NULL UNIQUE,
                event_type TEXT NOT NULL,
                notification_id INTEGER NULL,
                recipient_user_id INTEGER NOT NULL,
                payload TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT "PENDING",
                attempt_count INTEGER NOT NULL DEFAULT 0,
                max_attempts INTEGER NOT NULL DEFAULT 5,
                available_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                locked_at TEXT NULL,
                locked_by TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                published_at TEXT NULL,
                last_error TEXT NULL
            );

            CREATE TABLE IF NOT EXISTS legal_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_type TEXT NOT NULL,
                version TEXT NOT NULL,
                title TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT "DRAFT",
                is_approved INTEGER NOT NULL DEFAULT 0,
                requires_reacceptance INTEGER NOT NULL DEFAULT 0,
                effective_date TEXT NOT NULL,
                published_at TEXT NULL,
                change_summary TEXT NULL,
                content_json TEXT NOT NULL,
                content_sha256 TEXT NOT NULL,
                created_by_user_id INTEGER NULL,
                published_by_user_id INTEGER NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(document_type, version)
            );

            CREATE TABLE IF NOT EXISTS user_legal_acceptances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                document_id INTEGER NOT NULL,
                document_type TEXT NOT NULL,
                document_version TEXT NOT NULL,
                acceptance_action TEXT NOT NULL,
                accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ip_address TEXT NULL,
                user_agent TEXT NULL,
                UNIQUE(user_id, document_id, acceptance_action)
            );

            INSERT INTO clinic_operating_hours (day_of_week, opening_time, closing_time, is_closed) VALUES
            (1, "08:00:00", "17:00:00", 0),
            (2, "08:00:00", "17:00:00", 0),
            (3, "08:00:00", "17:00:00", 0),
            (4, "08:00:00", "17:00:00", 0),
            (5, "08:00:00", "17:00:00", 0),
            (6, "08:00:00", "12:00:00", 0),
            (7, "08:00:00", "17:00:00", 1);
        ');

        $pdo->exec('
            CREATE INDEX IF NOT EXISTS idx_appointments_status_start ON appointments (status, start_at);
            CREATE INDEX IF NOT EXISTS idx_appointments_dentist_start ON appointments (dentist_id, start_at);
            CREATE INDEX IF NOT EXISTS idx_appointments_patient_start ON appointments (patient_id, start_at);
            CREATE INDEX IF NOT EXISTS idx_appointments_service ON appointments (service_id);
            CREATE INDEX IF NOT EXISTS idx_appointments_created_id ON appointments (created_at, id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_target_created ON audit_logs (target_type, created_at, id);
            CREATE INDEX IF NOT EXISTS idx_users_role_active_created ON users (role, is_active, created_at);
        ');

        Database::getInstance()->setConnection($pdo);

        // Seed initial v1.0 DRAFT Terms of Service and Privacy Policy matching migration 033
        $tosContent = json_encode([
            'draft_notice' => 'DRAFT — NOT APPROVED FOR PRODUCTION.',
            'introduction' => 'These Terms of Service govern your access to and use of ToothCare Hub.',
            'sections' => [
                ['id' => 'introduction', 'heading' => '1. Introduction', 'paragraphs' => ['ToothCare Hub dental appointment and clinic management platform.']],
                ['id' => 'acceptance-of-terms', 'heading' => '2. Acceptance of Terms', 'paragraphs' => ['Active checkbox submission records acceptance.']],
            ],
        ], JSON_UNESCAPED_UNICODE);
        $privacyContent = json_encode([
            'draft_notice' => 'DRAFT — NOT APPROVED FOR PRODUCTION.',
            'introduction' => 'This Privacy Policy explains how ToothCare Hub processes personal and health-related information.',
            'sections' => [
                ['id' => 'introduction', 'heading' => '1. Introduction', 'paragraphs' => ['Verified ToothCare Hub data flows.']],
                ['id' => 'data-subject-rights', 'heading' => '11. Data Subject Rights', 'paragraphs' => ['Philippine Data Privacy Act of 2012 (RA 10173) rights.']],
            ],
        ], JSON_UNESCAPED_UNICODE);

        $seedDoc = $pdo->prepare('
            INSERT INTO legal_documents (
                document_type, version, title, status, is_approved, requires_reacceptance,
                effective_date, published_at, change_summary, content_json, content_sha256
            ) VALUES (?, ?, ?, "PUBLISHED", 0, 0, "2026-11-23", NOW(), ?, ?, ?)
        ');
        $seedDoc->execute([
            'TERMS_OF_SERVICE',
            '1.0',
            'Terms of Service',
            'Initial v1.0 draft Terms of Service (pending clinic and legal approval).',
            $tosContent,
            hash('sha256', (string) $tosContent),
        ]);
        $seedDoc->execute([
            'PRIVACY_POLICY',
            '1.0',
            'Privacy Policy',
            'Initial v1.0 draft Privacy Policy (pending clinic and legal review).',
            $privacyContent,
            hash('sha256', (string) $privacyContent),
        ]);

        return $pdo;
    }
}
