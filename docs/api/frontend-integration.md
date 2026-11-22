# Frontend Integration Guide (React + Axios)

The React SPA (`frontend/`) communicates exclusively with `/api/v1` through the shared Axios client (`frontend/src/api/client.js` and domain service modules in `frontend/src/api/`).

---

## 1. Session & CSRF Configuration

- `withCredentials: true` is enabled globally so the browser automatically sends the `HttpOnly` `toothcare_session` cookie on same-origin / proxied requests.
- Before state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`), the client ensures a valid CSRF token from `GET /api/v1/auth/csrf-token` and attaches it in the `X-CSRF-Token` request header.
- On `POST /api/v1/auth/login`, the backend regenerates the PHP session ID and issues a fresh CSRF token — the frontend updates its in-memory CSRF token immediately.

---

## 2. Envelope Unwrapping & Error Handling

- Every JSON response uses `{ data, meta, error }`.
- On HTTP `2xx`, callers read `response.data.data` and pagination/request metadata from `response.data.meta`.
- On HTTP `4xx`/`5xx`, callers surface `error.response.data.error.message` and field-level `error.response.data.error.details` (for `422` form validation errors).
- On `401 Unauthorized` for protected routes, the auth context clears client user state and redirects to `/login`.

---

## 3. Real-Time Socket.IO Integration

1. After authentication succeeds, the frontend calls `POST /api/v1/realtime/ticket` to obtain a short-lived ticket.
2. `socket.io-client` connects to `/socket.io/` with `{ auth: { ticket } }`.
3. Incoming real-time events update notification badges, appointment lists, and role dashboards while keeping the REST API as the authoritative source of truth.

---

## 4. Phase 17 Frontend-to-Backend Route Audit Summary

- All active frontend API modules (`auth`, `appointments`, `availability`, `services`, `dentists`, `patients`, `receptionist`, `treatmentRecords`, `notifications`, `admin`, `reports`, `operations`, `realtime`) map directly to implemented and OpenAPI-documented `/api/v1` endpoints.
- Planned `501` placeholder routes (`/patients`, `/reports/overview`, `/reports/appointments`) are **not** called by the frontend and are excluded from `docs/openapi.yaml`.
