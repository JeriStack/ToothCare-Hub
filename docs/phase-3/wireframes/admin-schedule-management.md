# ToothCare Hub Wireframe: Dentist Schedule & Time-Off Management (Admin)

**Document ID:** `TCH-P3-WFR-0010`  
**Screen ID:** `SCR-ADM-005`  
**Route:** `/admin/schedules`  
**Authorized Roles:** `ADMIN`  

---

## 1. Screen Specification

### 1.1 Purpose
Allows clinic administrators and receptionists to configure weekly recurring dentist working shifts, assign operatory chairs, declare clinic holidays, and manage dentist time-off requests. This schedule directly dictates bookable slot generation across the patient booking wizard.

### 1.2 Layout & Hierarchy
- **Desktop:** Administrative navigation shell, dentist selector dropdown, week-view schedule matrix (Monday through Sunday, 08:00 to 18:00), shift block visualizer, and actions `[ + Add Recurring Shift ]`, `[ Record Time-Off ]`.
- **Mobile:** Daily agenda switcher (segmented day tabs), list of active shifts per practitioner, and quick shift addition button.

---

## 2. Desktop Wireframe (Weekly Matrix View)

```
+-------------------------------------------------------------------------------+
| [Logo] ToothCare Hub Admin         [Search clinic records...]  [🔔 4] [Admin v]|
+-------------------------------------------------------------------------------+
| [Sidebar]     | Clinic Schedules & Working Shifts                             |
| ( ) Dashboard | Select Practitioner: [ Dr. Maria Santos, DMD (General)      v ]|
| ( ) Appts     | Week: [ < ] Nov 2 - Nov 8, 2026 [ > ]   [ Today ]             |
| ( ) Patients  | Actions: [ + Add Shift ]  [ 🏖 Record Time-Off ]  [ Copy Week ]|
| ( ) Dentists  | Timezone: Asia/Manila (UTC+08:00)                             |
| ( ) Services  |---------------------------------------------------------------|
| (•) Schedules | Mon Nov 2    Tue Nov 3    Wed Nov 4    Thu Nov 5    Fri Nov 6 |
| ( ) Reports   |---------------------------------------------------------------|
| 08:00 - 09:00 | [ CLINIC OPENS: Setup & Sterilization 08:00 - 09:00 ]         |
| 09:00 - 12:00 | +----------+ +----------+ +----------+ +----------+ +--------+|
|               | | Shift:   | | Shift:   | | OFF      | | Shift:   | | Shift: ||
|               | | 09 - 17  | | 09 - 17  | | (No      | | 09 - 17  | | 09-17  ||
|               | | Chair 1  | | Chair 1  | | Shifts)  | | Chair 1  | | Chair 1||
|               | | (4 appts)| | (3 appts)| |          | | (2 appts)| | (5 app)||
| 12:00 - 13:00 | [ LUNCH BREAK: Clinic Staff Rest 12:00 - 13:00 ]              |
| 13:00 - 17:00 | | Shift    | | Shift    | |          | | Shift    | | Shift  ||
|               | | (cont'd) | | (cont'd) | |          | | (cont'd) | |(cont'd)||
|               | +----------+ +----------+ +----------+ +----------+ +--------+|
| 17:00 - 18:00 | [ CLINIC CLOSES: Daily Debrief & Sterilization 17:00 ]        |
+---------------+---------------------------------------------------------------+
```

---

## 3. Mobile Wireframe (Viewport 375px)

```
+-----------------------------------+
| [=] Schedules              [🔔 4] |
+-----------------------------------+
| Practitioner:                     |
| [ Dr. Maria Santos, DMD         v ]|
|                                   |
| Date: Tue, Nov 3, 2026            |
| [ < Mon ]   (•) Tue   [ Wed > ]   |
|                                   |
| Operational Status:               |
| [● On Duty: 09:00 AM - 05:00 PM]  |
| Operatory Chair: Chair 1          |
|                                   |
| Today's Booked Slots (3):         |
| • 09:30 - 10:15: Cleaning (Juan D)|
| • 11:00 - 11:45: Cleaning (Elena G)|
| • 02:00 - 03:00: Filling (Pedro S)|
|                                   |
| Available Slots Remaining: 5      |
|                                   |
| Actions:                          |
| [ + Add Special Override ]        |
| [ 🏖 Record Emergency Time-Off ]  |
+-----------------------------------+
```

---

## 4. Add Working Shift Modal Wireframe

```
+-------------------------------------------------------------+
| Configure Dentist Working Shift                       [ X ] |
+-------------------------------------------------------------+
| Practitioner: Dr. Maria Santos, DMD                         |
|                                                             |
| Day of Week *                                               |
| [ Tuesday                                                 v ]|
|                                                             |
| Shift Start Time *            Shift End Time *              |
| [ 09:00 AM                v ] [ 05:00 PM                  v ]|
|                                                             |
| Lunch Break (Slots blocked automatically):                  |
| [ 12:00 PM                v ] to [ 01:00 PM               v ]|
|                                                             |
| Assigned Operatory Chair *                                  |
| [ Operatory Chair 1 - Main Suite                          v ]|
|                                                             |
| Recurrence:                                                 |
| [x] Repeat every Tuesday indefinitely                       |
|                                                             |
| +-----------------------------+ +-------------------------+ |
| | [ Cancel ]                  | | [ Save Working Shift ]  | |
| +-----------------------------+ +-------------------------+ |
+-------------------------------------------------------------+
```

---

## 5. Screen States & Concurrency Rules
- **Shift Removal Protection:** If an admin attempts to delete a shift on a day that already contains `CONFIRMED` or `PENDING` appointments, the action is blocked with an alert: *"Cannot remove shift. 3 appointments are scheduled. Please reassign patients first."*
- **Time-Off Collision Detection:** Recording approved leave automatically cancels or flags affected appointments for immediate administrative reassignment.

---

## 6. Accessibility (WCAG 2.2 AA)
- Calendar grid employs proper table / grid markup (`role="grid"` with column headers `role="columnheader"`).
- Keyboard users can traverse time slots using Arrow keys and view details with Enter.
- Break times and inactive periods clearly indicated with pattern/shading and visible accessible text (`"Clinic lunch break, no bookings allowed"`).
