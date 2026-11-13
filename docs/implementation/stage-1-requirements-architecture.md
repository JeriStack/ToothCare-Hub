# Stage 1 — Requirements and Architecture Review Report

**Project:** ToothCare Hub — Dental Appointment and Clinic Management System  
**Document ID:** `TCH-STAGE1-AUDIT-001`  
**Version:** `1.0.0`  
**Date:** `2026-11-07`  
**Status:** `COMPLETED / PASSED`  
**Phase Target:** `Phase 0–10 Master Alignment & Baseline Validation`

---

## 1. Executive Summary

This audit establishes the definitive baseline of the ToothCare Hub codebase, confirming existing capabilities, verified architectural boundaries, database schemas, REST API contracts, and the sequential execution roadmap for Stages 2 through 9.

ToothCare Hub is architected as a **decoupled multi-tier web application**:
- **Frontend:** Single-page application built with React 18, TypeScript, Vite, Tailwind CSS, and Lucide React iconography, adhering to the Impeccable Design System.
- **Backend:** Native PHP 8.2+ without frameworks, utilizing PSR-4 autoloading, a lightweight front-controller router, PDO connection pooling, and strict layered architecture (Controllers -> Validators -> Services -> Repositories -> MySQL).
- **Database:** MySQL 8.0 / InnoDB engine with 16 versioned migrations, transactional concurrency control (`SELECT ... FOR UPDATE` pessimistic slot locking), and synthetic development seed fixtures.
- **Security:** Server-governed sessions (`toothcare_session`, `HttpOnly`, `SameSite=Lax`), per-session CSRF token validation, Argon2id/Bcrypt password hashing, and strict role-based access control (`PATIENT`, `DENTIST`, `ADMIN`).

---

## 2. Architecture Summary

```
                      +-----------------------------------+
                      |   Client Web Browser (Desktop/    |
                      |   Mobile / Tablet Responsive)     |
                      +-----------------+-----------------+
                                        |
                 HTTP / Session Cookie  |  CSRF Token Header
                 withCredentials: true  |  X-CSRF-Token
                                        v
                      +-----------------+-----------------+
                      |     Nginx Gateway / Web Server    |
                      |     Reverse Proxy (:80 / :443)    |
                      +--------+-----------------+--------+
                               |                 |
                   Static Asset|                 | API Calls
                   Requests    |                 | /api/v1/*
                               v                 v
                 +-------------+---+   +---------+---------------+
                 | React SPA (Vite)|   | Native PHP Application  |
                 | Built Assets    |   | Entry: index.php        |
                 +-----------------+   +----+--------------------+
                                            |
                                            | Middleware Pipeline
                                            | - RequestIdMiddleware
                                            | - CorsMiddleware
                                            | - RateLimitMiddleware
                                            | - AuthenticationMiddleware
                                            | - AuthorizationMiddleware
                                            | - CsrfMiddleware
                                            v
                                       +----+--------------------+
                                       | API Router (api.php)    |
                                       +----+--------------------+
                                            |
                                            v
                                       +----+--------------------+
                                       | Controllers & Services  |
                                       +----+--------------------+
                                            |
                                            v
                                       +----+--------------------+
                                       | Repositories (PDO)      |
                                       +----+--------------------+
                                            |
                                            v
                               +------------+------------+
                               | MySQL 8.0 (InnoDB)      |
                               | Pessimistic Row Locking |
                               +-------------------------+
```

---

## 3. Existing Functionality Inventory

### 3.1 Public Website & Presentation
- **Landing Page:** Interactive presentation of the clinic, value propositions, dynamic dental services catalog, certified dentist profiles, interactive workflow explanation, booking CTA, and clinic footer.
- **Navigation:** Floating sticky navigation bar with active scroll-spy tracking, smooth anchor navigation, and responsive mobile drawer menu.
- **Brand Identity:** Standardized medical palette (Deep Navy `#12304A`, ToothCare Teal `#0D9488`, Soft Teal `#CCFBF1`, Cool Canvas `#F5F8FA`). Default light mode locked system-wide.

### 3.2 Authentication & Account Security
- **Unified Login:** Single login screen supporting all three user roles (`PATIENT`, `DENTIST`, `ADMIN`) without client-side role selectors.
- **Patient Registration:** Public self-registration strictly hardcoded to the `PATIENT` role on the server. Includes real-time 8-character password validation with justified requirement indicators.
- **Password Recovery & Reset:** Generic email submission endpoint, secure single-use token generation, and password reset form.
- **Email Verification:** Token-based account verification workflow.
- **Session Lifecycle:** Server-side PHP session management, automated session ID regeneration upon login, and secure session teardown on logout.
- **CSRF Defense:** `GET /api/v1/auth/csrf-token` with automatic header injection (`X-CSRF-Token`) on state-changing requests.

