# Phase 16 — Mandatory Business-Rule Regression Catalog

| # | Business Rule | Automated Test Reference |
| --- | --- | --- |
| 1 | Valid & invalid registration/login | `Phase16BusinessRuleRegressionTest::testRule1And2...`, `SecurityApiTest` |
| 2 | No public role escalation to ADMIN or DENTIST | `Phase16BusinessRuleRegressionTest::testRule1And2...` |
| 3 | Unauthorized endpoints return `401`/`403` | `Phase16BusinessRuleRegressionTest::testRule3And4...`, `Phase16ApiContractTest` |
| 4 | Patient cannot access another patient's data | `Phase16BusinessRuleRegressionTest::testRule3And4...`, `PatientPortalSecurityTest` |
| 5 | Inactive dentist/service cannot be booked | `Phase16BusinessRuleRegressionTest::testRule5To9...` |
| 6 | Booking outside working hours rejected | `Phase16BusinessRuleRegressionTest::testRule5To9...`, `AvailabilityApiTest` |
| 7 | Dentist time-off/blocked interval respected | `Phase16BusinessRuleRegressionTest::testRule5To9...`, `DentistTimeOffSelfServiceTest` |
| 8 | Adjacent back-to-back appointment allowed (`[start, end)`) | `Phase16BusinessRuleRegressionTest::testRule5To9...` |
| 9 | Overlapping slot request rejected (`409 Conflict`) | `Phase16BusinessRuleRegressionTest::testRule5To9...`, `AppointmentConcurrencyTest` |
| 10 | Invalid appointment state transition rejected | `Phase16BusinessRuleRegressionTest::testRule10And11...`, `AppointmentStatusTest` |
| 11 | Patient cancellation within 24h cutoff rejected | `Phase16BusinessRuleRegressionTest::testRule10And11...` |
| 12 | Email failure leaves committed appointment intact & records retry | `Phase16BusinessRuleRegressionTest::testRule12To15...`, `EmailOutboxFlowTest` |
| 13 | Real-time recipient selection enforced server-side | `Phase16BusinessRuleRegressionTest::testRule12To15...`, `RealtimeNotificationsTest`, `realtime.test.ts` |
| 14 | Unread notifications retrievable via REST after disconnect | `Phase16BusinessRuleRegressionTest::testRule12To15...`, `Phase16RegressionCoverage.test.jsx` |
| 15 | Database migrations work from empty schema & stay idempotent | `.github/workflows/ci.yml` (`migrations` MySQL 8.0 job) |
