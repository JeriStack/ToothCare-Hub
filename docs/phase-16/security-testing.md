# Phase 16 — Security Testing Coverage

Automated security tests verify adversarial inputs and access-control boundaries rather than relying on checklists alone:

- **Authentication & Role Escalation**: `SecurityApiTest`, `Phase16BusinessRuleRegressionTest` — invalid login (`401`), public registration with `role: "ADMIN"` forced to `PATIENT`, rate-limit enforcement, and expired/reused token rejection.
- **Authorization & IDOR**: `PatientPortalSecurityTest`, `DentistAppointmentAuthorizationTest`, `Phase15DashboardSearchReportsTest`, `Phase16BusinessRuleRegressionTest` — cross-patient appointment/notification access denied (`403`/`404`), cross-dentist access denied (`403`), and role-scoped `/api/v1/appointments/search` ignores client-supplied `patient_id`/`dentist_id`.
- **Input, SQLi, XSS, & CSRF**: Parameterized PDO search tested with SQL injection payloads (`' OR '1'='1'; DROP TABLE appointments; --`), `CsrfMiddlewareTest`, `ProfilePhotoUploader.jsx` (CodeQL `js/xss-through-dom` eliminated).
- **Real-Time Socket.IO Security**: `RealtimeNotificationsTest` (PHP) + `realtime/tests/realtime.test.ts` (Node) — single-use hashed ticket verification, rejection of expired/reused/query-string tickets, HMAC-SHA256 internal publisher replay protection, server-controlled rooms, and default-deny client event blocking.
- **Secret & Log Hygiene**: `Phase15DashboardSearchReportsTest` verifies stack traces, filesystem paths, and `token=`/`password=` secrets are redacted from `/api/v1/admin/operations/*`.
