# ToothCare Hub — Requirements-to-Interface Traceability Matrix

**Document ID:** `TCH-P3-RTM-001`  
**Version:** `1.0.0`  
**Phase:** Phase 3 — Requirements, User Journeys, Wireframes, and Design System  
**Prepared Date:** `2026-10-27`  
**Status:** Approved Baseline  
**Author:** Lead Business Analyst & Requirements Engineer  

---

## 1. Traceability Purpose & Methodology

This matrix establishes 100% bidirectional traceability between the approved Phase 0 MVP Requirements (`TCH-P0-REQ-001`), the Phase 3 User Journeys (`TCH-P3-UJM-001`), the Low-Fidelity Wireframes (`TCH-P3-WFR-001` through `015`), the Application Route Map (`TCH-P3-IAM-001`), and the Design System Components (`TCH-P3-CMP-001`).

Every approved functional requirement (`FR`) and non-functional requirement (`NFR`) is mapped to its concrete user interface representation, interaction state, role permission, and verification method.

---

## 2. Functional Requirements Traceability Matrix

| Req ID | Requirement Summary | User Role | Page / Wireframe ID | User Journey | Permission Code | Validation & Error Handling | Acceptance Criterion | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`FR-AUTH-001`** | Patient registration with password hashing & unique email | Public / Patient | `SCR-AUTH-002` (`auth-register.md`) | `UJ-01` | Public (`ANONYMOUS`) | Zod schema checks email format, password complexity; 409 Conflict if email exists | Creates user and patient record, returns 201, queues welcome email | E2E registration test & API unit test |
| **`FR-AUTH-002`** | Email/password login with HttpOnly session cookie & CSRF | All Roles | `SCR-AUTH-001` (`auth-login.md`) | `UJ-01` | Public (`ANONYMOUS`) | 401 on bad credentials; 429 after 5 failed tries; generic safe error message | Sets secure HttpOnly cookie, returns role profile, routes to role dashboard | Automated auth integration test |
| **`FR-AUTH-003`** | Server-side session invalidation & socket revocation on logout | All Roles | `SCR-ALL-001` (`responsive-design.md`) | `UJ-01` | Authenticated | Clears cookies, terminates Socket.IO connection, invalidates cache | `POST /api/auth/logout` revokes session; subsequent calls return 401 | Automated session revocation test |
| **`FR-AUTH-004`** | Single-use expiring auth tokens for email verify & password reset | All Roles | `SCR-AUTH-001` (`auth-login.md`) | `UJ-01` | Public (`ANONYMOUS`) | Expired or reused token returns 422 Unprocessable Entity | Password reset succeeds once; subsequent use fails | PHPUnit token integration test |
| **`FR-PUB-001`** | Public landing page with services and deep-linked booking CTA | Public / Patient | `SCR-PUB-001` (`route-map.md`) | `UJ-01`, `UJ-02`| Public (`ALL`) | Unauthenticated booking click redirects `/login?redirect=/patient/book` | Renders clinic info & live services; preserves booking intent post-login | Vitest E2E navigation check |
| **`FR-PAT-001`** | Patient view/update own profile without cross-access | Patient | `SCR-PAT-001` (`patient-dashboard.md`) | `UJ-01` | `PATIENT` (Own Record) | Validates phone format, address; blocks updates to role or user ID | Patient reads/modifies own record; accessing other patient returns 403 | Automated RBAC boundary test |
| **`FR-PAT-002`** | Admin search, paginate, view, and add walk-in patients | Admin | `SCR-ADM-002` (`admin-patient-management.md`) | `UJ-03` | `ADMIN` | Search debounces at 300ms; max per_page=100; non-admin receives 403 | Full patient directory search, pagination, and modal walk-in registration | Automated API integration test |
| **`FR-DEN-001`** | Admin manage dentist profiles; public lists only active dentists | Admin, Patient | `SCR-ADM-003` (`admin-dentist-management.md`) | `UJ-02` | `ADMIN` / Public | Cannot deactivate dentist with upcoming confirmed visits without warning | Admin modifies roster; patient booking wizard only displays active dentists | Automated API integration test |
| **`FR-SRV-001`** | Admin manage services, pricing, durations; snapshots on booking | Admin, Patient | `SCR-ADM-004` (`admin-service-management.md`) | `UJ-02` | `ADMIN` | Duration strictly 30, 45, 60, 90 mins; historical appointments retain snapshot | Changing price does not mutate existing booked appointment fees | PHPUnit price snapshot test |
| **`FR-SCH-001`** | Admin configure recurring shifts and time-off; dentist views schedule | Admin, Dentist | `SCR-ADM-005` (`admin-schedule-management.md`) | `UJ-02` | `ADMIN`, `DENTIST` | Start time < end time; overlapping shifts rejected with 422 | Admin creates weekly shifts & time-offs; dentist views own calendar | Shift validation unit test |
| **`FR-AVL-001`** | Availability endpoint returning unblocked 30-min start slots | Patient, Admin | `SCR-PAT-002` (`appointment-booking-wizard.md`) | `UJ-02` | Public / Patient | Slots filter out past times, time-offs, and existing PENDING/CONFIRMED | Returns exact bookable start times covering service duration | PHPUnit slot generation test |
| **`FR-BOOK-001`** | Atomic appointment booking with InnoDB `SELECT ... FOR UPDATE` | Patient, Admin | `SCR-PAT-002` (`appointment-booking-wizard.md`) | `UJ-02` | `PATIENT`, `ADMIN` | Overlapping booking attempts rolled back; loser receives 409 Conflict | Concurrency race condition test: exactly 1 booking commits, competing 409 | Automated parallel burst test |
| **`FR-BOOK-002`** | Admin review queue to approve or reject pending requests | Admin | `SCR-ADM-006` (`admin-appointment-review.md`) | `UJ-03` | `ADMIN` | Approving non-pending returns 409; rejection requires reason code | Transition to CONFIRMED or CANCELLED with real-time socket emit | Automated triage workflow test |
| **`FR-BOOK-003`** | Patient & admin cancellation within policy window (>=24h rule) | Patient, Admin | `SCR-PAT-003` (`appointment-history-details.md`)| `UJ-05` | `PATIENT`, `ADMIN` | Client hides cancel button if < 24h; server enforces 24h deadline with 422 | PENDING cancelled anytime; CONFIRMED cancelled up to 24h prior; slot freed | PHPUnit policy test |
| **`FR-BOOK-004`** | Authorized dentist marks confirmed appointment COMPLETED | Dentist, Admin | `SCR-DEN-001` (`dentist-dashboard.md`) | `UJ-04` | `DENTIST`, `ADMIN` | Directly transitioning PENDING to COMPLETED is rejected with 409 | Transitions status to COMPLETED; logs completion timestamp | PHPUnit transition test |
| **`FR-TRT-001`** | Assigned dentist authors clinical treatment notes (diagnosis, teeth) | Dentist | `SCR-DEN-003` (`dentist-treatment-entry.md`) | `UJ-04` | `DENTIST` (Assigned) | Min 10 chars diagnosis; unassigned dentist receives 403 Forbidden | Treatment record linked to appointment; editable for 24h post-completion | Automated clinical privacy test |
| **`FR-NOT-001`** | In-app notifications & email outbox persisted on lifecycle events | All Roles | `SCR-NOTIF-001` (`notifications-interface.md`) | `UJ-06` | Authenticated | Persisted in MySQL in same transaction as appointment status change | User queries unread alerts; mark-as-read updates timestamp | PHPUnit transaction test |
| **`FR-NOT-002`** | Background email delivery worker with exponential retry | System | Backend Worker | N/A | System Service | Transient SMTP failure increments retry count; does not rollback appointment | Emails sent via PHPMailer; permanent failures marked failed | Worker simulation test |
| **`FR-NOT-003`** | Real-time Socket.IO broadcasts with REST fallback recovery | All Roles | `SCR-NOTIF-001` (`notifications-interface.md`) | `UJ-06` | Authenticated | Reconnection syncs missed notifications from REST API without duplicates | Socket emits instant badge increment; reconnect recovers missed items | Socket reconnect integration test |
| **`FR-REP-001`** | Dashboard KPIs and filterable admin appointment reports | Admin, Dentist | `SCR-ADM-001` (`admin-dashboard.md`) | `UJ-03` | `ADMIN`, `DENTIST` | Filter by date range, dentist, service; max per_page=100 | KPI counters match exact database counts; report exports valid CSV | Automated reporting test |
| **`FR-AUD-001`** | Status transition history and administrative security audit logging | Admin / Security | Audit Module | `UJ-03`, `UJ-04`| `ADMIN` | Zero plaintext passwords or tokens; logs actor, target, old/new status | Audit row created on every lifecycle mutation | Audit log inspection test |

