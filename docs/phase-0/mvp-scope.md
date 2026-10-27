# ToothCare Hub — MVP Scope Freeze Document

**Document ID:** `TCH-P0-SCOPE-001`  
**Version:** `1.0`  
**Phase:** `Phase 0 — Project Initiation and Scope Freeze`  
**Prepared Date:** `2026-10-27`  
**Status:** `Approved (Scope Frozen for MVP Release 1.0)`

---

## 1. Scope Governance Rule

No feature marked **Deferred** or **Excluded** may be introduced into database migrations, API endpoints, or React views during MVP implementation without a formal scope change request and updated acceptance criteria.

---

## 2. Candidate Capability Classification Matrix

### 2.1 Authentication and Authorization
| Capability | Classification | Rationale / Notes |
|---|---|---|
| Patient self-registration (`POST /api/v1/auth/register`) | **MVP** | Public registration strictly assigns `PATIENT` role only. |
| User login and logout (`POST /api/v1/auth/login`, `/logout`) | **MVP** | Password verification via `password_verify()`; session regeneration. |
| Secure server-side session & CSRF protection | **MVP** | `HttpOnly`, `SameSite`, `Secure` (prod) cookies + CSRF token validation on state-changing requests. |
| Email verification & password reset via expiring hashed tokens | **MVP** | Stored in `auth_tokens` (`token_hash`, `purpose`, `expires_at`, `used_at`). |
| Role-based access control (`ADMIN`, `DENTIST`, `PATIENT`) & ownership checks | **MVP** | Enforced by PHP middleware and service policies on every protected route. Unified `ADMIN` role covers Admin/Receptionist per approved `DEC-ROLE-001`. |

### 2.2 Public Landing Page Experience (Roadmap v1.2 Addendum)
| Capability | Classification | Rationale / Notes |
|---|---|---|
| 8-section responsive landing page (Nav, Hero, Trust, Role Benefits, Services, Steps, Clinic Info, Footer) | **MVP** | Explicit deliverable per Roadmap v1.2 Addendum. |
| Live dental service preview cards fetched from `/api/v1/services` | **MVP** | Includes loading, empty, and error states; no hardcoded mock prices presented as live data. |
| Auth-aware "Book Appointment" CTA with post-login redirect back to booking wizard | **MVP** | Preserves user intent when signed-out visitors initiate booking. |
| Public customer testimonials section | **Deferred** | Omitted until verified, authentic clinic testimonials are approved (per Landing Page Guide §3). |

### 2.3 Clinic Administration
| Capability | Classification | Rationale / Notes |
|---|---|---|
| Manage patient records (search, view, update permitted fields, activate/deactivate) | **MVP** | Paginated, searchable admin table with data minimization. |
| Manage dentist profiles (create/activate, specialization, license ref, contact, deactivate) | **MVP** | Soft deactivation (`is_active = 0`) preserves historical appointments. |
| Manage dental services and prices (create, update, duration, price, activate/deactivate) | **MVP** | Appointments snapshot `duration_minutes` and `price` at booking time. |
| Configure dentist recurring working schedules & time-off/blocked periods | **MVP** | Stored in `dentist_schedules` and `dentist_time_off`. |
| View, search, and filter appointment requests (by date, dentist, service, patient, status) | **MVP** | Paginated with allowlisted sort/filter columns. |
| Approve (`CONFIRMED`) or reject (`REJECTED`) pending appointment requests | **MVP** | Records decision actor, timestamp, and optional safe rejection reason. |

### 2.4 Patient Appointment Experience
| Capability | Classification | Rationale / Notes |
|---|---|---|
| Browse active dental services and active dentists | **MVP** | Excludes inactive services and inactive dentists from new bookings. |
| View available appointment dates and time slots (`/api/v1/availability`) | **MVP** | Calculated server-side against working hours, time-off, service duration, and blocking appointments (`PENDING`, `CONFIRMED`). |
| Guided 6-step appointment booking wizard with review step | **MVP** | Service → Dentist → Date/Time → Review → Submit → Pending Confirmation. |
| Receive explicit `"Request submitted — Pending confirmation"` result | **MVP** | UI never claims an appointment is confirmed until backend status is `CONFIRMED`. |
| Track appointment status and view paginated appointment history | **MVP** | Displays semantic `StatusBadge` paired with text labels. |
| Cancel own appointment within clinic policy rules | **MVP** | Anytime for `PENDING`; up to 24 hours before `start_at` for `CONFIRMED` (`DEC-POL-007`). |
| Reschedule an existing appointment | **MVP** | Atomic cancel-and-rebook transaction creating a linked `PENDING` request (`rescheduled_from_id`) per approved `DEC-POL-008`. |

