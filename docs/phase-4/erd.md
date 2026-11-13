# ToothCare Hub — Entity-Relationship Diagram & Relationship Model

**Document ID:** `TCH-P4-ERD-001`  
**Version:** `1.0.0`  
**Phase:** Phase 4 — Database Modeling and Versioned Schema  
**Prepared Date:** `2026-10-27`  
**Status:** Approved Baseline  
**Author:** Lead Database Architect & Security Specialist  

---

## 1. Entity-Relationship Overview

The **ToothCare Hub** relational model is designed to support the complete clinic appointment lifecycle, role-based authorization boundaries, clinical documentation, and real-time asynchronous messaging.

```mermaid
erDiagram
    users ||--o| patients : "has profile (1:0..1)"
    users ||--o| dentists : "has practitioner profile (1:0..1)"
    users ||--o{ notifications : "receives"
    users ||--o{ auth_tokens : "owns"
    users ||--o{ audit_logs : "initiates (actor)"

    dentists ||--o{ dentist_schedules : "configured shifts"
    dentists ||--o{ dentist_time_off : "scheduled leave"
    dentists ||--o{ appointments : "assigned to"

    patients ||--o{ appointments : "requests / attends"
    services ||--o{ appointments : "booked service"

    appointments ||--o{ appointment_status_history : "tracks transitions"
    appointments ||--o| treatment_records : "documented clinical visit (1:0..1)"
    appointments ||--o| appointments : "rescheduled_from (1:0..1)"

    users ||--o{ appointment_status_history : "decided / transitioned by"
    dentists ||--o{ treatment_records : "authoring clinician"
    patients ||--o{ treatment_records : "subject patient"

    users ||--o{ email_outbox : "target user (optional FK)"

    users {
        bigint id PK
        varchar email UK
        varchar password_hash
        enum role "ADMIN, DENTIST, PATIENT"
        boolean is_active
        boolean email_verified
        datetime email_verified_at
        datetime created_at
        datetime updated_at
    }

    patients {
        bigint id PK
        bigint user_id FK,UK
        varchar first_name
        varchar last_name
        date date_of_birth
        varchar phone
        enum gender "MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY"
        varchar address
        varchar emergency_contact_name
        varchar emergency_contact_phone
        text medical_alerts
        datetime created_at
        datetime updated_at
    }

    dentists {
        bigint id PK
        bigint user_id FK,UK
        varchar first_name
        varchar last_name
        varchar specialization
        varchar license_number UK
        varchar phone
        varchar default_operatory_chair
        text bio
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    services {
        bigint id PK
        varchar name UK
        varchar category
        text description
        decimal price
        int duration_minutes
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    dentist_schedules {
        bigint id PK
        bigint dentist_id FK
        tinyint day_of_week "1=Mon .. 7=Sun"
        time start_time
        time end_time
        varchar operatory_chair
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    dentist_time_off {
        bigint id PK
        bigint dentist_id FK
        datetime start_at
        datetime end_at
        varchar reason
        bigint approved_by_user_id FK
        datetime created_at
        datetime updated_at
    }

    appointments {
        bigint id PK
        bigint patient_id FK
        bigint dentist_id FK
        bigint service_id FK
        datetime start_at
        datetime end_at
        int duration_snapshot
        decimal price_snapshot
        enum status "PENDING, CONFIRMED, REJECTED, CANCELLED, COMPLETED"
        text chief_complaint
        varchar operatory_chair
        bigint rescheduled_from_id FK
        varchar cancellation_reason
        bigint cancelled_by_user_id FK
        datetime cancelled_at
        bigint reviewed_by_user_id FK
        datetime reviewed_at
        datetime completed_at
        datetime created_at
        datetime updated_at
    }

    appointment_status_history {
        bigint id PK
        bigint appointment_id FK
        enum old_status "NULL, PENDING, CONFIRMED, REJECTED, CANCELLED, COMPLETED"
        enum new_status "PENDING, CONFIRMED, REJECTED, CANCELLED, COMPLETED"
        bigint actor_user_id FK
        varchar reason
        json metadata
        datetime created_at
    }

    treatment_records {
        bigint id PK
        bigint appointment_id FK,UK
        bigint dentist_id FK
        bigint patient_id FK
        json teeth_treated
        text diagnosis
        text procedure_notes
        text prescription_notes
        text home_care_advice
        datetime locked_at
        datetime created_at
        datetime updated_at
    }

    notifications {
        bigint id PK
        bigint user_id FK
        enum role "ADMIN, DENTIST, PATIENT"
        varchar type
        varchar title
        text message
        varchar reference_type
        bigint reference_id
        datetime read_at
        datetime created_at
    }

    email_outbox {
        bigint id PK
        bigint user_id FK
        varchar recipient_email
        varchar recipient_name
        varchar subject
        mediumtext body_html
        text body_text
        enum status "PENDING, PROCESSING, SENT, FAILED_RETRYABLE, FAILED_PERMANENT"
        tinyint attempts
        tinyint max_attempts
        text last_error
        datetime next_attempt_at
        datetime sent_at
        datetime created_at
        datetime updated_at
    }

    auth_tokens {
        bigint id PK
        bigint user_id FK
        varchar token_hash UK
        enum token_type "EMAIL_VERIFY, PASSWORD_RESET"
        datetime expires_at
        datetime used_at
        datetime created_at
    }

    audit_logs {
        bigint id PK
        bigint actor_user_id FK
        varchar action
        varchar target_type
        bigint target_id
        varchar ip_address
        varchar user_agent
        json sanitized_payload
        datetime created_at
    }

    schema_migrations {
        bigint id PK
        varchar version UK
        varchar name
        int batch
        datetime applied_at
    }
```

