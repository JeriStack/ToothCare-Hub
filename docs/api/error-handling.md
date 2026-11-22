# Response Envelopes & Error Handling

All JSON endpoints under `/api/v1` return a consistent envelope produced by `App\Core\Response`.

---

## 1. Standard Success Envelope

```json
{
  "data": {
    "id": 42,
    "status": "PENDING"
  },
  "meta": {
    "request_id": "req_01J...",
    "timestamp": "2026-11-22T05:00:00+00:00"
  },
  "error": null
}
```

For paginated endpoints, `meta` also includes `total`, `page`, `per_page`, and `last_page`.

---

## 2. Standard Error Envelope

```json
{
  "data": null,
  "meta": {
    "request_id": "req_01J...",
    "timestamp": "2026-11-22T05:00:00+00:00"
  },
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The submitted data is invalid.",
    "details": {
      "start_date": ["start_date must be on or before end_date."]
    }
  }
}
```

---

## 3. HTTP Status Codes

| Status | Meaning | Typical Cause |
|---|---|---|
| `200 OK` | Request succeeded | Reads, updates, status transitions, logout |
| `201 Created` | Resource created | Registration, booking an appointment, creating a service/user/treatment record |
| `400 Bad Request` | Malformed request | Invalid numeric path ID (`0` or non-integer), malformed JSON payload |
| `401 Unauthorized` | Authentication required | Missing/expired `toothcare_session` cookie or invalid login credentials |
| `403 Forbidden` | Authenticated but not permitted | Missing role/DRBAC permission, cross-user IDOR attempt, invalid/missing `X-CSRF-Token` |
| `404 Not Found` | Resource not found | Unknown ID, or `/api/v1/docs` accessed in production |
| `409 Conflict` | Business/state conflict | Double-booked slot, duplicate email, invalid appointment status transition |
| `422 Unprocessable Entity` | Validation error | Missing required fields, invalid date/time format, policy violation (e.g. cutoff window) |
| `429 Too Many Requests` | Rate limit exceeded | Too many login, registration, or password reset attempts |
| `500 Internal Server Error` | Unexpected server failure | Unhandled exception (stack traces are never leaked in production; redacted entry logged) |
| `501 Not Implemented` | Reserved future route | Structured placeholder routes not yet implemented |
