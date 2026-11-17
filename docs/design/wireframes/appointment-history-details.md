# ToothCare Hub Wireframe: Appointment History & Detail Drawer

**Document ID:** `TCH-P3-WFR-005`  
**Screen ID:** `SCR-PAT-003`  
**Route:** `/patient/appointments` & `/patient/appointments/:id`  
**Authorized Roles:** `PATIENT`  

---

## 1. Screen Specification

### 1.1 Purpose
Enables patients to browse their comprehensive record of upcoming and historical dental visits, filter by appointment status (`CONFIRMED`, `PENDING`, `COMPLETED`, `CANCELLED`), inspect full details in an accessible slide-over drawer, cancel upcoming visits when policy permits, or initiate rescheduling.

### 1.2 Layout & Hierarchy
- **Desktop:** Tabbed filter view (Upcoming, Past, Cancelled) over a rich data table. Clicking any row opens a right-side slide-over drawer (`480px` wide) preserving background context.
- **Mobile:** Segmented pill controls over stacked appointment cards. Clicking a card opens a full-screen modal with sticky action footer.

---

## 2. Desktop Wireframe (Table View + Slide-Over Drawer)

```
+-------------------------------------------------------------------------------+
| [Logo] ToothCare Hub           [Search appointments...]   [🔔 2] [Juan D. v] |
+-------------------------------------------------------------------------------+
| [Sidebar]     | Appointments & Visit Records                                  |
| ( ) Dashboard | Filter: [ All (4) ] [ Upcoming (2) ] [ Completed (1) ] [ Cancelled ]|
| (•) My Appts  |---------------------------------------------------------------|
| ( ) History   | +-----------------------------------------------------------+ |
|               | | Ref #   Service       Dentist      Date & Time    Status  | |
|               | |-----------------------------------------------------------| |
|               | | #1042   Cleaning      Dr. Santos   Nov 3, 09:30   [CONF] >| |
|               | | #1049   Fluoride Trt  Dr. Reyes    Nov 17, 14:00  [PEND] >| |
|               | | #0981   Dental Filling Dr. Santos  Oct 12, 10:00  [COMP] >| |
|               | +-----------------------------------------------------------+ |
|               |                                                               |
|               | +-----------------------------------------------------------+ |
|               | | Slide-Over Drawer: Appointment Details (#1042)        [X] | |
|               | |-----------------------------------------------------------| |
|               | | Status: [● Confirmed] • Ref ID: TCH-APP-1042              | |
|               | | Service: Dental Prophylaxis (Cleaning)                    | |
|               | | Est. Duration: 45 Minutes • Fee: ₱1,500.00                | |
|               | |                                                           | |
|               | | Dentist: Dr. Maria Santos, DMD                            | |
|               | | Clinic Chair: Operatory 2                                 | |
|               | | Schedule: Tuesday, Nov 3, 2026 • 09:30 AM (Asia/Manila)   | |
|               | | Time Remaining: 6 days, 4 hours                           | |
|               | |                                                           | |
|               | | Patient Notes: "Routine 6-month cleaning"                 | |
|               | |                                                           | |
|               | | Cancellation Policy:                                      | |
|               | | Free cancellation available until Nov 2, 09:30 AM.        | |
|               | |                                                           | |
|               | | Actions:                                                  | |
|               | | [ Reschedule Slot ]       [ Cancel Appointment (Red) ]    | |
|               | +-----------------------------------------------------------+ |
+---------------+---------------------------------------------------------------+
```

---

## 3. Mobile Wireframe (Viewport 375px)

```
+-----------------------------------+
| [=] My Appointments        [🔔 2] |
+-----------------------------------+
| [ Upcoming ] [ Past ] [ Cancelled]|
|                                   |
| +-------------------------------+ |
| | Ref #1042                     | |
| | Dental Cleaning (45m)         | |
| | 👨‍⚕️ Dr. Maria Santos          | |
| | 📅 Nov 3, 2026 • 09:30 AM     | |
| | Status: [● Confirmed]         | |
| | [ View Full Details & Policy] | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | Ref #1049                     | |
| | Fluoride Treatment            | |
| | 👨‍⚕️ Dr. Reyes                 | |
| | 📅 Nov 17, 2026 • 02:00 PM    | |
| | Status: [⏳ Pending Review]   | |
| | [ Cancel Pending Request ]    | |
| +-------------------------------+ |
+-----------------------------------+
```

---

## 4. Cancellation Dialog Wireframe (Modal)

```
+-------------------------------------------------------------+
| Confirm Appointment Cancellation                      [ X ] |
+-------------------------------------------------------------+
| Are you sure you want to cancel appointment #1042?          |
|                                                             |
| Schedule: Tuesday, Nov 3, 2026 at 09:30 AM                  |
| Dentist: Dr. Maria Santos, DMD                              |
|                                                             |
| Please select a reason for cancellation: *                  |
| [ Personal schedule conflict                              v ]|
|                                                             |
| Additional note (optional):                                 |
| [ Need to travel out of town for work.                    ] |
|                                                             |
| Notice: Once cancelled, this slot will be released to other |
| patients and cannot be restored.                            |
|                                                             |
| +-----------------------------+ +-------------------------+ |
| | [ Keep Appointment ]        | | [ Yes, Cancel Slot ]    | |
| +-----------------------------+ +-------------------------+ |
+-------------------------------------------------------------+
```

---

## 5. Screen States & Policy Logic

- **Policy < 24 Hours Remaining:**  
  If current time is within 24 hours of appointment start time, the red *"Cancel Appointment"* button is replaced with:  
  `[ Late Cancellation Restricted - Call Clinic (02) 8123-4567 ]`
- **Completed Visit View:**  
  When status is `COMPLETED`, the drawer displays the Treatment Summary authored by the dentist, including teeth treated, clinical notes, and post-treatment home care instructions.
- **Empty State:**  
  Shows an illustration and message: *"No appointments found in this category. [Book a Visit]"*.

---

## 6. Accessibility (WCAG 2.2 AA)
- Slide-over drawer traps focus (`role="dialog"` with `aria-modal="true"` and `aria-labelledby="drawer-title"`).
- Pressing Escape closes drawer and restores focus to the table trigger row.
- Table headers use `<th scope="col">` with keyboard-sortable triggers.
