# Email Verification Architecture

## 1. Objectives

- Ensure patient-provided email addresses are verified before full access is granted.
- Defeat token interception and database compromise by storing only SHA-256 hashes of tokens.
- Prevent token reuse with atomic single-use consumption.
- Prevent account enumeration during verification resend attempts.

---

## 2. Token Lifecycle and Cryptography

```text
1. Generation (Server)
   $rawToken = bin2hex(random_bytes(32)); // 64 hex characters (256-bit entropy)
   $tokenHash = hash('sha256', $rawToken); // 64-char SHA-256 digest

2. Storage (database: auth_tokens)
   INSERT INTO auth_tokens (user_id, token_hash, token_type, expires_at)
   VALUES (?, $tokenHash, 'EMAIL_VERIFY', NOW() + 86400);

3. Delivery (Transactional Email)
   https://toothcarehub.example.com/verify-email?token={$rawToken}

4. Consumption (POST /api/v1/auth/verify-email)
   Client sends: { "token": $rawToken }
   Server computes: $tokenHash = hash('sha256', $rawToken);
   SELECT * FROM auth_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW();
   
   Transactionally:
   - UPDATE auth_tokens SET used_at = NOW() WHERE id = ?;
   - UPDATE users SET email_verified = 1, email_verified_at = NOW() WHERE id = ?;
```

---

## 3. Database Schema Mapping

Table: `auth_tokens` (Migration `013_create_auth_tokens.sql`):

- `id`: Primary key
- `user_id`: FK -> `users(id)`
- `token_hash`: `VARCHAR(255)` UNIQUE
- `token_type`: `ENUM('EMAIL_VERIFY', 'PASSWORD_RESET')`
- `expires_at`: `DATETIME` (default 24 hours: `EMAIL_VERIFICATION_TOKEN_TTL=86400`)
- `used_at`: `DATETIME NULL` (set on first consumption; non-null prevents reuse)
- `created_at`: `DATETIME`

