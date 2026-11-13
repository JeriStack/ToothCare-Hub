# ToothCare Hub — Low-Fidelity Wireframes Index & Layout Specification

**Document ID:** `TCH-P3-WFR-000`  
**Version:** `1.0.0`  
**Phase:** Phase 3 — Requirements, User Journeys, Wireframes, and Design System  
**Prepared Date:** `2026-10-27`  
**Status:** Approved Baseline  
**Author:** Lead UI/UX Designer & Product Architect  

---

## 1. Purpose & Wireframe Standard

This directory contains the low-fidelity wireframe specifications for all fifteen (15) core user interfaces of the **ToothCare Hub** application. 

### Design Philosophy
- **Structure Over Decoration:** Focuses strictly on information hierarchy, layout, element placement, touch targets, and interaction flow rather than superficial styling.
- **Responsive-First:** Every screen defines both **Desktop (1280px+)** and **Mobile (375px - 768px)** layout behaviors.
- **State-Complete:** Every screen specifies its default, loading (skeleton), empty, error, and success states.
- **Accessibility by Design:** Form fields explicitly link to labels, error containers use `aria-live`, interactive targets meet WCAG 2.2 touch minimums (44x44px), and colors never convey status alone.

---

## 2. Master Wireframe Inventory

| # | Screen File | Screen Title | Primary Role | Layout Pattern | Priority |
| :---: | :--- | :--- | :--- | :--- | :---: |
| 1 | [`auth-login.md`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/docs/phase-3/wireframes/auth-login.md) | User Login & Authentication | All Roles / Public | Centered Card Shell | Critical |
| 2 | [`auth-register.md`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/docs/phase-3/wireframes/auth-register.md) | Patient Account Registration | Public / Patient | Split Card Shell | Critical |
| 3 | [`patient-dashboard.md`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/docs/phase-3/wireframes/patient-dashboard.md) | Patient Portal Dashboard | `PATIENT` | App Shell + Widget Grid | Critical |
| 4 | [`appointment-booking-wizard.md`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/docs/phase-3/wireframes/appointment-booking-wizard.md) | 6-Step Appointment Booking | `PATIENT` | Stepper + Dual-Column Grid | Critical |
| 5 | [`appointment-history-details.md`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/docs/phase-3/wireframes/appointment-history-details.md) | Appointment History & Detail Drawer | `PATIENT` | Data Table / Card + Slide Drawer | High |
| 6 | [`admin-dashboard.md`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/docs/phase-3/wireframes/admin-dashboard.md) | Clinic Operations Dashboard | `ADMIN` | App Shell + Metric Cards + Tables | Critical |
| 7 | [`admin-patient-management.md`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/docs/phase-3/wireframes/admin-patient-management.md) | Patient Registry & Records | `ADMIN` | Master-Detail Filterable Table | High |
| 8 | [`admin-dentist-management.md`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/docs/phase-3/wireframes/admin-dentist-management.md) | Dentist Roster & Profiles | `ADMIN` | Card Grid / Table + Modal | High |
| 9 | [`admin-service-management.md`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/docs/phase-3/wireframes/admin-service-management.md) | Dental Services & Pricing Catalog | `ADMIN` | Categorized Table + Modal Form | High |
| 10 | [`admin-schedule-management.md`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/docs/phase-3/wireframes/admin-schedule-management.md) | Working Shifts & Time-Off Management | `ADMIN` | Calendar / Weekly Matrix View | High |
| 11 | [`admin-appointment-review.md`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/docs/phase-3/wireframes/admin-appointment-review.md) | Appointment Review & Triage Queue | `ADMIN` | Triage Queue + Action Drawer | Critical |
| 12 | [`dentist-dashboard.md`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/docs/phase-3/wireframes/dentist-dashboard.md) | Dentist Daily Practice Dashboard | `DENTIST` | Timeline Agenda + Quick Stats | Critical |
| 13 | [`dentist-appointment-details.md`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/docs/phase-3/wireframes/dentist-appointment-details.md) | Assigned Appointment & Patient Context | `DENTIST` | Patient Banner + Accordion Panels | High |
| 14 | [`dentist-treatment-entry.md`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/docs/phase-3/wireframes/dentist-treatment-entry.md) | Clinical Treatment Record Entry | `DENTIST` | Structured Clinical Record Form | Critical |
| 15 | [`notifications-interface.md`](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/docs/phase-3/wireframes/notifications-interface.md) | Real-Time Notification Center | All Roles | Slide Drawer / Full Page Center | High |

---

## 3. Visual Key for ASCII Wireframes

```
+-------------------------------------------------------+  <- Window / Shell Boundary
| [Logo] ToothCare Hub           (Nav)   [Notif: 2] (User)|  <- Top Header Bar
+-------------------------------------------------------+
| [Side Nav Item] | [Page Title]          [Action Button] |  <- Subheader / Toolbar
|                 |---------------------------------------|
| (•) Nav Link 1  | [Metric Card 1]     [Metric Card 2]   |  <- Metric / KPI Area
| ( ) Nav Link 2  |                                       |
|                 | +-----------------------------------+ |  <- Card / Container
|                 | | Table / List Area                 | |
|                 | +-----------------------------------+ |
+-----------------+---------------------------------------+
```

- `[ Button Name ]` = Interactive clickable button
- `( Input Field )` = Text or select input field
- `[x] / [ ]` = Checkbox control
- `(•) / ( )` = Radio button control
- `[Status Badge]` = Visual status tag (always accompanied by text label + icon)
- `[...]` = Ellipsis / overflow action trigger