### 3.3 Patient Management & Booking Experience
- **Service Catalog Browsing:** Real-time fetching of active clinic procedures (`GET /api/v1/services`).
- **Dentist Directory Browsing:** Public listing of certified clinicians (`GET /api/v1/dentists`).
- **Dynamic Slot Availability:** Real-time slot calculation (`GET /api/v1/availability`) respecting dentist schedules, service durations, buffer times, schedule exceptions, and time-off.
- **Appointment Booking:** Server-side pessimistic locking (`SELECT ... FOR UPDATE`) preventing double-booking during concurrent requests (`POST /api/v1/appointments`).
- **Patient Dashboard & History:** Authenticated patient view displaying upcoming visits and historical appointment timelines.

### 3.4 Administrative Operations
- **Clinic Services CRUD:** Create, update, activate, and deactivate dental services without breaking past booking snapshots.
- **Dentist Profile & Account CRUD:** Provision dentist profiles, configure specializations, and manage account activation.
- **Schedule Management:** Configure recurring weekly weekday shifts, operatory chair assignments, and time-off blocks.
- **Appointment Review:** Administrative triage to confirm (`CONFIRMED`), reject (`REJECTED`), or mark completed (`COMPLETED`) with automated audit trail logging.
- **Operational Metrics:** Database-driven aggregation of active patients, dentists, pending/confirmed appointments, and chair occupancy.

### 3.5 Dentist Clinical Operations
- **Dentist Portal:** Overview of assigned appointments scoped to the authenticated clinician's `dentist_id`.
- **Clinical Details:** Authorized access to patient visit context for scheduled procedures.

---

## 4. Frontend Route Inventory

All frontend routes are mapped and guarded within `frontend/src/app/App.jsx`:

| Path | Internal Route Key | Access Level | Description |
|---|---|---|---|
| `/` | `LANDING` | Public | Clinic landing page with dynamic service catalog and dentists |
| `/login` | `LOGIN` | Public (Unauthenticated) | Unified login form for all roles |
| `/register` | `REGISTER` | Public (Unauthenticated) | Patient self-registration form |
| `/forgot-password`, `/forgot` | `FORGOT_PASSWORD` | Public (Unauthenticated) | Password recovery request form |
| `/reset-password`, `/reset` | `RESET_PASSWORD` | Public (Token-governed) | Tokenized password reset form |
| `/verify-email`, `/verify` | `VERIFY_EMAIL` | Public (Token-governed) | Email verification confirmation view |
| `/patient` | `PATIENT` | Authenticated (`PATIENT` only) | Patient portal: Dashboard, Booking wizard, History |
| `/dentist` | `DENTIST` | Authenticated (`DENTIST` only) | Dentist clinical portal: Assigned schedule & appointments |
| `/admin` | `ADMIN` | Authenticated (`ADMIN` only) | Administrative portal: Metrics, Appointments, Services, Dentists, Schedules, Patients |

---

## 5. Backend REST API Endpoint Inventory

All endpoints are prefixed with `/api/v1` and defined in `backend/src/Routes/api.php`:

### Public Endpoints
- `GET /health` — Application and database health checks
- `GET /metrics` — Prometheus telemetry scrape target
- `POST /auth/register` — Patient self-registration (rate-limited)
- `POST /auth/login` — Unified authentication (rate-limited)
- `GET /auth/csrf-token` — Retrieve active CSRF token for the session
- `POST /auth/verify-email` — Verify patient account token
- `POST /auth/resend-verification` — Re-issue verification token
- `POST /auth/forgot-password` — Issue password recovery token
- `POST /auth/reset-password` — Complete password recovery
- `GET /services` — List public active dental services
- `GET /dentists` — List public active certified dentists
- `GET /availability` — Compute real-time bookable intervals
- `GET /clinic/hours` — Retrieve operating hours
- `GET /clinic/closures` — Retrieve scheduled clinic closures
- `GET /dentists/{id}/schedules` — Retrieve clinician shifts
- `GET /dentists/{id}/time-off` — Retrieve clinician scheduled leave

### Authenticated Common Endpoints
- `POST /auth/logout` — Terminate session and clear cookie
- `GET /auth/me` — Retrieve session identity and profile context

### Patient Endpoints (`PATIENT` Role)
- `GET /patients/{id}` — Retrieve personal patient profile (ownership enforced)
- `PATCH /patients/{id}` — Update permitted profile fields
- `POST /appointments` — Submit appointment request (pessimistic lock)
- `GET /appointments` — List personal appointment records
- `GET /appointments/{id}` — View personal appointment details
- `POST /appointments/{id}/cancel` — Cancel pending/confirmed appointment (policy enforced)
- `POST /appointments/{id}/reschedule` — Atomic reschedule request

