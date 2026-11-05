# Security Audit Logging Architecture

## 1. Principles and Scope

To ensure regulatory compliance, tamper evidence, and forensics traceability without compromising patient privacy or exposing secrets, ToothCare Hub records immutable security audit logs in the `audit_logs` table (Migration `014_create_audit_logs.sql`).

### Strict Data Sanitization Rules
The audit logger recursively inspects and redacts sensitive parameters. Under NO circumstances are the following ever recorded in audit records or system logs:
- Plaintext passwords or passphrases.
- Password hashes (`password_hash`).
- Raw authentication tokens, verification tokens, or reset tokens.
- Token hashes (`token_hash`).
- Session identifiers (`PHPSESSID` or `toothcare_session`).
- CSRF secret tokens (`X-CSRF-Token`).
- Sensitive patient medical health notes in operational logs.

---

## 2. Action Taxonomy

| Action Code | Description | Target Entity |
|---|---|---|
| `AUTH_REGISTER` | New patient account created | `users` |
| `AUTH_LOGIN_SUCCESS` | Successful authentication & session establishment | `users` |
| `AUTH_LOGIN_FAILED` | Failed credential attempt | `users` |
| `AUTH_LOGIN_BLOCKED` | Login attempt for disabled or inactive account | `users` |
| `AUTH_LOGIN_RATE_LIMITED` | Login attempts exceeded rate limit window | `users` |
| `AUTH_LOGOUT` | Session terminated and cookie expired | `users` |
| `AUTH_EMAIL_VERIFIED` | Email address verified via single-use token | `users` |
| `AUTH_VERIFICATION_RESENT`| New verification token dispatched | `users` |
| `AUTH_PASSWORD_RESET_REQUESTED` | Password reset requested | `users` |
| `AUTH_PASSWORD_RESET_COMPLETED` | Password reset completed with token | `users` |
| `PATIENT_PROFILE_UPDATED` | Patient demographic profile updated | `patients` |

---

## 3. Schema Structure

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_user_id BIGINT UNSIGNED NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id BIGINT UNSIGNED NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    sanitized_payload JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_audit_logs_action (action, created_at),
    INDEX idx_audit_logs_target (target_type, target_id),
    INDEX idx_audit_logs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

