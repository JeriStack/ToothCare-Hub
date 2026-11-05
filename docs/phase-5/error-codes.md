# Standard Machine-Readable Error Codes

All error responses from the ToothCare Hub API adhere to the unified error envelope:

```json
{
  "data": null,
  "meta": {
    "request_id": "3c26210f-6fb6-4556-9e90-c2d96abcf76a"
  },
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary of the error.",
    "details": {
      "field_name": ["Specific validation message."]
    }
  }
}
```

---

## Error Code Directory

| Error Code | HTTP Status | Meaning | Typical Trigger |
|---|---|---|---|
| `VALIDATION_ERROR` | `422` | Semantic payload validation failed. | Missing required field, invalid date, short password. |
| `BAD_REQUEST` | `400` | Malformed HTTP request syntax. | Syntax errors, unparseable input parameters. |
| `MALFORMED_JSON` | `400` | Request body is not valid JSON. | Syntax error in submitted JSON payload. |
| `UNAUTHENTICATED` | `401` | Session is missing, expired, or invalid. | Unauthenticated request to protected endpoint. |
| `FORBIDDEN` | `403` | User lacks role permission for resource. | Patient attempting to view another patient's records. |
| `CSRF_TOKEN_INVALID` | `403` | CSRF token missing or mismatch. | Unsafe HTTP method without valid `X-CSRF-Token`. |
| `NOT_FOUND` | `404` | Route or entity ID not found. | Request to nonexistent URL or ID. |
| `METHOD_NOT_ALLOWED` | `405` | HTTP method not supported on path. | Sending `DELETE` to `/api/v1/health`. |
| `CONFLICT` | `409` | Resource state collision. | Double-booking time slot, duplicate registration email. |
| `PAYLOAD_TOO_LARGE` | `413` | Request payload exceeds maximum size limit. | Submitting body larger than 1MB limit. |
| `UNSUPPORTED_MEDIA_TYPE` | `415` | Request `Content-Type` is not JSON. | Submitting `text/xml` or `text/plain` on a JSON endpoint. |
| `INTERNAL_SERVER_ERROR` | `500` | Unexpected server exception. | Unhandled runtime exception or PHP error. |
| `SERVICE_UNAVAILABLE` | `503` | Critical dependency unreachable. | MySQL database connection failure. |
| `NOT_IMPLEMENTED` | `501` | Route planned for future phase. | Request to Phase 6+ route stubs. |

---

## Client Handling Best Practices

1. **Check `error.code` first**: UI applications should base error branching (e.g., showing field errors vs redirecting to login) on `error.code` rather than parsing error message strings.
2. **Field-level validation**: When `error.code === 'VALIDATION_ERROR'`, `error.details` provides key-value pairs matching form input names directly (compatible with React Hook Form `setError`).
3. **Session expiry**: When `error.code === 'UNAUTHENTICATED'`, clear local auth state and redirect to `/login`.
4. **CSRF failure**: When `error.code === 'CSRF_TOKEN_INVALID'`, fetch a fresh token from `/api/v1/auth/csrf-token` and retry once.

