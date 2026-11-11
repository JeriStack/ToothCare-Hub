# Rate Limiting and Abuse Prevention

## 1. Overview and Threat Vectors

To protect ToothCare Hub against credential stuffing, password brute-forcing, denial-of-service, and automated registration spam, server-side sliding-window rate limiting is enforced on all security-sensitive routes.

---

## 2. Configured Thresholds

| Scope / Action | Threshold | Window | Rationale |
|---|---|---|---|
| `login` (per IP) | 10 attempts | 15 minutes (900s) | Protects against network-wide bot attacks |
| `login` (per Email) | 5 attempts | 15 minutes (900s) | Protects specific user accounts from targeted attacks |
| `register` (per IP) | 5 accounts | 1 hour (3600s) | Mitigates automated mass account creation |
| `forgot_password` (per IP/Email) | 3 requests | 1 hour (3600s) | Prevents email inbox flooding and enumeration |
| `resend_verification` (per IP/Email) | 3 requests | 1 hour (3600s) | Prevents email bombing abuse |

---

## 3. Database Storage & Multi-Process Concurrency

Rate limit buckets are tracked persistently in the `rate_limits` table (Migration `015_create_rate_limits.sql`):

```sql
CREATE TABLE IF NOT EXISTS rate_limits (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    rate_key VARCHAR(191) NOT NULL,
    hits INT UNSIGNED NOT NULL DEFAULT 1,
    reset_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_rate_limits_key UNIQUE (rate_key),
    INDEX idx_rate_limits_reset (reset_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 4. HTTP 429 Response Envelope and Headers

When limits are exceeded:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json; charset=UTF-8
Retry-After: 60
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1730822400

{
  "data": null,
  "meta": {
    "request_id": "3c26210f-6fb6-4556-9e90-c2d96abcf76a"
  },
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again in 15 minutes.",
    "details": {
      "retry_after": 60
    }
  }
}
```

