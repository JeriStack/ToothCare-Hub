# Authorization, RBAC/DRBAC & Ownership Controls

Every protected endpoint under `/api/v1` enforces server-side authentication (`AuthenticationMiddleware`) and authorization (`AuthorizationMiddleware` + controller/service ownership checks). Client-side UI guards are for UX only and are never trusted for security.

---

## 1. Roles

| Role | Scope & Responsibilities |
|---|---|
| `ADMIN` | Full clinic administration: users, DRBAC role-permission matrices, clinic hours/closures, services, dentists, receptionists, appointments, executive dashboard, reports, audit logs, email/realtime outbox, and redacted operational errors. |
| `RECEPTIONIST` | Front-desk operations: daily arrival schedule, patient check-ins, live waiting queue, walk-in intake/booking, appointment confirmation/rejection/cancellation, and front-desk KPIs. |
| `DENTIST` | Scoped clinical operations: own profile/avatar, own assigned appointments (`/dentist/appointments*`), marking assigned confirmed visits `COMPLETED`, clinical treatment records (`/treatment-records*`), and time-off requests. |
| `PATIENT` | Self-service portal: own profile/avatar (`/patients/me*`), own appointments (`/appointments*`), cancelling/rescheduling own eligible appointments, and own notifications (`/notifications*`). |

---

## 2. Dynamic Role-Based Access Control (DRBAC)

Administrative and clinical routes enforce granular permission slugs (for example `appointments.view`, `appointments.confirm`, `appointments.complete`, `treatment_records.create`, `reports.view`, `email_outbox.view`, `email_outbox.retry`, `audit_logs.view`).

Administrators can inspect and manage role permissions via:
- `GET /api/v1/admin/roles`
- `GET /api/v1/admin/permissions`
- `GET /api/v1/admin/roles/{roleId}/permissions`
- `PUT /api/v1/admin/roles/{roleId}/permissions`
- `PATCH /api/v1/admin/roles/{roleId}/permissions`

---

## 3. Resource Ownership (IDOR Prevention)

- **Patients** calling `/appointments/{id}`, `/appointments/{id}/cancel`, `/appointments/{id}/reschedule`, `/patients/{id}`, or `/notifications/{id}/read` are restricted strictly to records they own (`patient_user_id === current_user_id`). Cross-user access returns `403 Forbidden` or `404 Not Found`.
- **Dentists** calling `/dentist/appointments/{id}`, `/dentist/appointments/{id}/complete`, or `/treatment-records*` are restricted to appointments assigned to their `dentist_id`.
- **Privilege Escalation Prevention:** Self-registration always assigns `PATIENT`; role changes are restricted to `ADMIN` endpoints (`PATCH /api/v1/admin/users/{id}/role`).
