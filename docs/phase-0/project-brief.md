# ToothCare Hub — Project Brief

**Document ID:** `TCH-P0-BRIEF-001`  
**Version:** `1.0`  
**Phase:** `Phase 0 — Project Initiation and Scope Freeze`  
**Prepared Date:** `2026-10-27`  
**Status:** `Approved (Phase 0 Scope Freeze)`

---

## 1. Project Title and Purpose

- **Project Title:** ToothCare Hub — Dental Appointment and Clinic Management System
- **Brand Tagline:** *Healthier Smiles. Brighter Futures.*
- **Purpose:** ToothCare Hub is a responsive, web-based dental appointment and clinic management system designed to replace manual appointment coordination with an authoritative, role-governed digital workflow. It centralizes patient registration, service discovery, dentist availability, transaction-safe appointment booking, administrative review, clinical treatment documentation, and multi-channel notifications (durable in-app alerts, asynchronous SMTP email via `PHPMailer`, and live WebSocket updates via `Socket.IO`) backed by a relational MySQL (`InnoDB`) database and a native PHP REST API (`/api/v1`).

---

## 2. Problem Statement

Dental clinics relying on manual scheduling (phone calls, paper logbooks, spreadsheets, or fragmented messaging apps) face recurring operational and clinical coordination challenges:

1. **Double Booking and Schedule Conflicts:** Concurrent booking requests or variable service durations frequently cause overlapping appointments for the same dentist when checked manually without transactional slot locking.
2. **Opaque Appointment Statuses:** Patients lack real-time visibility into whether an appointment request is pending review, confirmed, rejected, cancelled, or completed, leading to missed visits and repetitive status-check calls.
3. **Fragmented Patient and Treatment Context:** Dentists often lack a unified, role-restricted view of their daily schedule and authorized post-visit treatment notes tied directly to completed appointments.
4. **Unreliable Notification Handling:** Manual reminder and confirmation messages are easily forgotten, and tightly coupling email sending to form submissions causes user-facing errors when SMTP servers are slow or unreachable.
5. **Insufficient Access Control and Auditability:** Shared spreadsheets or basic tools rarely enforce strict separation between public visitors, patients, dentists, and clinic administrators, increasing the risk of unauthorized access to sensitive patient or clinical data.

---

## 3. Proposed Solution

ToothCare Hub addresses these challenges through a modular, container-ready web architecture where **MySQL (`toothcare_hub`) and the native PHP REST API (`/api/v1`) serve as the single authoritative system of record**:

1. **Public Landing & Guided Discovery Experience (`React + Vite + Tailwind CSS`):**
   - A modern clinical minimalist public landing page (Deep Navy `#12304A`, ToothCare Teal `#0D9488`, Soft Teal `#CCFBF1`, Canvas `#F5F8FA`) presenting verified clinic information, role benefits, and live dental services loaded from the backend API.
   - Seamless authentication redirection that preserves a patient's intended booking flow across sign-in/registration.
2. **Role-Specific Workspaces:**
   - **Patient Portal:** Guided 6-step appointment booking wizard (Service → Dentist → Date/Time → Review → Submit → Pending Confirmation), appointment tracking, policy-controlled cancellation, and notification center.
   - **Admin / Receptionist Workspace:** Operational KPI dashboard, pending request review queue (approve/reject with reason), master CRUD for patients, dentists, services, and recurring dentist schedules/time-off, plus filterable clinic reports.
   - **Dentist Workspace:** Assigned daily/upcoming schedule view, minimal necessary patient context, post-visit diagnosis/treatment record authoring, and controlled visit completion.
3. **Transaction-Safe Booking Engine (`PHP PDO + MySQL InnoDB`):**
   - Enforces dentist working hours, time-off blocks, active service/dentist states, and variable service durations using `SELECT ... FOR UPDATE` row-level locking and interval-overlap validation (`existing.start_at < requested_end AND existing.end_at > requested_start`) inside ACID transactions.
