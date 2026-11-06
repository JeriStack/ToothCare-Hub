# Stage 8 — Scheduling and Appointment Booking Integration Implementation Report

**Project:** ToothCare Hub — Dental Appointment and Clinic Management System  
**Stage:** 8 — Scheduling and Appointment Booking Integration  
**Status:** COMPLETE / PASSED  
**Date:** 2026-11-07  
**Branch:** `development`  

---

## 1. Executive Summary

Stage 8 integrates the patient-facing appointment booking wizard with the backend clinical availability engine and MySQL InnoDB database.

The booking system coordinates:
1. **5-Step Guided Wizard:** Service selection → Certified dentist selection → Dynamic slot calculation → Review & clinical disclosures → Confirmation receipt.
2. **Dynamic Slot Engine:** Consumes `GET /api/v1/availability/slots` to evaluate clinician recurring shifts, clinic operating hours (Mon-Sat 8am-5pm), approved time-off, and existing bookings.
3. **Pessimistic Locking & Conflict Mitigation:** On `POST /api/v1/appointments`, the backend uses MySQL transaction locks (`FOR UPDATE`) to verify slot exclusivity. If a concurrent conflict occurs, the frontend catches HTTP 409 and guides the patient to choose an updated available slot.
4. **Landing Page Pre-fills:** Public hero buttons, procedure catalog cards, and doctor roster cards seamlessly carry pre-selected services or dentists directly into the booking flow upon patient login.

---

## 2. Booking Engine Architecture & Data Flow

```
[ Landing Page CTAs / Patient Dashboard ]
   │  └── Passes pre-selected service and/or dentist
   ▼
[ BookAppointmentPage.jsx ]
   ├── Step 1: Select Dental Service (GET /api/v1/services)
   ├── Step 2: Select Certified Dentist (GET /api/v1/dentists)
   ├── Step 3: Date & Slot Picker (<AvailabilitySlotPicker>)
   │              └── Calls GET /api/v1/availability/slots
   ├── Step 4: Review Booking & Policy Consent
   │              └── Chief complaint note, clinic cancellation policy
   └── Step 5: Submission & Confirmation
                  └── POST /api/v1/appointments
                         │
                         ▼
             [ Backend: AppointmentService ]
                ├── Validates clinic hours & dentist shifts
                ├── Applies MySQL transaction with FOR UPDATE
                ├── Inserts appointment record (status: PENDING)
                └── Writes audit log entry
```

---

## 3. Key Implementation Specifications

### 3.1 5-Step Guided Wizard ([`BookAppointmentPage.jsx`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/frontend/src/features/appointments/pages/BookAppointmentPage.jsx))
- **Step 1 (Service):** Card-based catalog selection highlighting standard fee in PHP (`₱`) and duration in minutes.
- **Step 2 (Dentist):** Doctor profile cards showing clinical specialization and default operatory chair.
- **Step 3 (Slot Picker):** Powered by [`AvailabilitySlotPicker.jsx`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/frontend/src/features/schedules/components/AvailabilitySlotPicker.jsx). Calendar date input triggers slot computation. Inactive/closed days or off-duty dates display informative alerts.
- **Step 4 (Review & Disclosures):** Comprehensive visit summary, patient notes/chief complaints input, and mandatory cancellation policy acknowledgment.
- **Step 5 (Confirmed Receipt):** Renders appointment reference ID, clinical procedure, assigned clinician, appointment date/time, and front-desk triage guidance.

### 3.2 Landing Page Pre-Fill Integration
- In [`frontend/src/features/landing/components/ServicesSection.jsx`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/frontend/src/features/landing/components/ServicesSection.jsx): "Book Service" passes the selected procedure object.
- In [`frontend/src/features/landing/components/DentistsSection.jsx`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/frontend/src/features/landing/components/DentistsSection.jsx): "Consult with Doctor" passes the selected dentist object.
- In [`frontend/src/app/App.jsx`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/frontend/src/app/App.jsx): Preserves `bookingPrefill` state through authentication redirects and delivers `initialService` and `initialDentist` props to `BookAppointmentPage`.

### 3.3 Pessimistic Concurrency & Double-Booking Protection
- When submitting `POST /api/v1/appointments`, if another patient claims the exact slot concurrently, the backend responds with HTTP 409 (`SLOT_CONFLICT`).
- The frontend catches this code, displays an amber `AlertTriangle` banner: *"This appointment slot was just reserved by another patient. Please choose an alternative time."*, resets the slot picker, and allows immediate re-selection without data loss.

---

## 4. Verification & Test Execution

- **Vite Build Verification:** PASSED (`0 errors`, 1999 modules transformed, gzip size 103.97 kB).
- **Backend Test Suite:** 137 passing PHPUnit tests (`137 tests, 289 assertions, 0 failures`).
- **Slot Calculation Verification:** Tested appointment booking, slot reservation, and availability queries.
