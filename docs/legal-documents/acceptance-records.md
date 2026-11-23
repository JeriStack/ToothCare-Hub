# User Legal Acceptance Records

## Data Model (`user_legal_acceptances`)

| Column | Type | Purpose |
|---|---|---|
| `id` | `BIGINT UNSIGNED` PK | Unique acceptance record identifier |
| `user_id` | `BIGINT UNSIGNED` FK (`users.id`) | User who performed the action |
| `document_id` | `BIGINT UNSIGNED` FK (`legal_documents.id`, `RESTRICT`) | Exact immutable document row accepted/acknowledged |
| `document_type` | `ENUM('TERMS_OF_SERVICE', 'PRIVACY_POLICY')` | Policy category |
| `document_version` | `VARCHAR(32)` | Version snapshot (e.g. `1.0`, `2.0`) |
| `acceptance_action` | `ENUM('ACCEPTED', 'ACKNOWLEDGED')` | `ACCEPTED` for Terms of Service; `ACKNOWLEDGED` for Privacy Policy |
| `accepted_at` | `DATETIME` (server `NOW()`) | Authoritative server-generated timestamp |
| `ip_address` | `VARCHAR(45) NULL` | Audit metadata (disclosed in Privacy Policy) |
| `user_agent` | `VARCHAR(255) NULL` | Audit metadata (disclosed in Privacy Policy) |

## Integrity & Transaction Atomicity

- **Registration (`POST /api/v1/auth/register`)**:
  1. `AuthValidator::validateRegister()` enforces explicit boolean acceptance (`accept_legal = true`) and valid version strings (`terms_version`, `privacy_version`), discarding any client-supplied timestamp.
  2. `LegalService::resolveRegistrationDocuments()` verifies submitted versions match the currently `PUBLISHED` active rows in `legal_documents`.
  3. Inside the single PDO transaction in `AuthService::register()`, the system creates `users`, `patients`, both `user_legal_acceptances` rows (`TERMS_OF_SERVICE`/`ACCEPTED` and `PRIVACY_POLICY`/`ACKNOWLEDGED`), `auth_tokens`, the transactional `email_outbox` job, and `audit_logs`.
  4. Any failure rolls back the entire transaction so no account exists without legal acceptance records and no orphaned acceptance records exist without an account.
- **Idempotency**: Unique key `(user_id, document_id, acceptance_action)` ensures duplicate re-acceptance requests return the original historical record without altering `accepted_at`.
