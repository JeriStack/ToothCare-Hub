# Patient Portal Architecture & Design System

## 1. Overview
The ToothCare Hub Patient Portal provides a cohesive, responsive healthcare experience adhering to the Impeccable design system. It allows patients to manage their oral care journey from initial service discovery through booking, visit tracking, notification handling, and medical history maintenance.

---

## 2. Navigation & Route Hierarchy
Routes are synchronized between client state and browser URL history:

| Path | View / Component | Access Level | Description |
|------|------------------|--------------|-------------|
| `/patient` or `/patient/dashboard` | `PatientDashboard` | Patient | Welcome banner, Asia/Manila date, 3 metric cards, next visit card, multi-tab appointments list, discovery shortcuts |
| `/patient/book` | `BookAppointmentPage` | Patient | 5-step booking wizard with real-time slot generation and prefilled service/dentist support |
| `/patient/services` | `PatientServicesPage` | Patient / Public | Catalog of active dental procedures, category filtering, search, pricing (₱ PHP), duration, and booking CTA |
| `/patient/dentists` | `PatientDentistsPage` | Patient / Public | Licensed clinical practitioners roster, specialty filters, PRC credentials, operatory chairs, and profile dialog |
| `/patient/appointments` | `AppointmentHistoryPage` | Patient | Comprehensive appointment registry with status badges, pagination, filter controls, and cancellation dialog |
| `/patient/notifications` | `PatientNotificationsPage` | Patient | Full in-app notifications hub with read/unread filtering, individual mark read, and mark all read actions |
| `/patient/profile` | `PatientProfilePage` | Patient | Self-service demographic, emergency contact, and medical questionnaire management |

---

## 3. Component Hierarchy & Reusability
- **`PatientDashboard`**:
  - Greeting banner displaying patient first name and current date in `Asia/Manila`.
  - Statistics Cards:
    - *Upcoming Visits*: `CONFIRMED` appointments scheduled in future/today.
    - *Pending Requests*: `PENDING` booking requests awaiting administrative triage.
    - *Completed Treatments*: `COMPLETED` historical dental procedures.
  - *Next Confirmed Visit Hero*: Prominently features the immediate next appointment with service name, scheduled time in Asia/Manila, assigned clinician, operatory chair, and details link.
  - Multi-tab List (Upcoming, Pending, Completed) with status badges and clean empty states.
  - Discovery shortcuts to Services, Dentists, and Medical Profile.
- **`NotificationCenter`**:
  - Bell icon embedded in sticky header with live unread counter badge.
  - Interactive dropdown showing the latest 5 unread alerts, relative time, and quick "Mark all as read" button.
  - "View all notifications" link directing to `/patient/notifications`.
- **`PatientServicesPage`**:
  - Searchable service grid with category pills (`Preventive Care`, `Restorative`, `Cosmetic`, `Orthodontics`, `Surgical`).
  - Strict policy: Only active services (`is_active = 1`) are presented or bookable.
  - "Book This Service" CTA passes selected service to booking wizard.
- **`PatientDentistsPage`**:
  - Roster of active dentists with professional titles, PRC license numbers, chair assignments, and clinical biographies.
  - "Book with Dr. [Name]" CTA pre-fills the dentist in the appointment wizard.
- **`PatientProfilePage`**:
  - Tabular form with live input formatting, phone validation (`09XXXXXXXXX`), emergency contact info, and medical alerts disclosure.
  - Read-only email input with verification status badge and security note.
