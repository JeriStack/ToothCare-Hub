# ToothCare Hub — Demo Accounts & Database Authentication

## 1. Overview
ToothCare Hub has migrated all demo accounts into the actual MySQL database (`toothcare-mysql`). All client-side mock authentication fallbacks and quick-login shortcut bars have been completely removed from the frontend.

Every login request submitted via `LoginForm.jsx` sends a real POST request to `/api/v1/auth/login`, executing cryptographic Argon2id password verification against the `users` table in MySQL.

---

## 2. Canonical Demo Accounts

All demo accounts share the standard password: `Password123!`

| Role | Email Address | Password | Profile Association | Primary Capabilities |
|---|---|---|---|---|
| **Patient** | `patient.juan@example.com` | `Password123!` | Juan Dela Cruz (`patients` ID: 1) | Book visits, view dentists/services, view personal dental records, notification center |
| **Dentist** | `dr.santos@toothcare.local` | `Password123!` | Dr. Maria Santos (`dentists` ID: 1) | Manage caseload, complete appointments, edit FDI treatment records, view medical alerts |
| **Admin** | `admin@toothcare.local` | `Password123!` | System Administrator | Manage users, clinics, schedules, services, audit logs, and settings |
| **Staff / Receptionist** | `receptionist@toothcare.local` | `Password123!` | Staff Receptionist | Review incoming appointments, confirm bookings, triage schedule slots |

---

## 3. Secondary Seeded Accounts (for Multi-Clinician Testing)

| Role | Email Address | Password | Profile |
|---|---|---|---|
| Dentist | `dr.reyes@toothcare.local` | `Password123!` | Dr. Roberto Reyes (Orthodontics & Restorative) |
| Dentist | `dr.lim@toothcare.local` | `Password123!` | Dr. Carmela Lim (Endodontics) |
| Patient | `patient.maria@example.com` | `Password123!` | Maria Garcia |
| Patient | `patient.elena@example.com` | `Password123!` | Elena Gomez (Penicillin allergy alert) |
| Patient | `patient.roberto@example.com` | `Password123!` | Roberto Tan (Asthma alert) |

---

## 4. Verification Command
To verify that these accounts can authenticate directly through the backend API:

```bash
# Test Patient Login
curl -i -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"patient.juan@example.com","password":"Password123!"}'

# Test Dentist Login
curl -i -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dr.santos@toothcare.local","password":"Password123!"}'

# Test Admin Login
curl -i -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@toothcare.local","password":"Password123!"}'
```