4. **Failure-Isolated Side Effects (`PHPMailer Outbox + Node.js/Socket.IO`):**
   - Appointment mutations persist `notifications` and `email_outbox` rows in the same database transaction.
   - Background CLI workers deliver transactional emails with retry/backoff so SMTP outages never roll back a saved booking.
   - Authenticated real-time events are published after commit to server-assigned Socket.IO rooms (`user:<id>`, `role:admin`, `dentist:<id>`), with full REST fallback for offline clients.
5. **Reproducible Delivery & Observability (`Docker Compose + Nginx + Prometheus + Grafana + GitHub Actions`):**
   - Multi-container topology behind an Nginx reverse proxy, automated PHPUnit/frontend/OpenAPI CI gates, and internal-only infrastructure/application metrics.

---

## 4. Business Objectives

| Objective ID | Business Objective | Target Outcome |
|---|---|---|
| `BO-01` | Eliminate conflicting dentist bookings | Zero overlapping confirmed/blocking appointments for the same dentist under concurrent load. |
| `BO-02` | Streamline appointment request and review lifecycle | Structured end-to-end digital path from patient request (`PENDING`) to admin decision (`CONFIRMED` / `REJECTED`) and clinical completion (`COMPLETED`). |
| `BO-03` | Enforce strict healthcare data privacy and least-privilege access | 100% of protected API endpoints validate authentication, role permissions, and resource ownership on the server. |
| `BO-04` | Decouple booking reliability from external notification infrastructure | 100% of valid bookings succeed even when SMTP or WebSocket services experience transient downtime. |
| `BO-05` | Establish engineering quality, documentation, and operational visibility | Deliver reproducible Docker environments, validated OpenAPI 3.x specs, automated CI checks, and Prometheus/Grafana monitoring. |

---

## 5. Target Users and Stakeholders

### Primary System Actors (Roles)
1. **Admin / Receptionist (`ADMIN`)**
   - **Responsibilities:** Clinic operations operator; manages master data (patients, dentists, dental services, pricing, dentist schedules/time-off), reviews pending appointment requests, performs policy-based cancellations, and generates operational reports.
   - **Restrictions:** Sensitive administrative actions and access to private records are restricted to operational need and recorded in audit/status history logs.
2. **Dentist (`DENTIST`)**
   - **Responsibilities:** Clinical care provider; reviews assigned daily and upcoming appointments, views permitted patient context for assigned visits, records post-visit diagnosis/treatment notes, and marks eligible appointments as `COMPLETED`.
   - **Restrictions:** Cannot view unrelated patients' clinical records, cannot approve own appointment requests, and cannot modify clinic-wide services or user roles.
3. **Patient (`PATIENT`)**
   - **Responsibilities:** Healthcare consumer; registers an account, verifies email, manages own profile, browses active services and dentists, checks available slots, submits appointment requests, tracks status transitions, and cancels own appointments within clinic policy rules.
   - **Restrictions:** Can only view and act upon own profile, appointments, and notifications; cannot self-assign elevated roles or bypass admin review.

### Project Stakeholders
- **Project Owner / Clinic Representative:** Approves clinic business policies (working hours, cancellation windows, slot-blocking rules, content accuracy).
- **Instructor / Technical Reviewer:** Evaluates architectural integrity, test coverage, OpenAPI accuracy, CI/CD automation, and UAT completion.
- **Development, Security & QA Lead:** Designs, implements, tests, documents, and deploys the system in accordance with the approved Phase 0–24 roadmap.

---

## 6. Primary User Journeys

1. **Journey 1 — Public Discovery to Authenticated Booking Redirect:**
   - Visitor lands on the public landing page → browses live services, pricing, durations, and booking steps → clicks **Book Appointment** → if unauthenticated, signs in or registers as a `PATIENT` → automatically returns to the intended booking wizard step.
2. **Journey 2 — Patient Guided Appointment Request:**
   - Authenticated patient selects an active dental service → selects an active dentist → selects a date and available time slot → reviews summary (service, dentist, date/time, duration, price snapshot) → submits request → receives immediate *"Request submitted — Pending confirmation"* (`PENDING`) feedback while outbox email and admin real-time alert are triggered post-commit.
