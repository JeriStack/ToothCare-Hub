# Phase 16 — API Contract Testing

## Automated OpenAPI Validation

```powershell
php backend/scripts/validate-openapi.php
.\backend\vendor\bin\phpunit.bat -c backend/phpunit.xml backend/tests/Integration/Phase16ApiContractTest.php
```

- Validates `backend/openapi/openapi.yaml` against OpenAPI 3.x requirements (`57 paths`, `17 schemas`).
- Confirms all `$ref` pointers resolve cleanly and verifies no `/api/v1/internal/*` service-to-service routes leak into the public OpenAPI specification.
- Verifies live HTTP response contracts for `{ data, meta, error }`, pagination metadata (`total`, `page`, `per_page`, `last_page`), and status codes (`200`, `201`, `400`, `401`, `403`, `404`, `409`, `422`).

## Postman Collection

Import [`docs/api/toothcare-hub.postman_collection.json`](../api/toothcare-hub.postman_collection.json) into Postman or run via Newman against a local development stack (`http://localhost:8080/api/v1`). All collection variables use synthetic placeholder values only.