### Dentist Endpoints (`DENTIST` Role)
- `GET /dentist/appointments` — List appointments assigned to authenticated clinician

### Administrative Endpoints (`ADMIN` Role)
- `GET /admin/dashboard` — Live clinic KPIs and summary counts
- `GET /admin/services` — List all services (active and inactive)
- `POST /admin/services` — Create new dental service
- `GET /admin/services/{id}` — View service details
- `PUT /admin/services/{id}` — Update service information
- `PATCH /admin/services/{id}/status` — Toggle service activation
- `GET /admin/dentists` — List all dentists
- `POST /admin/dentists` — Provision new dentist profile
- `GET /admin/dentists/{id}` — View dentist details
- `PUT /admin/dentists/{id}` — Update dentist profile
- `PATCH /admin/dentists/{id}/status` — Toggle dentist activation
- `PUT /admin/clinic/hours` — Update clinic operating hours
- `GET /admin/clinic/closures` — List clinic closures
- `POST /admin/clinic/closures` — Record clinic closure
- `DELETE /admin/clinic/closures/{id}` — Remove clinic closure
- `GET /admin/dentists/{id}/schedules` — List schedules for dentist
- `POST /admin/dentists/{id}/schedules` — Add recurring shift
- `PUT /admin/dentists/{id}/schedules/{scheduleId}` — Update shift
- `DELETE /admin/dentists/{id}/schedules/{scheduleId}` — Remove shift
- `GET /admin/dentists/{id}/time-off` — List dentist leave
- `POST /admin/dentists/{id}/time-off` — Record dentist leave
- `DELETE /admin/dentists/{id}/time-off/{timeOffId}` — Remove dentist leave
- `GET /admin/patients` — Paginated patient directory
- `GET /admin/patients/{id}` — View patient record
- `PUT /admin/patients/{id}` — Update patient record
- `PATCH /admin/patients/{id}/status` — Toggle patient account status
- `GET /admin/appointments` — Full clinic appointment management list
- `GET /admin/appointments/{id}` — View full appointment detail
- `PATCH /admin/appointments/{id}/confirm` — Approve appointment request
- `PATCH /admin/appointments/{id}/reject` — Reject appointment request
- `PATCH /admin/appointments/{id}/complete` — Complete confirmed visit
- `GET /admin/audit-logs` — Query immutable administrative security audit trail

---

## 6. Database Table Inventory (17 Tables)

| # | Table Name | Engine | Purpose | Primary Relationships |
|---|---|---|---|---|
| 1 | `schema_migrations` | InnoDB | Versioned migration tracking | Independent |
| 2 | `users` | InnoDB | Base account authentication credentials and roles | `1:1` with `patients` or `dentists` |
| 3 | `patients` | InnoDB | Demographic, medical alerts, emergency contact data | `FK -> users.id` |
| 4 | `dentists` | InnoDB | Professional clinical profiles, chairs, licenses | `FK -> users.id` |
| 5 | `services` | InnoDB | Catalog of clinic procedures, durations, and fees | Referenced by `appointments` |
| 6 | `dentist_schedules` | InnoDB | Recurring weekly clinician shifts | `FK -> dentists.id` |
| 7 | `dentist_time_off` | InnoDB | Clinician vacation, sick leave, and blocked hours | `FK -> dentists.id` |
| 8 | `appointments` | InnoDB | Core booking records with duration & fee snapshots | `FK -> patients.id`, `dentists.id`, `services.id` |
| 9 | `appointment_status_history` | InnoDB | Append-only audit trail of lifecycle status changes | `FK -> appointments.id`, `users.id` |
| 10 | `treatment_records` | InnoDB | Clinical diagnosis, procedure notes, recommendations | `FK -> appointments.id`, `dentists.id`, `patients.id` |
| 11 | `notifications` | InnoDB | In-app user notifications | `FK -> users.id` |
| 12 | `email_outbox` | InnoDB | Outbox queue for background transactional email dispatch | `FK -> users.id` |
| 13 | `auth_tokens` | InnoDB | Hashed single-use tokens for verification & password reset | `FK -> users.id` |
| 14 | `audit_logs` | InnoDB | Security and operational action log | `FK -> users.id` |
| 15 | `rate_limits` | InnoDB | IP- and route-based rate limit tracking | Independent |
| 16 | `clinic_operating_hours` | InnoDB | Standard clinic opening and closing times by day | Independent |
| 17 | `clinic_closures` | InnoDB | Holiday and emergency full-day clinic closures | Independent |

---

## 7. Authentication & Role Model Review

