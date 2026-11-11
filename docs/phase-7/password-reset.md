# Password Recovery and Anti-Enumeration Architecture

## 1. Password Reset Request (`POST /api/v1/auth/forgot-password`)

### Anti-Enumeration Design
Public endpoints must not leak whether an account or email address exists in the clinic database.

When a client submits an email:
1. Normalize email: `strtolower(trim($email))`.
2. Evaluate rate limiting: `forgot_password:ip:email` (3 attempts per hour).
3. If user exists and is active:
   - Generate 256-bit random token: `bin2hex(random_bytes(32))`.
   - Store SHA-256 hash in `auth_tokens` (`token_type = 'PASSWORD_RESET'`, TTL = 1800s / 30 mins).
   - Enqueue email in `email_outbox`.
   - Record audit event: `AUTH_PASSWORD_RESET_REQUESTED`.
4. Regardless of whether user was found or not, return identical response:
   ```json
   {
     "data": {
       "sent": true,
       "message": "If that email address is registered, instructions to reset your password have been sent."
     },
     "meta": { "request_id": "..." },
     "error": null
   }
   ```

---

## 2. Password Reset Completion (`POST /api/v1/auth/reset-password`)

1. Validates token format and new password complexity (minimum 12 chars with upper, lower, number, symbol).
2. Hashes incoming token: `$tokenHash = hash('sha256', $rawToken)`.
3. Locates unexpired, unused token record with `token_type = 'PASSWORD_RESET'`.
4. Transactionally:
   - Hashes new password with `password_hash($newPassword, PASSWORD_DEFAULT)`.
   - Updates `users.password_hash`.
   - Marks token as consumed: `auth_tokens.used_at = NOW()`.
   - Invalidates all other pending reset tokens for this user.
   - Records audit event: `AUTH_PASSWORD_RESET_COMPLETED`.
5. Destroys active sessions for this user to force re-authentication with new credentials.

