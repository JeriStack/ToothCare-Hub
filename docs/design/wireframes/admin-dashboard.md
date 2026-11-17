# ToothCare Hub Wireframe: Clinic Operations Dashboard (Admin)

**Document ID:** `TCH-P3-WFR-006`  
**Screen ID:** `SCR-ADM-001`  
**Route:** `/admin/dashboard`  
**Authorized Roles:** `ADMIN`  

---

## 1. Screen Specification

### 1.1 Purpose
Provides clinic management, receptionists, and administrators with an operational control center. Displays live key performance indicators (KPIs), pending appointment requests requiring review, today's confirmed schedule across all operatory chairs, dentist on-duty statuses, and quick shortcuts for patient registration or walk-in booking.

### 1.2 Layout & Hierarchy
- **Desktop:** Global administrative navigation shell with persistent sidebar (Dashboard, Appointments, Patients, Dentists, Services, Schedules, Reports, Settings) and responsive grid:
  - Metric Summary Strip (4 KPI cards).
  - Triage Alert Banner (highlights unreviewed pending requests with badge counter).
  - Two-column main layout: Left = Live Daily Schedule Timeline; Right = Pending Appointment Triage Queue.
- **Mobile:** Top header with menu toggle, swipeable metric cards, priority triage cards, and collapsible daily timeline.

---

## 2. Desktop Wireframe

```
+-------------------------------------------------------------------------------+
| [Logo] ToothCare Hub Admin         [Search clinic records...]  [🔔 4] [Admin v]|
+-------------------------------------------------------------------------------+
| [Sidebar]          | Clinic Operations Dashboard               Tuesday, Nov 3 |
| (•) Dashboard      | Overview of clinic activities, schedules, and approvals. |
| ( ) Appointments (3)|---------------------------------------------------------|
| ( ) Patients       | [ 📅 Today's Visits: 14 ]   [ ⏳ Pending Requests: 3  ]   |
| ( ) Dentists       | [ 👨‍⚕️ Dentists On Duty: 4 ] [ ₱ Est. Revenue: ₱28,500 ] |
| ( ) Services       |---------------------------------------------------------|
| ( ) Schedules      | [!] ALERT: 3 appointment requests require receptionist    |
| ( ) Reports        |     review before schedule lock. [ Review Queue Now > ]  |
| ------------------ |---------------------------------------------------------|
| [Settings]         | TODAY'S CLINIC AGENDA           | PENDING APPROVAL QUEUE  |
| [Log Out]          | (4 Operatory Chairs Active)     | (Last sync: 2 mins ago) |
|                    | +-----------------------------+ | +---------------------+ |
|                    | | 09:00 - Dr. Santos (Ch 1)   | | | Ref #1049 (14m ago) | |
|                    | | Juan Dela Cruz - Cleaning   | | | Maria Garcia        | |
|                    | | Status: [In Progress]       | | | Filling • Nov 17    | |
|                    | |-----------------------------| | | [Approve] [Reject]  | |
|                    | | 09:30 - Dr. Reyes (Ch 2)    | | |---------------------| |
|                    | | Elena Gomez - Root Canal    | | | Ref #1052 (32m ago) | |
|                    | | Status: [CONFIRMED]         | | | Roberto Tan         | |
|                    | |-----------------------------| | | Cleaning • Nov 05   | |
|                    | | 10:15 - Dr. Santos (Ch 1)   | | | [Approve] [Reject]  | |
|                    | | Pedro Santos - Extraction   | | +---------------------+ |
|                    | | Status: [CONFIRMED]         | | [ View All Pending > ]| |
|                    | +-----------------------------+ |                         |
+--------------------+---------------------------------+-------------------------+
```

---

## 3. Mobile Wireframe (Viewport 375px)

```
+-----------------------------------+
| [=] ToothCare Admin        [🔔 4] |
+-----------------------------------+
| Clinic Overview                   |
| Nov 3, 2026 • 09:15 AM            |
|                                   |
| [!] 3 Requests Need Review        |
| [ Open Triage Queue (Primary) ]   |
|                                   |
| Today's Metrics                   |
| +-------------------------------+ |
| | Visits: 14   | Pending: 3     | |
| | Dentists: 4  | Rev: ₱28,500   | |
| +-------------------------------+ |
|                                   |
| Next Appointment                  |
| +-------------------------------+ |
| | 09:30 AM • Chair 2            | |
| | Patient: Elena Gomez          | |
| | Dentist: Dr. Reyes            | |
| | Service: Root Canal           | |
| | Status: [● Confirmed]         | |
| +-------------------------------+ |
|                                   |
| Quick Actions:                    |
| [ + Register Walk-in Patient ]    |
| [ 📅 View Full Day Schedule ]     |
+-----------------------------------+
```

---

## 4. UI Elements & Form Requirements

| Element | Type | Purpose | Behavior |
| :--- | :--- | :--- | :--- |
| **Pending Alert Banner** | Accessible Alert (`role="alert"`) | Notifies staff of backlogged requests | Pulsing amber icon; links directly to triage modal |
| **Metric Cards** | Interactive Cards | High-level clinical KPIs | Clicking card filters appointments table by matching status |
| **Quick Action Approve** | Inline Button (Teal) | One-click approval from dashboard | Prompts confirmation tooltip, updates status immediately |
| **Quick Action Reject** | Inline Button (Slate/Red) | Initiates rejection flow | Opens rejection modal requiring reason selection |

---

## 5. Screen States

- **Loading State:** Skeleton pulse placeholders across KPI cards, timeline items, and triage cards.
- **Empty Triage State:** Green checkmark card stating: *"All appointment requests reviewed. Queue is clean!"*.
- **Real-Time Notification Event:** When a new patient booking arrives via Socket.IO, the pending counter increments with a subtle scale bounce animation and a toast pops: *"New request received from Maria Garcia"*.

---

## 6. Accessibility (WCAG 2.2 AA)
- KPI metrics wrapped in semantic definition lists or accessible card structures (`<div role="region" aria-label="Key Performance Indicators">`).
- Live updates to pending counts announce via `aria-live="polite"`.
- Table and schedule items accessible via standard tab order.