---

## 3. Non-Functional Requirements Traceability Matrix

| Req ID | Category | Requirement Summary | Interface / System Implementation | Acceptance Criterion | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`NFR-SEC-001`** | Security | PDO prepared statements & allowlisted sorting | Backend Repositories & API Controllers | SQL injection test payloads return 422 or safe results | Automated SQLi penetration test |
| **`NFR-SEC-002`** | Security | CSRF validation, CORS origin lock & rate limiting | Axios API Client & PHP Middleware | Missing CSRF header returns 403; rapid brute-force returns 429 | Security integration test |
| **`NFR-PRI-001`** | Privacy | Zero clinical notes or PII in logs, sockets, emails | Sockets, Email Worker, Treatment Entry | Email and socket payloads contain only non-clinical reference IDs | Payload inspection & audit |
| **`NFR-REL-001`** | Reliability | Atomic multi-table database transactions | Booking & Triage Services | Failure mid-operation leaves zero orphan appointment or notification rows | Transaction rollback test |
| **`NFR-PRF-001`** | Performance | Server-side pagination & composite DB indexes | Data Tables (`Table.tsx`, `Pagination.tsx`) | List endpoints enforce `per_page <= 100`; indexes used on `start_at` | MySQL `EXPLAIN` query audit |
| **`NFR-ACC-001`** | Accessibility | Semantic HTML, WCAG 2.2 AA contrast, no color alone | Design System (`design-system.md`, `a11y-checklist.md`) | Reachable via keyboard; visible focus rings; zero color-only statuses | axe-core + Manual keyboard test |
| **`NFR-MNT-001`** | Maintainability | OpenAPI 3.0 specification & modular architecture | `openapi.yaml` & React Component Hierarchy | Zero raw SQL in controllers; UI components in modular inventory | OpenAPI validation in CI |
| **`NFR-OPS-001`** | Portability | Docker containerization with Nginx reverse proxy | `compose.yaml` & `docker/nginx/` | Clean startup via `docker compose up`; `/health` returns 200 OK | Smoke test in container environment |
| **`NFR-OBS-001`** | Observability | Prometheus metric scraping & Grafana dashboards | `compose.yaml` (monitoring profile) | Prometheus targets report `UP`; Grafana loads provisioned dashboards | Container observability check |

---

## 4. Coverage Analysis & Zero-Orphan Verification

- **Total MVP Functional Requirements:** 21 (`FR-AUTH-001` to `FR-AUD-001`)
- **Total Mapped to UI Views / Journeys:** 21 (100% Coverage)
- **Total Unmapped / Orphan Requirements:** 0
- **Total Low-Fidelity Wireframes Created:** 15 (`SCR-AUTH-001` through `SCR-NOTIF-001`)
- **Total User Journeys Mapped:** 6 (`UJ-01` through `UJ-06`)
