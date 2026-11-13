# Phase 5: API Contract and Backend Application Foundation

## 1. Overview

**Phase 5** establishes the native PHP REST API architecture, HTTP abstraction layer, error handling, security foundations, and OpenAPI 3.x contract for **ToothCare Hub** — Dental Appointment and Clinic Management System.

This phase guarantees a stable, secure, documented, and testable backend foundation under `/api/v1` before specific business logic (authentication, appointment scheduling, treatment records, reporting) is implemented in later phases.

---

## 2. Implemented Architecture

```text
backend/
├── composer.json               # Package definitions, PSR-4 autoloading, testing & validation scripts
├── composer.lock               # Committed dependency lockfile
├── phpunit.xml                 # PHPUnit 11 configuration (Unit and Integration suites)
├── .env.example                # Safe environment configuration template with placeholders
├── config/
│   ├── app.php                 # Core application configuration
│   ├── database.php            # PDO MySQL connection settings
│   ├── mail.php                # SMTP configuration
│   └── realtime.php            # Socket.IO bridge parameters
├── openapi/
│   └── openapi.yaml            # Validated OpenAPI 3.0.3 specification
├── public/
│   └── index.php               # Front controller entry point (Application::boot()->run())
├── scripts/
│   └── validate-openapi.php    # Automated OpenAPI contract validator
├── src/
│   ├── Controllers/
│   │   ├── HealthController.php# GET /api/v1/health (liveness and DB readiness check)
│   │   └── MetricsController.php# Prometheus-compatible internal metrics
│   ├── Core/
│   │   ├── Application.php     # Application bootstrapper and HTTP kernel
│   │   ├── Config.php          # Centralized typed environment loader
│   │   ├── Database.php        # PDO wrapper with safe exception handling
│   │   ├── ExceptionHandler.php# Centralized exception to JSON envelope mapper
│   │   ├── HttpException.php   # Typed HTTP exceptions carrying status and error codes
│   │   ├── Logger.php          # Structured log writer with CRLF and secret redaction
│   │   ├── Request.php         # HTTP request parser, JSON validator, body limiter
│   │   ├── Response.php        # Unified JSON response envelope emitter
│   │   └── Router.php          # Method routing, dynamic path params, 404/405 dispatch
│   ├── Middleware/
│   │   ├── MiddlewareInterface.php# Standard PSR-inspired middleware contract
│   │   ├── RequestIdMiddleware.php# X-Request-ID propagation and UUID generator
│   │   ├── CorsMiddleware.php  # Strict origin allowlist and OPTIONS preflight
│   │   └── CsrfMiddleware.php  # Token validation for unsafe methods (POST, PUT, PATCH, DELETE)
│   └── Routes/
│       └── api.php             # /api/v1 route definitions (Health + Planned route stubs)
└── tests/
    ├── Fixtures/
    │   └── TestDataFactory.php # Mock payload factory
    ├── Integration/
    │   └── HealthApiTest.php   # End-to-end API pipeline and envelope tests
    └── Unit/
        ├── ConfigTest.php      # Configuration parser and type casting tests
        ├── CorsMiddlewareTest.php # Origin allowlist and preflight tests
        ├── CsrfMiddlewareTest.php # CSRF verification and method bypass tests
        ├── DatabaseTest.php    # Safe 503 handling and secret isolation tests
        ├── RequestIdMiddlewareTest.php # UUID generation and sanitization tests
        ├── RequestTest.php     # JSON parsing, size limits, and media type tests
        ├── ResponseTest.php    # Success/error envelope formatting tests
        └── RouterTest.php      # Route matching, parameters, 404/405 dispatch tests
```

---

## 3. Quickstart & Verification Commands

### Run Automated Tests
```powershell
# Run complete test suite (39 tests)
Push-Location backend; composer test; Pop-Location

# Run Unit tests only
Push-Location backend; composer test:unit; Pop-Location

# Run Integration tests only
Push-Location backend; composer test:integration; Pop-Location
```

### Validate OpenAPI Contract
```powershell
Push-Location backend; composer run openapi:validate; Pop-Location
```

### Local API Health Check & Logs
```powershell
# View PHP-FPM API logs
docker-compose logs php-fpm

# Liveness check via Nginx edge gateway
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/health" -Method Get

# Readiness check (verifies MySQL database connectivity)
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/health?check=ready" -Method Get
```

---

## 4. Documentation Index

- [api-contract.md](file:///c:/xampp\htdocs\GitHub_Clone_File_Projects\ToothCare-Hub\docs\phase-5\api-contract.md) — Unified envelope specification, status codes, and endpoint inventory.
- [authentication-and-csrf.md](file:///c:/xampp\htdocs\GitHub_Clone_File_Projects\ToothCare-Hub\docs\phase-5\authentication-and-csrf.md) — HttpOnly cookie sessions, CSRF token architecture, and Axios integration.
- [cors-policy.md](file:///c:/xampp\htdocs\GitHub_Clone_File_Projects\ToothCare-Hub\docs\phase-5\cors-policy.md) — Cross-Origin Resource Sharing configuration and credential policies.
- [environment-variables.md](file:///c:/xampp\htdocs\GitHub_Clone_File_Projects\ToothCare-Hub\docs\phase-5\environment-variables.md) — Complete environment variable reference table.
- [error-codes.md](file:///c:/xampp\htdocs\GitHub_Clone_File_Projects\ToothCare-Hub\docs\phase-5\error-codes.md) — Machine-readable error code catalogue and client handling guide.
- [testing-guide.md](file:///c:/xampp\htdocs\GitHub_Clone_File_Projects\ToothCare-Hub\docs\phase-5\testing-guide.md) — Test suite layout, execution, and CI guidelines.
- [phase-5-exit-checklist.md](file:///c:/xampp\htdocs\GitHub_Clone_File_Projects\ToothCare-Hub\docs\phase-5\phase-5-exit-checklist.md) — Phase 5 exit criteria and verification results.