```
                    +---------------------------+
                    |        users table        |
                    | id, email, password_hash  |
                    | role ENUM, is_active      |
                    +-------------+-------------+
                                  |
         +------------------------+------------------------+
         | role = 'PATIENT'       | role = 'DENTIST'       | role = 'ADMIN'
         v                        v                        v
+------------------+     +------------------+     +------------------+
|  patients table  |     | dentists table   |     | Unified Admin    |
|  user_id (FK)    |     | user_id (FK)     |     | Staff Role       |
|  Demographics    |     | License & Chair  |     | Clinic Governance|
+------------------+     +------------------+     +------------------+
```

- **Unified Single-Portal Login:** Users authenticate via `POST /api/v1/auth/login`. The server inspects `users.role` and responds with the authenticated role.
- **Client Route Dispatch:** The frontend routes the user to `/patient`, `/dentist`, or `/admin` based strictly on server response.
- **Server Authorization Authority:** All backend controllers apply `AuthenticationMiddleware` and `AuthorizationMiddleware` independently of client state.

---

## 8. Existing Design System Inventory

Defined in `DESIGN.md` and enforced via Impeccable Agent standards:
- **Palette:**
  - Navy: `#12304A` (Headings, primary typography, brand marks)
  - Navy Deep: `#0B1D2D` (Header accents, elevated surfaces)
  - ToothCare Teal: `#0D9488` (Primary CTAs, action links, brand highlight)
  - Teal Deep: `#0F766E` (Button hover, active accents)
  - Soft Teal: `#CCFBF1` (Active pill badges, subtle selections)
  - Canvas: `#F5F8FA` (Cool medical page canvas)
  - Body Slate: `#334155` (Secondary copy, descriptions)
- **Typography:** Inter sans-serif font stack.
- **Theme Standard:** Standardized on calm clinical Light Mode; dark mode media queries locked out.
- **UI Components:**
  - `Button.jsx` (Primary, Outline, Ghost, Danger variants with loading spinners)
  - `Input.jsx` (Accessible form controls with error states and inset icons)
  - `Modal.jsx` (Accessible dialog overlays with escape and backdrop dismiss)
  - `StatusBadge.jsx` (Semantic status indicator for appointment lifecycles)
  - `EmptyState.jsx` (Structured empty-record placeholders)
  - `LoadingSpinner.jsx` (Async feedback indicators)
  - `ToothCareLogo.jsx` (Official brandmark SVG/image component)

---

## 9. Gap Analysis & Missing Functionality

1. **Unused Router Files:** `frontend/src/app/router.jsx` and `frontend/src/app/providers.jsx` are currently 0-byte empty files. All routing is housed in `App.jsx`.
2. **Mock Data Deprecation:** `frontend/src/app/mockData.js` still contains fallback fixture catalogs (`INITIAL_SERVICES`). All modules must consistently consume live backend API responses.
3. **Appointment Booking Flow Polish:** Ensure the patient booking wizard handles all error responses from `/api/v1/availability` and `/api/v1/appointments` with clear inline feedback.
4. **Treatment Records UI:** Dentist clinical note authoring (`/treatment-records`) is scaffolded in backend routes but requires full end-to-end frontend integration.

---

## 10. Conflicting or Duplicated Implementations

- **Theme Toggle:** Successfully removed; default light mode enforced.
- **Session Tokens:** No JWT tokens are used; native PHP session cookies with CSRF tokens are the single source of truth.
- **Role Enforcement:** Fully centralized in `AuthService.php` and `AuthorizationMiddleware.php`.

---

## 11. Implementation Roadmap & Dependency Plan

```
STAGE 1: Requirements and Architecture Review [COMPLETED]
   │
   ▼
STAGE 2: Impeccable Design Foundation (Design tokens, reusable components, accessibility)
   │
   ▼
STAGE 3: Public Landing Page (Dynamic services, dynamic dentists, booking CTAs)
   │
   ▼
STAGE 4: Login and Patient Registration (Unified login, 8-char validation, recovery)
   │
   ▼
STAGE 5: Authentication Integration (Session handling, CSRF, route guards, error handling)
   │
   ▼
STAGE 6: Role-Specific Dashboards (Patient, Dentist, and Administrator real-data views)
   │
   ▼
STAGE 7: Admin, Dentist, and Patient Management Modules (Full CRUD, pagination, filtering)
   │
   ▼
STAGE 8: Scheduling and Appointment Booking Integration (Pessimistic locking, availability engine)
   │
   ▼
STAGE 9: End-to-End Testing and Final Refinement (PHPUnit, Vitest, Impeccable audit, CI pass)
```

---

## 12. Verification & Quality Gates Status

- **PHPUnit Test Suite:** `137/137 tests passing (854 assertions OK)`.
- **Frontend Build:** `npm run build --prefix frontend` builds cleanly in ~11s with 0 errors.
- **Impeccable Static Scan:** 0 anti-patterns across all 76 frontend source files.
- **Database Status:** 16 migrations applied and development seed runner operational.
