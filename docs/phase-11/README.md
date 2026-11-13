# Phase 11: Patient Portal and Appointment History

## Overview
Phase 11 delivers the patient-facing clinical portal and appointment history workflow for ToothCare Hub. It provides authenticated patients with self-service clinical capabilities:
- **Patient Dashboard**: Dynamic clinical metrics, upcoming confirmed visit highlight, real-time appointments categorization (Upcoming, Pending Review, Completed Treatments), and quick discovery shortcuts.
- **Service Discovery**: Active dental catalog with Philippine Peso (`₱`) pricing, procedure duration breakdown, categorization pills, and instant prefill booking CTAs.
- **Dentist Directory**: Licensed practitioner profiles, PRC license disclosures, operatory chair assignments, clinical biographies, and clinician-specific appointment booking.
- **Patient Profile Management**: Self-service demographics, Philippine phone formatting (`09XXXXXXXXX`), emergency contacts, and comprehensive medical/allergy disclosure without IDOR vulnerabilities (`GET /api/v1/patients/me`, `PATCH /api/v1/patients/me`).
- **In-App Notification Center**: Real-time status updates (Requested, Confirmed, Declined, Cancelled, Completed, Rescheduled) with live unread counter badge, dropdown preview, and full management page.
- **Strict Security & IDOR Protection**: Backend-enforced ownership validation where patients cannot view, mutate, or cancel another patient's appointments, profiles, or notification records.

---

## Architecture & Technology Stack
- **Backend**: Native PHP 8.2+ with PDO MySQL, clean repository-service-controller pattern.
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React, clean rollup code splitting (`vendor-react`, `vendor-icons`).
- **Timezone Convention**: All clinic dates, operating hours, and appointment schedules operate strictly in `Asia/Manila` (PHT).
- **Automated Verification**:
  - PHPUnit: 185 tests, 1050 assertions (100% passing)
  - Vitest: 14 test files, 93 tests (100% passing)