3. **Journey 3 — Admin Appointment Review & Decision:**
   - Admin receives real-time/in-app alert for a `PENDING` request → inspects request in the Admin Queue → approves (`CONFIRMED`) or rejects (`REJECTED` with safe reason) → system records status history, commits transaction, queues patient email notification, and broadcasts Socket.IO update to the patient and assigned dentist.
4. **Journey 4 — Dentist Clinical Visit & Treatment Documentation:**
   - Dentist views today's `CONFIRMED` assigned appointments → attends patient visit → enters diagnosis, treatment notes, and recommendations → marks appointment `COMPLETED` → system saves `treatment_records` and updates status atomically.
5. **Journey 5 — Patient Cancellation & Offline Notification Recovery:**
   - Patient views upcoming appointment → requests cancellation within the clinic's allowed cancellation window (`>= 24h` before `start_at` for `CONFIRMED`, or anytime for `PENDING`) → status transitions to `CANCELLED` and slot is released after commit. Users who were offline during any status change retrieve durable unread notifications via REST upon next login or reconnect.

---

## 7. Expected Project Outcomes

- A working, containerized multi-service application (`nginx`, `backend` PHP-FPM, `mysql`, `realtime`, `email-worker`, plus `prometheus`, `grafana`, and exporters).
- Versioned SQL migrations and synthetic seed data (`toothcare_hub` schema) with zero real patient PII committed to Git.
- Versioned REST API (`/api/v1`) documented via `swagger-php` (`backend/docs/openapi.yaml`) and testable via Swagger UI in development.
- Responsive React + Vite frontend adhering to the ToothCare Hub Visual Design System (`#12304A` Deep Navy, `#0D9488` ToothCare Teal, accessible status badges).
- Automated test suites (PHPUnit unit, repository/API integration, concurrency race tests, and Vitest frontend component tests) enforced via GitHub Actions CI.

---

## 8. Explicit Project Boundaries

### In Scope (MVP Release 1.0)
- Single-clinic dental appointment request, review, scheduling, treatment note recording, and notification workflows for `Admin/Receptionist` (`ADMIN`), `Dentist` (`DENTIST`), and `Patient` (`PATIENT`).
- Public 8-section landing page with live `/api/v1/services` integration and auth-aware booking redirect.
- Single dental service per appointment request (with duration and price snapshots).
- Cookie/session-based authentication with CSRF protection, password hashing (`password_hash`), and token-based email verification/password recovery.
- Asynchronous SMTP email outbox processor and authenticated Socket.IO real-time notifications.
- Docker Compose local/production configurations, Nginx reverse proxy, and Prometheus/Grafana observability.

### Out of Scope / Deferred to Future Releases
- **Online payment collection, invoicing, insurance claims, and refund workflows** (Deferred until a compliant payment gateway and reconciliation workflow are separately scoped).
- **SMS gateway reminders and two-way SMS confirmations** (Deferred; email and in-app/WebSocket notifications cover MVP needs).
- **Full Electronic Health Record (EHR), dental charting odontograms, imaging/DICOM uploads, and automated clinical decision support** (Excluded from MVP).
- **Multi-branch clinic locations and cross-branch staff scheduling** (Deferred).
- **Multiple services within a single appointment** (Deferred; future enhancement via `appointment_services` junction table).
- **Native iOS/Android mobile apps and external calendar two-way sync (Google/Outlook)** (Deferred).

---

## 9. Constraints and Dependencies

1. **Authoritative Backend Rule:** Client-side state, browser slot displays, email delivery, and WebSocket events are never authoritative for permissions or appointment state.
2. **Hosting Constraint:** Production deployment requires a Docker/container-capable host (e.g., Linux VPS or cloud VM) supporting persistent Node.js (`Socket.IO`), background PHP CLI workers (`email-worker`), MySQL named volumes, and Nginx reverse proxying. Basic PHP-only shared hosting is incompatible with the full architecture.
3. **Data Privacy & Compliance Constraint:** Must align with data minimization and security principles informed by the Philippine Data Privacy Act of 2012 (RA 10173). Development and testing must use 100% synthetic data. Formal legal compliance certification requires institutional/legal review prior to live clinic use.
4. **External Service Dependencies:** Requires an authenticated SMTP provider (or local mail-capture sink in development/CI) for transactional email delivery.