### 2.5 Dentist Workflow
| Capability | Classification | Rationale / Notes |
|---|---|---|
| View own assigned daily and upcoming appointments | **MVP** | Filtered strictly to `dentist_id` of the authenticated dentist. |
| Access permitted patient context for assigned visits | **MVP** | Cannot query arbitrary patients outside assigned appointments. |
| Record post-visit diagnosis, treatment notes, and recommendations | **MVP** | Stored in `treatment_records`; excluded from emails and WebSocket payloads. |
| Mark an assigned `CONFIRMED` visit as `COMPLETED` | **MVP** | Validated transition recorded in `appointment_status_history`. |
| Review permitted treatment and visit history | **MVP** | Scoped to assigned patient visits according to clinic policy. |

### 2.6 Notifications, Concurrency, and Auditability
| Capability | Classification | Rationale / Notes |
|---|---|---|
| Persist in-app notifications (`notifications` table) & unread counts | **MVP** | Authoritative notification history accessible via REST. |
| Asynchronous transactional email via `email_outbox` + `PHPMailer` worker | **MVP** | Retries transient SMTP failures with backoff; isolates booking transactions from SMTP outages. |
| Scheduled appointment reminder job (`SendAppointmentReminders`) | **MVP** | CLI job queues reminder emails for upcoming `CONFIRMED` visits without duplicate sends. |
| Real-time updates via `Node.js + Socket.IO` with server-assigned rooms | **MVP** | Short-lived ticket auth; minimal payloads; REST fallback on reconnect. |
| Transaction-safe double-booking prevention (`SELECT ... FOR UPDATE` + interval overlap) | **MVP** | Prevents race conditions across variable service durations. |
| Auditable status history (`appointment_status_history`) and security audit log (`audit_logs`) | **MVP** | Tracks actor, timestamp, old/new status, reason, and sensitive admin actions. |

### 2.7 Documentation, Quality, Containers, and Observability
| Capability | Classification | Rationale / Notes |
|---|---|---|
| OpenAPI 3.x spec generation (`swagger-php`) & dev-only Swagger UI | **MVP** | Validated in CI (`backend/docs/openapi.yaml`). |
| Automated backend tests (`PHPUnit` unit, integration, concurrency) & frontend tests (`Vitest`) | **MVP** | Enforced on pull requests via GitHub Actions. |
| Docker Compose (`docker-compose.yml`, `docker-compose.prod.yml`) & Nginx reverse proxy | **MVP** | Only Nginx publishes public web ports (`80`/`443`) in production. |
| Prometheus metrics collection, exporters, alert rules & provisioned Grafana dashboards | **MVP** | Bound to private `monitoring` network; zero PII in metric labels. |

---

## 3. Explicitly Deferred & Excluded Capabilities (Not in Release 1.0)

| Excluded / Deferred Item | Status | Rationale |
|---|---|---|
| **Online payment processing, billing, invoices, insurance claims, and refunds** | **Deferred** | Requires PCI-compliant payment provider integration, webhook reconciliation, and refund policy scoping outside core scheduling MVP. |
| **SMS notifications and two-way SMS reminders** | **Deferred** | Requires paid telecom gateway, sender ID registration, and opt-out compliance; email + in-app + WebSocket alerts satisfy MVP requirements. |
| **Expanded Electronic Health Record (EHR), odontogram charting, X-ray/DICOM file uploads, and clinical decision support** | **Excluded** | High regulatory and storage complexity; MVP focuses on structured text `treatment_records` (diagnosis, notes, recommendations). |
| **Multi-branch clinic management and cross-branch dentist rosters** | **Deferred** | MVP models a single dental clinic to keep scheduling and timezone rules clean and verifiable. |
| **Multiple dental services per single appointment (`appointment_services` table)** | **Deferred** | MVP enforces 1 service per appointment (`service_id` FK on `appointments`); junction table reserved for future release. |
| **Waitlists, automated slot backfilling, patient self-check-in kiosks, and recurring appointments** | **Deferred** | Post-MVP workflow enhancements. |
| **External calendar two-way sync (Google Calendar, Outlook) & native mobile apps** | **Deferred** | Responsive web UI covers mobile viewports in Release 1.0. |

