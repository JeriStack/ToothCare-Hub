# ToothCare Hub Wireframe: Appointment Review & Approval Queue (Admin)

**Document ID:** `TCH-P3-WFR-0011`  
**Screen ID:** `SCR-ADM-006`  
**Route:** `/admin/appointments` (filtered by `status=PENDING`)  
**Authorized Roles:** `ADMIN`  

---

## 1. Screen Specification

### 1.1 Purpose
Provides clinic receptionists and triage administrators with a high-efficiency review queue for incoming patient appointment requests. Verifies patient eligibility, dentist schedule availability, chair conflicts, and provides authorized one-click approval or rejection with custom notes and real-time patient notifications.

### 1.2 Layout & Hierarchy
- **Desktop:** Administrative navigation shell with prominent triage metrics, filter toolbar (Pending, Confirmed, Cancelled, Completed, All), pending queue data table with fast triage action buttons, and slide-over review drawer (`520px`).
- **Mobile:** Priority pending card stack with direct swipe or tap actions for review, approval, and rejection.

---

## 2. Desktop Wireframe (Triage Queue + Slide-Over Drawer)

```
+-------------------------------------------------------------------------------+
| [Logo] ToothCare Hub Admin         [Search clinic records...]  [🔔 4] [Admin v]|
+-------------------------------------------------------------------------------+
| [Sidebar]     | Appointment Triage & Review Queue                             |
| ( ) Dashboard | Status: [ (•) Pending Review (3) ] [ Confirmed (18) ] [ All ] |
| (•) Appts (3) | Time Range: [ This Week v ]   Dentist: [ All Practitioners v ]|
| ( ) Patients  | Action: [ Export Daily Run Sheet ]                            |
| ( ) Dentists  |---------------------------------------------------------------|
| ( ) Services  | +-----------------------------------------------------------+ |
| ( ) Schedules | | Ref #  Received  Patient Name  Dentist      Schedule Action| |
| ( ) Reports   | |-----------------------------------------------------------| |
|               | | #1049  14m ago   Maria Garcia  Dr. Reyes    Nov 17 [Review]| |
|               | | #1052  32m ago   Roberto Tan   Dr. Santos   Nov 05 [Review]| |
|               | | #1055  1h ago    Carla Gomez   Dr. Lim      Nov 08 [Review]| |
|               | +-----------------------------------------------------------+ |
|               |                                                               |
|               | +-----------------------------------------------------------+ |
|               | | Slide-Over Review Drawer: Request #1049               [X] | |
|               | |-----------------------------------------------------------| |
|               | | Status: [⏳ PENDING RECEPTION REVIEW]                     | |
|               | | Submitted: Oct 27, 2026 at 10:14 PM (14 mins ago)         | |
|               | |                                                           | |
|               | | Patient: Maria Garcia (ID #102)                           | |
|               | | Phone: 0918-987-6543 • Email: maria.g@email.ph            | |
|               | | History: 2 previous visits • 0 no-shows (Reliable patient)| |
|               | |                                                           | |
|               | | Requested Service: Tooth Filling (Composite)              | |
|               | | Duration: 45 Minutes • Standard Fee: ₱1,800.00            | |
|               | |                                                           | |
|               | | Requested Schedule:                                       | |
|               | | Tuesday, Nov 17, 2026 • 02:00 PM – 02:45 PM (Asia/Manila) | |
|               | | Dentist: Dr. Roberto Reyes, DMD (Orthodontics & Restorative| |
|               | |                                                           | |
|               | | Conflict Verification Engine:                             | |
|               | | [✓] Dr. Reyes shift confirmed (09:00 - 17:00)             | |
|               | | [✓] Chair 2 available (Zero overlapping appointments)     | |
|               | |                                                           | |
|               | | Patient Chief Complaint:                                  | |
|               | | "Filling on upper right molar came loose while eating."   | |
|               | |                                                           | |
|               | | Decision Actions:                                         | |
|               | | +-----------------------+   +---------------------------+ | |
|               | | | [ Reject Request ]    |   | [ Approve Appointment ]   | | |
|               | | +-----------------------+   +---------------------------+ | |
|               | +-----------------------------------------------------------+ |
+---------------+---------------------------------------------------------------+
```

---

## 3. Mobile Wireframe (Viewport 375px)

```
+-----------------------------------+
| [=] Review Queue (3)       [🔔 4] |
+-----------------------------------+
| [!] 3 Requests Awaiting Decision  |
|                                   |
| +-------------------------------+ |
| | Request #1049 (14 mins ago)   | |
| | Patient: Maria Garcia         | |
| | Service: Composite Filling    | |
| | Dentist: Dr. Roberto Reyes    | |
| | Schedule: Nov 17 • 02:00 PM   | |
| | Chair: Operatory Chair 2      | |
| | Conflict Check: [✓ Clean]     | |
| |                               | |
| | Notes: "Filling came loose"   | |
| |                               | |
| | +---------------------------+ | |
| | | [ Approve Appointment ]   | | | (Primary Teal - 48px height)
| | +---------------------------+ | |
| | +---------------------------+ | |
| | | [ Reject Request ]        | | | (Outline Red/Slate)
| | +---------------------------+ | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | Request #1052 (32 mins ago)   | |
| | Patient: Roberto Tan          | |
| | [ Review Request > ]          | |
| +-------------------------------+ |
+-----------------------------------+
```

---

## 4. Rejection Modal Wireframe

```
+-------------------------------------------------------------+
| Reject Appointment Request #1049                      [ X ] |
+-------------------------------------------------------------+
| Patient: Maria Garcia                                       |
| Requested Slot: Tuesday, Nov 17, 2026 at 02:00 PM           |
|                                                             |
| Please select a reason for rejecting this request: *        |
| [ Practitioner emergency leave / schedule override        v ]|
|                                                             |
| Explanation for Patient (Included in SMS & Notification): * |
| [ Dr. Reyes is on emergency leave on Nov 17. We recommend   |
|   rescheduling with Dr. Santos or picking Nov 18.         ] |
|                                                             |
| Suggest Alternative Slot to Patient (Optional):             |
| [ 2026-11-18 📅 ]  at [ 02:00 PM v ]                        |
|                                                             |
| Notice: The slot will be released and the patient notified  |
| immediately via in-app notification.                        |
|                                                             |
| +-----------------------------+ +-------------------------+ |
| | [ Keep in Review ]          | | [ Confirm Rejection ]   | |
| +-----------------------------+ +-------------------------+ |
+-------------------------------------------------------------+
```

---

## 5. Screen States & Concurrency Handling
- **Real-Time Queue Invalidation:** When another staff member approves an appointment from another terminal, Socket.IO emits `appointment_status_changed`. The active row flashes yellow and updates to `Approved by Receptionist B` without a page refresh.
- **Empty State:** High-contrast illustration: *"Zero pending appointments. All incoming requests have been reviewed!"*.
- **Conflict Warning:** If a double-booking race condition somehow occurred, the conflict engine displays a red warning banner: `[!] CRITICAL OVERLAP: Dr. Reyes already has Confirmed Appointment #1041 at this time. Approval is blocked.`

---

## 6. Accessibility (WCAG 2.2 AA)
- Review drawer traps focus and provides keyboard shortcuts (Esc = Close, `Alt+A` = Approve, `Alt+R` = Reject).
- Rejection dialog requires explicit selection of a reason; error message announces via `aria-live="assertive"`.
- Action buttons meet AAA contrast standards: Teal `#0D9488` with white text (4.6:1), Dark Navy text on soft teal (13.8:1).
