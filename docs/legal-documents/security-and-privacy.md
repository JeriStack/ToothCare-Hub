# Security, Privacy, Authorization & Audit Controls

## Access Controls & DRBAC

All administrative legal endpoints enforce `AuthorizationMiddleware::hasPermission('<slug>')` with **zero role fallback**:

| Permission Slug | Default `admin` Grant? | Allowed Operations |
|---|---|---|
| `legal_documents.view` | Yes | `GET /api/v1/admin/legal/documents` |
| `legal_documents.create` | Yes | `POST /api/v1/admin/legal/documents` |
| `legal_documents.edit` | Yes | `PATCH /api/v1/admin/legal/documents/{id}` (DRAFT only) |
| `legal_documents.publish` | **No (Explicit Grant Only)** | `POST /api/v1/admin/legal/documents/{id}/publish` & `/withdraw` |
| `legal_acceptances.view` | Yes | `GET /api/v1/admin/legal/acceptances` |

## Security Protections

- **IDOR Prevention**: `POST /api/v1/legal/acceptances` always binds records to the authenticated session user and explicitly rejects requests containing a mismatched `user_id` with HTTP `403 FORBIDDEN`.
- **No Client Timestamp Trust**: Any client-supplied `accepted_at` value is ignored; timestamps are generated strictly on the database server (`NOW()`).
- **No Sensitive Storage in Draft Recovery**: `RegisterForm` persists only non-sensitive form fields in `sessionStorage` (`toothcare_register_draft`) so navigating to `/terms-of-service` or `/privacy-policy` does not erase user input; passwords are never stored in browser storage.
- **CSRF & Rate Limiting**: Protected by existing `CsrfMiddleware` and `RateLimitMiddleware` (`30 req/min` on `POST /api/v1/legal/acceptances`; existing rate limits on `POST /api/v1/auth/register`).

## Audit Trail Events (`audit_logs`)

Recorded through the existing `AuditLogRepository` (append-only, automatic redaction of passwords, tokens, CSRF secrets, OTPs, and WebSocket tickets):

- `LEGAL_TERMS_ACCEPTED`
- `LEGAL_PRIVACY_ACKNOWLEDGED`
- `LEGAL_DOCUMENT_DRAFT_CREATED`
- `LEGAL_DOCUMENT_DRAFT_UPDATED`
- `LEGAL_DOCUMENT_PUBLISHED`
- `LEGAL_DOCUMENT_WITHDRAWN`