---

## 10. Success Measures

| Metric ID | Measure | Target Criterion | Status |
|---|---|---|---|
| `SM-01` | Double-booking prevention under concurrency | 0 overlapping active bookings committed across parallel competing requests for the same dentist/interval in integration tests. | **Approved** |
| `SM-02` | Authorization enforcement coverage | 100% of protected `/api/v1/*` endpoints reject unauthenticated callers with `401` and unauthorized roles/non-owners with `403`. | **Approved** |
| `SM-03` | SMTP outage resilience | 100% of valid booking and status-transition transactions commit successfully when SMTP is unreachable, queuing jobs in `email_outbox` for retry. | **Approved** |
| `SM-04` | Automated CI gate reliability | 100% pass rate required on PHP lint, PHPUnit tests, OpenAPI validation, frontend lint/build, and Compose validation before merge to `main`. | **Approved** |
| `SM-05` | UI/UX responsive & accessibility compliance | Zero horizontal overflow across mobile (`375px`), tablet (`768px`), and desktop (`1280px+`) viewports; all status badges pair color with text/icons. | **Approved** |
| `SM-06` | Operational latency & availability targets | Specific production SLA/SLO numerical thresholds (e.g., p95 API latency, outbox max age) to be calibrated during Phase 19 baseline before alert tuning. | **Pending Phase 19 Baseline** |

---

## 11. Definition of Done for the MVP

The ToothCare Hub MVP is complete only when all of the following conditions are verified with evidence:

1. All **Must** MVP requirements in `docs/phase-0/requirements-register.md` are implemented and verified.
2. Schema migrations build cleanly from an empty MySQL database and enforce foreign keys, indexes, and constraints.
3. Public landing page loads live services from `/api/v1/services`, handles loading/empty/error states, and routes booking CTAs properly for signed-in and signed-out users.
4. Patients, Dentists, and Admins can complete their end-to-end journeys according to `docs/phase-0/role-permission-matrix.md`.
5. Concurrent booking conflicts are prevented by transaction-safe server locking and verified by automated concurrency tests.
6. Email outbox worker and Socket.IO real-time notifications operate post-commit with verified failure/reconnect fallbacks.
7. OpenAPI 3.x documentation (`backend/docs/openapi.yaml`) matches implemented endpoints and passes validation in CI.
8. Docker Compose (`docker-compose.yml` / `docker-compose.prod.yml`), Nginx routing, Prometheus scrape targets, and Grafana provisioned dashboards start cleanly and keep internal ports private.
9. No secrets, `.env` files, or real patient data exist in Git history or container images.

---

## 12. Approval Status, Decision Owners, and Revision History

### Approval Sign-Off Table

| Role | Decision / Responsibility Area | Assigned Owner | Approval Status | Date |
|---|---|---|---|---|
| Project Sponsor / Clinic Owner | Business objectives, MVP scope, clinic appointment policies (`DEC-POL-001`..`014`) | Project Owner | **Approved** | `2026-10-27` |
| Lead Software Architect | System architecture, database concurrency, API & Docker boundaries (`DEC-TECH-001`) | Lead Architect / Project Owner | **Approved** | `2026-10-27` |
| Security & Privacy Lead | RBAC matrix (`DEC-ROLE-001`), token security, PII minimization, network isolation | Security Lead / Project Owner | **Approved** | `2026-10-27` |
| QA & Release Lead | Test strategy, acceptance criteria, CI gates, UAT sign-off | QA Lead / Project Owner | **Approved** | `2026-10-27` |

### Revision History

| Version | Date | Author | Summary of Changes |
|---|---|---|---|
| `1.0` | `2026-10-27` | Senior Architect / BA / TPM / Security / QA Lead | Initial Phase 0 Project Brief inspected against existing repository and approved by Project Owner. |

