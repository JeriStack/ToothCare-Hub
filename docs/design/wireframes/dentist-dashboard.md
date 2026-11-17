# ToothCare Hub Wireframe: Dentist Daily Practice Dashboard

**Document ID:** `TCH-P3-WFR-0012`  
**Screen ID:** `SCR-DEN-001`  
**Route:** `/dentist/dashboard`  
**Authorized Roles:** `DENTIST`  

---

## 1. Screen Specification

### 1.1 Purpose
Provides attending dental practitioners with an optimized clinical agenda for their daily practice. Displays chronological patient appointments, medical alerts (allergies), quick access to patient visit histories, appointment progress status (`CONFIRMED`, `IN_PROGRESS`, `COMPLETED`), and direct triggers to author clinical treatment notes.

### 1.2 Layout & Hierarchy
- **Desktop:** Dentist clinical shell (Header with practitioner badge, notification center, profile; Left navigation: Dashboard, My Schedule, Patient Records, Treatment Notes). Main view contains:
  - Daily Clinical Summary strip (Total Today, In Chair, Completed, Remaining).
  - Date Navigator (`< Previous Day`, `Today: Tuesday, Nov 3`, `Next Day >`).
  - Chronological Patient Appointment Timeline with expand/collapse cards.
- **Mobile / Tablet:** Optimized for chairside tablets (iPad/Android). Large touch-friendly cards, high-contrast allergy badges, and direct *"Open Treatment Record"* button.

---

## 2. Desktop Wireframe

```
+-------------------------------------------------------------------------------+
| [Logo] ToothCare Hub Doctor Portal [Today: Nov 3, 2026] [🔔 1] [Dr. Santos v] |
+-------------------------------------------------------------------------------+
| [Sidebar]     | Today's Clinical Agenda — Operatory Chair 1                   |
| (•) Dashboard | Practitioner: Dr. Maria Santos, DMD (General & Cosmetic)      |
| ( ) Schedule  | Shift: 09:00 AM – 05:00 PM (Asia/Manila)                      |
| ( ) Patients  |---------------------------------------------------------------|
| ( ) Treatments| [ 📅 4 Patients Today ] [ ⏱ 1 In Chair ] [ ✓ 1 Done ] [ 2 Pending ]|
| ------------------------------------------------------------------------------|
| [Date Switch] | TODAY'S PATIENT TIMELINE (Tuesday, November 3, 2026)          |
| [ < ] Today [>]---------------------------------------------------------------|
| 09:00 - 09:30 | +-----------------------------------------------------------+ |
| (Completed)   | | 09:00 AM • Juan Dela Cruz (#101)                          | |
|               | | Service: Dental Prophylaxis • Status: [✓ COMPLETED]       | |
|               | | Notes: "Scaling & polishing complete. Fluoride applied."  | |
|               | | [ View Finalized Treatment Record ]                       | |
|               | +-----------------------------------------------------------+ |
|               |                                                               |
| 09:30 - 10:15 | +-----------------------------------------------------------+ |
| (IN CHAIR)    | | 09:30 AM • Elena Gomez (#104)         [● IN CHAIR / ACTIVE| |
|               | | Medical Alert: [⚠️ PENICILLIN ALLERGY (Red Badge)]        | |
|               | | Service: Composite Tooth Filling (#14, #15) • Est. 45 mins | |
|               | | Chief Complaint: "Pain on sweet food, lower right molar"   | |
|               | |                                                           | |
|               | | Actions:                                                  | |
|               | | +-------------------------------------------------------+ | |
|               | | | [ Author Treatment Notes & Complete Visit (Primary) ] | | |
|               | | +-------------------------------------------------------+ | |
|               | +-----------------------------------------------------------+ |
|               |                                                               |
| 11:00 - 11:45 | +-----------------------------------------------------------+ |
| (Upcoming)    | | 11:00 AM • Roberto Tan (#105)         [● CONFIRMED]       | |
|               | | Service: Dental Cleaning • Est. 45 mins                   | |
|               | | [ View Patient History ]     [ Mark In Progress ]         | |
|               | +-----------------------------------------------------------+ |
+---------------+---------------------------------------------------------------+
```

---

## 3. Mobile / Tablet Wireframe (Viewport 375px)

```
+-----------------------------------+
| [=] Dr. Santos — Today     [🔔 1] |
+-----------------------------------+
| Tue, Nov 3 • Operatory Chair 1    |
| Progress: 1/4 Completed (25%)     |
|                                   |
| ACTIVE PATIENT NOW                |
| +-------------------------------+ |
| | Elena Gomez (#104)            | |
| | ⏱ 09:30 AM – 10:15 AM         | |
| | Service: Composite Filling    | |
| | [!] ALLERGY: PENICILLIN (Red) | |
| |                               | |
| | Chief Complaint:              | |
| | "Molar pain on sweet foods"   | |
| |                               | |
| | +---------------------------+ | |
| | | [ Open Treatment Form ]   | | | (Primary Teal - 50px touch height)
| | +---------------------------+ | |
| +-------------------------------+ |
|                                   |
| Next Up:                          |
| +-------------------------------+ |
| | 11:00 AM • Roberto Tan        | |
| | Cleaning • [● Confirmed]      | |
| | [ Patient Context > ]         | |
| +-------------------------------+ |
+-----------------------------------+
```

---

## 4. UI Elements & Form Requirements

| Element | Type | Purpose | Behavior |
| :--- | :--- | :--- | :--- |
| **Allergy Warning Tag** | Accessible Badge (`role="alert"`) | Immediate clinical safety warning | High-contrast red (`#EF4444`) background with exclamation icon `[!]` |
| **Active Patient Banner** | Landmark Container | Highlights the current patient in the chair | Distinct teal accent border and pulse indicator |
| **Open Treatment Form** | Primary Button | Launches clinical documentation view | Navigates directly to `/dentist/treatments/new?appointment_id=...` |

---

## 5. Screen States
- **Loading State:** Shimmer skeletons along chronological timeline items.
- **Empty Day (No Appointments):** Illustration of clean dental chair with message: *"No appointments scheduled for today. Enjoy your day or review upcoming shifts."*.
- **Post-Completion Dynamic Transition:** When a visit is completed, the card collapses into the completed view, and the next appointment card automatically moves to the top with focus.

---

## 6. Accessibility (WCAG 2.2 AA)
- Allergy warning has high contrast (white text on dark red `#B91C1C`, ratio 5.1:1).
- Time milestones marked with `<time datetime="2026-11-03T09:30:00+08:00">`.
- Optimized for gloved or stylus interaction on tablet devices with min 48px touch targets.
