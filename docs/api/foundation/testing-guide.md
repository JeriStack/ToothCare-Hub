# Backend Testing Guide

## 1. Overview

ToothCare Hub uses **PHPUnit 11** for native backend automated testing. Tests are categorized into:
- **Unit Tests (`tests/Unit/`)**: Isolated component tests verifying configuration, request parsing, response generation, router dispatch, and security middleware logic without external services.
- **Integration Tests (`tests/Integration/`)**: End-to-end kernel tests verifying full HTTP lifecycle dispatch through `Application::boot()`, header propagation, and middleware chains.

---

## 2. Test Execution Commands

From the project root:

```powershell
# Run the complete test suite
Push-Location backend; composer test; Pop-Location

# Run only the Unit testsuite
Push-Location backend; composer test:unit; Pop-Location

# Run only the Integration testsuite
Push-Location backend; composer test:integration; Pop-Location

# Run a specific test class
Push-Location backend; ./vendor/bin/phpunit tests/Unit/RequestTest.php; Pop-Location

# Validate OpenAPI 3.x contract
Push-Location backend; composer run openapi:validate; Pop-Location
```

---

## 3. Implemented Test Suites

| Test Class | Suite | Key Scenarios Covered |
|---|---|---|
| `ConfigTest` | Unit | Default values, type casting (int, bool, array), production debug overrides. |
| `RequestTest` | Unit | Valid JSON parsing, malformed JSON (400), unsupported media types (415), payload size limits (413), path normalization, query and route parameters. |
| `ResponseTest` | Unit | Success and error envelopes, HTTP status codes, X-Request-ID headers, security headers (nosniff, SAMEORIGIN), 204 No Content empty bodies. |
| `RouterTest` | Unit | Known route matching, dynamic route parameters (`{id}`), group prefixes, 404 Route Not Found, 405 Method Not Allowed with `Allow` header. |
| `DatabaseTest` | Unit | Unreachable connection produces safe `503 SERVICE_UNAVAILABLE` without leaking credentials or internal paths; safe non-throwing ping. |
| `RequestIdMiddlewareTest` | Unit | Generation of UUIDv4 correlation IDs, acceptance of valid client IDs, rejection and sanitization of malicious characters. |
| `CorsMiddlewareTest` | Unit | Exact origin allowlists, rejection of unapproved origins, preflight `OPTIONS` handling (204 No Content), credentialed headers, `Vary: Origin`. |
| `CsrfMiddlewareTest` | Unit | Safe method bypass (GET/HEAD/OPTIONS), unsafe method verification (POST/PUT/PATCH/DELETE), token generation and mismatch rejection (403). |
| `HealthApiTest` | Integration | End-to-end `GET /api/v1/health` dispatch through kernel, request ID propagation, 404 route handling, and 501 planned route stubs. |

---

## 4. Test Isolation and Safety Guidelines

1. **No Destructive Database Access**: Unit tests use mocks and test doubles. Database tests point to unreachable ports or transaction-isolated instances.
2. **Deterministic Time and IDs**: Where random UUIDs are generated, assertions use regular expressions (`/^[0-9a-f]{8}-.../`).
3. **No Network Dependencies**: All unit and integration tests run entirely offline with zero external network dependencies.