---

## 2. Referential Integrity & Relationship Specifications

| Parent Entity | Child Entity | Foreign Key Column | Cardinality | Deletion Behavior (`ON DELETE`) | Update Behavior (`ON UPDATE`) | Business Rule & Justification |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| `users` | `patients` | `patients.user_id` | `1 : 0..1` | `RESTRICT` | `CASCADE` | User cannot be deleted if patient medical profile exists. Deactivation via `is_active=0` preferred. |
| `users` | `dentists` | `dentists.user_id` | `1 : 0..1` | `RESTRICT` | `CASCADE` | Dentist practitioner cannot be deleted if user account exists. Preserves clinical license audit. |
| `users` | `notifications` | `notifications.user_id` | `1 : 0..N` | `CASCADE` | `CASCADE` | Ephemeral notifications cascade if user is purged. |
| `users` | `auth_tokens` | `auth_tokens.user_id` | `1 : 0..N` | `CASCADE` | `CASCADE` | Security tokens are revoked/purged on user removal. |
| `users` | `audit_logs` | `audit_logs.actor_user_id`| `1 : 0..N` | `SET NULL` | `CASCADE` | Audit trails remain intact even if user account is permanently deleted (`actor_user_id` becomes NULL). |
| `dentists` | `dentist_schedules`| `dentist_schedules.dentist_id`| `1 : 0..N` | `CASCADE` | `CASCADE` | Working shifts belong exclusively to a practitioner. |
| `dentists` | `dentist_time_off` | `dentist_time_off.dentist_id` | `1 : 0..N` | `CASCADE` | `CASCADE` | Leave periods belong exclusively to a practitioner. |
| `patients` | `appointments` | `appointments.patient_id` | `1 : 0..N` | `RESTRICT` | `CASCADE` | Strict restriction: Patient records with appointment history can NEVER be silently deleted. |
| `dentists` | `appointments` | `appointments.dentist_id` | `1 : 0..N` | `RESTRICT` | `CASCADE` | Strict restriction: Dentist records with clinical bookings can NEVER be deleted. |
| `services` | `appointments` | `appointments.service_id` | `1 : 0..N` | `RESTRICT` | `CASCADE` | Services cannot be deleted if historical appointments reference them (deactivate via `is_active=0`). |
| `appointments` | `appointments` | `appointments.rescheduled_from_id` | `1 : 0..1` | `SET NULL` | `CASCADE` | Self-referencing link for atomic rescheduling chain (`DEC-POL-008`). |
| `appointments` | `appointment_status_history`| `appointment_status_history.appointment_id` | `1 : 1..N` | `RESTRICT` | `CASCADE` | Audit log of status transitions is strictly permanent. |
| `appointments` | `treatment_records`| `treatment_records.appointment_id` | `1 : 0..1` | `RESTRICT` | `CASCADE` | Clinical treatment records are permanent legal medical documentation. |
| `dentists` | `treatment_records`| `treatment_records.dentist_id` | `1 : 0..N` | `RESTRICT` | `CASCADE` | Clinical notes are irrevocably linked to authoring dentist. |
| `patients` | `treatment_records`| `treatment_records.patient_id` | `1 : 0..N` | `RESTRICT` | `CASCADE` | Clinical notes are irrevocably linked to subject patient. |
| `users` | `email_outbox` | `email_outbox.user_id` | `1 : 0..N` | `SET NULL` | `CASCADE` | Outbox delivery queue persists even if user is removed. |

---

## 3. Scope Boundary Alignment

- **One Service Per Appointment (MVP):** Modeled directly via `appointments.service_id` with `price_snapshot` and `duration_snapshot`. If future phases support multi-service bookings, an `appointment_services` junction table will be introduced without breaking single-service integrity.
- **Unified Role Modeling:** User roles are constrained to `ENUM('ADMIN', 'DENTIST', 'PATIENT')`. Receptionists and clinic administrators share the `ADMIN` role for the MVP per approved decision `DEC-P3-009`.
