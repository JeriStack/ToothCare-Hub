# ToothCare Hub — Database & Application Security Audit

**Scope:** Authentication, RBAC, Data Privacy, IDOR Prevention, Token Security, Audit Trails  
**Audit Status:** PASSED (Zero Critical Vulnerabilities, High Compliance)

---

## 1. Authentication Security

### 1.1 Password Hashing & Salt Management
- Implementation: Native PHP `password_hash()` and `password_verify()`.
- Algorithm: **Argon2id** (`PASSWORD_ARGON2ID`, memory: 65536 KiB, time: 4, threads: 1) and standard fallback.
- Database Column: `users.password_hash VARCHAR(255)`.
- Verification Evidence: Plaintext passwords are never stored or logged. Database user records contain valid Argon2id digests (e.g. `$argon2id$v=19$m=65536,t=4,p=1$...`).
- Wrong-password verification test: Returned HTTP 401 Unauthorized with sanitized error response (`INVALID_CREDENTIALS`).

### 1.2 Account Status Verification
- In `AuthenticationMiddleware`:
  `if ((int) $user['is_active'] !== 1) { throw HttpException::unauthorized('Account is inactive or disabled.', 'ACCOUNT_DISABLED'); }`
- Inactive users are rejected immediately even if their credentials are valid.

---

## 2. Authorization & RBAC

### 2.1 Server-Side Identity Resolution
- The application uses PHP server-side sessions (`$_SESSION['user_id']`).
- Upon each authenticated request, `AuthenticationMiddleware` resolves the user identity from MySQL by ID.
- Client headers, cookies, or payloads cannot spoof the user's role or permissions.

### 2.2 Route Authorization
- Guarded by `AuthorizationMiddleware::hasRoles(['ADMIN'])` or `['DENTIST']`.
- Fine-grained permission tables (`roles`, `permissions`, `user_roles`, `role_permissions`) are populated and ready for method-level permission checks.

---

## 3. IDOR Prevention & Ownership Enforcement

### 3.1 Patient Appointment Access
- In `AppointmentService` / `AppointmentController`:
  When a user with role `PATIENT` accesses an appointment, the backend resolves their `patient_id` from their `user_id` in MySQL and verifies:
  `if ((int) $appointment['patient_id'] !== (int) $patient['id']) { throw HttpException::forbidden(); }`
- Prevents patients from inspecting or modifying other patients' appointments.

### 3.2 Dentist Caseload Isolation
- When a user with role `DENTIST` accesses appointments, the backend resolves `dentist_id` from their `user_id` and verifies:
  `if ((int) $appointment['dentist_id'] !== (int) $dentist['id']) { throw HttpException::forbidden(); }`
- Clinicians cannot inspect or document visits assigned to other dentists unless granted explicit administrative oversight.

### 3.3 Clinical Record Privacy
- `TreatmentRecordService` restricts viewing and editing of dental charts strictly to:
  1. The assigned attending clinician.
  2. The specific patient whose chart it is (read-only viewer).
  3. Authorized clinic administrators.
- **Payload Redaction**: Clinical diagnosis, procedure notes, and prescription advice are strictly excluded from public notification messages and transactional emails.

---

## 4. Token Security

### 4.1 Token Hashing
- Auth tokens (`auth_tokens`, `email_verification_tokens`, `password_reset_tokens`) store a cryptographic hash:
  `$tokenHash = hash('sha256', $rawToken);`
- Raw unhashed tokens are never written to disk or database tables.
- Even in the event of a database compromise, offline token cracking is prevented.

### 4.2 Lifecycle & Single-Use Enforcement
- Token expiration enforced via `expires_at > NOW()`.
- Token consumption enforced via `used_at IS NULL` or `consumed_at IS NULL`.
- Older outstanding tokens are invalidated upon issuance of a new token.
- `AuditLogRepository` explicitly redacts `token_hash` from logged audit payloads.

---

## 5. Audit Logging & Security Events
- All mutations (logins, appointments, cancellations, treatment records, updates) record an immutable entry in `audit_logs` with actor user ID, client IP, user agent, target type, target ID, and sanitized payload.
- High-risk security events (failed logins, lockouts, token events) are captured in `security_events`.
