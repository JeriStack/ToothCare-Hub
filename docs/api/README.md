# ToothCare Hub — REST API Documentation (`/api/v1`)

**Source of Truth:** The implemented native PHP backend (`backend/src/Routes/api.php` and PHP 8 OpenAPI attributes in `backend/src/OpenApi/`).

## Quick Links

| Resource | Purpose |
|---|---|
| [`docs/openapi.yaml`](../openapi.yaml) | Canonical OpenAPI 3.0.3 YAML specification (105 paths, 138 operations, 15 reusable schemas) |
| [`backend/openapi/openapi.yaml`](../../backend/openapi/openapi.yaml) | Synchronized backend mirror for container/tooling access |
| [`authentication.md`](authentication.md) | Session cookies (`toothcare_session`), `X-CSRF-Token`, email verification, and realtime tickets |
| [`authorization.md`](authorization.md) | RBAC & DRBAC roles (`ADMIN`, `RECEPTIONIST`, `DENTIST`, `PATIENT`) and ownership rules |
| [`error-handling.md`](error-handling.md) | Standard `{ data, meta, error }` JSON envelope and HTTP status code contracts |
| [`pagination-and-filtering.md`](pagination-and-filtering.md) | Pagination metadata, search filters, sorting, and date-range rules |
| [`appointment-workflows.md`](appointment-workflows.md) | Appointment lifecycle state machine, slot availability, triage, check-in, and clinical completion |
| [`examples.md`](examples.md) | End-to-end `curl` workflow examples using synthetic test data |
| [`frontend-integration.md`](frontend-integration.md) | React + Axios integration contract, CSRF handling, and route alignment |
| [`postman-guide.md`](postman-guide.md) | Running [`toothcare-hub.postman_collection.json`](toothcare-hub.postman_collection.json) |

---

## Interactive Swagger UI (Local & Development Only)

When running locally or via Docker Compose (`APP_ENV=development` or `APP_ENV=testing`):

- **Swagger UI:** `http://localhost:8080/api/v1/docs` (or shortcut `http://localhost:8080/api-docs`)
- **Raw OpenAPI YAML:** `http://localhost:8080/api/v1/docs/openapi.yaml`

> **Production Security Guard:** In production (`APP_ENV=production`), both `/api/v1/docs` and `/api/v1/docs/openapi.yaml` return **HTTP `404 Not Found`** by default. Access can only be explicitly opted in by setting `SWAGGER_UI_ENABLED=true` AND authenticating as an `ADMIN` user.

---

## Regenerating & Validating the OpenAPI Specification

The specification is deterministically generated from PHP 8 attributes using `zircote/swagger-php`:

```bash
# Regenerate docs/openapi.yaml and backend/openapi/openapi.yaml
composer --working-dir=backend openapi:generate

# Verify committed YAML has zero drift from PHP source (enforced in CI)
composer --working-dir=backend openapi:check

# Validate YAML syntax, OpenAPI 3.x structure, $ref resolution, unique operationIds,
# path parameters, 100% route coverage against backend/src/Routes/api.php, and secret hygiene
composer --working-dir=backend openapi:validate
```

---

## Scope & Intentional Exclusions

- **Documented Public `/api/v1` Surface:** **105 unique paths / 138 operations** (100% of released public routes).
- **Intentionally Excluded Internal Routes (2):** `POST /api/v1/internal/realtime/tickets/verify` and `POST /api/v1/internal/realtime/sessions/verify` (blocked at the public Nginx edge with `403`, reachable only over the internal Docker network port `8081` with HMAC verification).
- **Intentionally Excluded Planned `501` Placeholders (4):** `GET /api/v1/patients`, `POST /api/v1/patients`, `GET /api/v1/reports/overview`, and `GET /api/v1/reports/appointments` (not yet implemented; return `501 Not Implemented`).
- **Intentionally Excluded Self-Hosting Docs Routes (2):** `GET /api/v1/docs` and `GET /api/v1/docs/openapi.yaml`.
