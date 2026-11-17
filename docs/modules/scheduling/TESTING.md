# Phase 9: Automated Testing & Verification Guide
## ToothCare Hub — Dental Appointment and Clinic Management System

---

## 1. Overview

Testing for Phase 9 focuses on verifying temporal sanity, interval conflict detection, boundary clamping, and privacy preservation across both unit and integration suites.

---

## 2. 20 Boundary Conditions Coverage Matrix

The suite in [`backend/tests/Unit/AvailabilityServiceTest.php`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects\ToothCare-Hub\backend\tests\Unit\AvailabilityServiceTest.php) executes 20 dedicated test methods verifying each required boundary scenario:

| # | Boundary Condition | Test Method | Result |
| :--- | :--- | :--- | :--- |
| 1 | Slot before clinic opening | `testSlotBeforeClinicOpeningCannotBeGenerated` | PASSED |
| 2 | Slot exactly at clinic opening | `testSlotExactlyAtClinicOpeningIsGenerated` | PASSED |
| 3 | Slot ending exactly at clinic closing | `testSlotEndingExactlyAtClinicClosing` | PASSED |
| 4 | Slot extending beyond clinic closing | `testSlotExtendingBeyondClinicClosingIsExcluded` | PASSED |
| 5 | Slot crossing lunch/schedule break | `testSlotCrossingLunchOrScheduleBreakIsExcluded` | PASSED |
| 6 | Full-day dentist time-off | `testFullDayDentistTimeOffBlocksAllSlots` | PASSED |
| 7 | Partial-day dentist time-off | `testPartialDayDentistTimeOffBlocksOverlappingSlots` | PASSED |
| 8 | Clinic-wide closure | `testClinicWideClosureSuppressesSlots` | PASSED |
| 9 | Inactive dentist rejected | `testInactiveDentistIsRejected` | PASSED |
| 10 | Inactive service rejected | `testInactiveServiceIsRejected` | PASSED |
| 11 | Past date rejected | `testPastDateIsRejected` | PASSED |
| 12 | Date outside booking horizon (>90d) | `testDateOutsideBookingHorizonIsRejected` | PASSED |
| 13 | Slot violating min advance notice (<2h) | `testSlotViolatingMinimumAdvanceNoticeIsExcluded` | PASSED |
| 14 | Short service duration (15m, 30m) | `testShortServiceDurationsGenerateAccurateIntervals` | PASSED |
| 15 | Long service duration (60m, 90m, 120m) | `testLongServiceDurationsGenerateAccurateIntervals` | PASSED |
| 16 | Buffer extending beyond shift | `testBufferExtendingBeyondScheduleIsRejected` | PASSED |
| 17 | Overlapping `PENDING` appointment | `testOverlappingPendingAppointmentBlocksSlot` | PASSED |
| 18 | Overlapping `CONFIRMED` appointment | `testOverlappingConfirmedAppointmentBlocksSlot` | PASSED |
| 19 | Overlapping `CANCELLED` appointment | `testOverlappingCancelledAppointmentDoesNotBlock` | PASSED |
| 20 | Adjacent non-overlapping intervals | `testAdjacentNonOverlappingIntervalsAreAvailable` | PASSED |

---

## 3. Integration & API Test Matrix

Implemented in [`backend/tests/Integration/AvailabilityApiTest.php`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects\ToothCare-Hub\backend\tests\Integration\AvailabilityApiTest.php) and [`backend/tests/Integration/AppointmentRepositoryTest.php`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects\ToothCare-Hub\backend\tests\Integration\AppointmentRepositoryTest.php):

- `testGetAvailabilitySuccess`: Verifies 200 response, JSON envelope, and slot details.
- `testGetAvailabilityValidationFailures`: Verifies 422 on missing parameters and >14 day ranges.
- `testClinicOperatingHoursEndpoints`: Verifies public read and authenticated admin updates.
- `testClinicClosuresLifecycle`: Verifies creation, listing, and deletion of facility closures.
- `testDentistScheduleManagementAndConflictRejection`: Verifies 201 creation, 409 conflict rejection on shift overlap, and 422 on out-of-bounds shift times.
- `testDentistTimeOffManagementAndPrivacyMasking`: Verifies administrative viewing of reasons and privacy masking (`"Unavailable"`) for public callers.
- `testFindBlockingByDentistAndRangeUsesHalfOpenInterval`: Verifies half-open interval conflict detection and non-blocking cancelled appointments.

---

## 4. Verification Commands

### Run Full Test Suite:
```powershell
Push-Location backend
php vendor/bin/phpunit
Pop-Location
```

### Validate OpenAPI 3.0.3 Spec:
```powershell
php backend/scripts/validate-openapi.php
```

### Build Frontend Production Assets:
```powershell
npm run build --prefix frontend
```

