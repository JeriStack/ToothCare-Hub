# Phase 9: Administrative Schedule Management Guide
## ToothCare Hub — Dental Appointment and Clinic Management System

---

## 1. Overview

The administrative schedule management interface (`frontend/src/features/schedules/pages/AdminSchedulePage.jsx`) provides clinic administrators and receptionists with comprehensive control over facility operating hours, practitioner shift assignments, clinic closures, and approved leaves.

Access is guarded by backend `AuthorizationMiddleware(['ADMIN'])` and exposed via the sidebar navigation item **Hours & Schedules**.

---

## 2. Interface Features & Workflows

### 2.1 Clinic Facility Hours & Closures
- **Weekly Facility Operating Schedule**:
  - Displays each weekday (Monday through Sunday) with Opening Time, Closing Time, and Open/Closed status.
  - Allows toggling whole-day closures (e.g. Sundays or holidays).
  - "Save Facility Hours" button validates and persists changes via `PUT /api/v1/admin/clinic/hours`.
- **Scheduled Clinic Closures**:
  - Displays registered holiday, renovation, and emergency facility closure intervals.
  - "Schedule Closure" modal allows entering title, start date-time, end date-time, category (Holiday, Maintenance, Emergency, Special Closure), and internal notes.
  - Removing a closure immediately restores regular practitioner slot calculations.

### 2.2 Practitioner Weekly Shift Planner
- **Practitioner Selector**: Dropdown to choose any registered dentist from the active roster.
- **Weekly Schedule Grid**: Visual weekday cards (Monday through Sunday) displaying shift start times, end times, and operatory chair allocations (e.g., "Chair 1", "Surgical Bay").
- **Add / Edit Shift**:
  - Validates that shift times fall within clinic facility hours for that day.
  - Validates that shifts do not collide or overlap with existing shifts for that dentist on the same day.
  - Displays immediate conflict alerts (HTTP 409) if an overlap occurs.
- **Delete Shift**: Allows removing individual shift blocks.

### 2.3 Practitioner Time-Off & Leaves
- **Leave Records**: Lists all scheduled vacations, medical leaves, and conference absences for the selected practitioner.
- **Schedule Time-Off**:
  - Modal form specifying start datetime, end datetime, and description/reason.
  - Rejects overlapping leave requests (HTTP 409).
- **Privacy Preservation**: While administrators and the practitioner themselves see full medical reasons, public and patient API consumers receive masked reason `"Unavailable"`.

### 2.4 Live Availability Tester
- Enables administrative and clinical staff to test the availability calculation engine live.
- Administrators select a dentist, service, and appointment date to immediately inspect calculated slots.
- Shows total bookable slots, duration, 10-minute post-service buffer intervals, and chair allocations.

