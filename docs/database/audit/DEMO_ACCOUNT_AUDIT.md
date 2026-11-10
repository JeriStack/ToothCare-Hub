# ToothCare Hub — Demo Accounts & Frontend Integration Audit

**Scope:** Canonical User Accounts, Password Hashes, Role Profiles, Frontend Shortcut Removal, Seeder Idempotency  
**Audit Status:** PASSED (All Accounts Authenticating Through Real Database)

---

## 1. Demo Accounts Verification Matrix

Every canonical demo account was verified directly against the running MySQL 8.0 database in Docker (`toothcare_hub.users`).

| Email Address | Role | Name | Associated Profile | `is_active` | `email_verified` | Live API Auth Result |
|---|---|---|---|---|---|---|
| `patient.juan@example.com` | `PATIENT` | Juan Dela Cruz | `patients` ID: 1 | 1 | 1 | **HTTP 200 OK** (Resolved ID: 6) |
| `dr.santos@toothcare.local` | `DENTIST` | Dr. Maria Santos | `dentists` ID: 1 | 1 | 1 | **HTTP 200 OK** (Resolved ID: 3) |
| `admin@toothcare.local` | `ADMIN` | System Administrator | None (`users` ID: 1) | 1 | 1 | **HTTP 200 OK** (Resolved ID: 1) |
| `receptionist@toothcare.local`| `ADMIN` | Staff Receptionist | None (`users` ID: 2) | 1 | 1 | **HTTP 200 OK** (Resolved ID: 2) |

---

## 2. Password Security & Hashing
- **Password**: `Password123!`
- **Digest Stored in MySQL**:
  `$argon2id$v=19$m=65536,t=4,p=1$dk5Db1RlYWJqVEtmZEJYTA$f0yOFk2YpzgkhmdL+sQ0AWQsW2J9gSS3O2frrh7VJgI`
- Plaintext password verification test:
  `password_verify('Password123!', $hash)` returns `true`.
  `password_verify('WrongPassword!', $hash)` returns `false`.

---

## 3. Frontend Integration Audit

### 3.1 Removal of UI Demo Shortcuts
- **Inspected File**: `frontend/src/features/auth/components/LoginForm.jsx`
- **Result**: Confirmed that the "Quick Demo Access" grid (buttons for Patient, Dentist, Admin, Staff) and demo credential badges have been completely removed.
- **Current Behavior**: The form is a clean email/password input component with no shortcuts.

### 3.2 Removal of Client-Side Mock Fallback
- **Inspected File**: `frontend/src/features/auth/context/AuthContext.jsx`
- **Result**: Confirmed that `DEMO_ACCOUNTS` object and the offline credential check (`if (password === 'Password123!') ...`) have been completely removed.
- **Current Behavior**: All login submissions dispatch an HTTP POST request to `/api/v1/auth/login`. If the server fails or returns 401/403/503, the error message returned from the backend is displayed to the user.

---

## 4. Seeder Idempotency & Safety
- **Inspected File**: `database/seeds/development_seed.sql`
- **Idempotency**: All `INSERT` statements include `ON DUPLICATE KEY UPDATE` clauses. Running the seed script repeatedly does not generate duplicate keys or corrupt existing passwords.
- **Production Guard**: Top of script contains explicit safety warnings:
  `-- WARNING: Never execute this script against Staging or Production databases.`
  `-- All data is completely synthetic and uses reserved example domains (*.example.com / *.toothcare.local).`
