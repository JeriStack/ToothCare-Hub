# Phase 16 — Backend Testing Guide (PHPUnit 11)

## Commands

```powershell
# Full backend suite (Unit + Integration)
composer --working-dir=backend test

# Unit tests only
composer --working-dir=backend test:unit

# Integration & regression tests only
composer --working-dir=backend test:integration

# Phase 16 mandatory business-rule & contract suites
.\backend\vendor\bin\phpunit.bat -c backend/phpunit.xml backend/tests/Integration/Phase16BusinessRuleRegressionTest.php backend/tests/Integration/Phase16ApiContractTest.php
```

## Key Test Suites

- **Unit (`backend/tests/Unit/`)**: `AuthValidatorTest`, `AppointmentStatusTest`, `AppointmentServiceTest`, `AvailabilityServiceTest`, `EmailRetryPolicyTest`, `EmailServiceTest`, `PayloadCipherTest`, `CsrfMiddlewareTest`, `CorsMiddlewareTest`, `NotificationServiceTest`, `TreatmentRecordServiceTest`, and more.
- **Integration (`backend/tests/Integration/`)**: `AppointmentApiTest`, `AppointmentConcurrencyTest`, `DentistAppointmentAuthorizationTest`, `PatientPortalSecurityTest`, `EmailOutboxFlowTest`, `RealtimeNotificationsTest`, `Phase15DashboardSearchReportsTest`, `Phase16BusinessRuleRegressionTest`, and `Phase16ApiContractTest`.

## Isolation Guarantees

- No automated PHPUnit test contacts a live SMTP server (`FakeMailTransport` + `MAIL_ENABLED=false`).
- Every integration test initializes a clean isolated schema via `TestDb::create()` using synthetic accounts only.
