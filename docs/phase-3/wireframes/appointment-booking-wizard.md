# ToothCare Hub Wireframe: Appointment Booking Wizard (6 Steps)

**Document ID:** `TCH-P3-WFR-004`  
**Screen ID:** `SCR-PAT-002`  
**Route:** `/patient/appointments/new`  
**Authorized Roles:** `PATIENT` (or `ADMIN` on behalf of patient)  

---

## 1. Screen Specification

### 1.1 Purpose
Guides the patient through a multi-step booking wizard to select a dental service, choose a dentist, pick an available date and time slot from a live 30-minute schedule grid, provide visit context, review clinic booking policies, and atomically request the appointment.

### 1.2 Multi-Step Progress Hierarchy
- **Step 1:** Dental Service Selection (Duration & Price)
- **Step 2:** Dentist Selection (Specialty & Schedule)
- **Step 3:** Date & 30-Minute Time Slot Picker
- **Step 4:** Patient Notes & Chief Complaint
- **Step 5:** Review Summary & Booking Policy Confirmation
- **Step 6:** Submission & Concurrency Resolution

---

## 2. Desktop Wireframe (Dual-Column Layout)

```
+-------------------------------------------------------------------------------+
| [Logo] ToothCare Hub                                              [Juan D. v] |
+-------------------------------------------------------------------------------+
| [<- Back to Dashboard]                                                        |
|                                                                               |
| Book an Appointment                                                           |
| Step [ 1. Service ] -> [ 2. Dentist ] -> (•) [ 3. Date & Time ] -> [ 4. Review]|
|-------------------------------------------------------------------------------|
|                                         |                                     |
| SELECT DATE & TIME SLOT                 | APPOINTMENT SUMMARY                 |
|                                         | +---------------------------------+ |
| Choose Date: [ November 2026      v ]   | | Service:                        | |
| < Mo  Tu  We  Th  Fr  Sa  Su >          | | Dental Prophylaxis (Cleaning)   | |
|   02 (03) 04  05  06  07  08            | | Duration: 45 minutes            | |
|   09  10  11  12  13  14  15            | | Fee: ₱1,500.00                  | |
|                                         | |                                 | |
| Selected: Tuesday, Nov 3, 2026          | | Dentist:                        | |
| Clinic Timezone: Asia/Manila (UTC+08:00)| | Dr. Maria Santos, DMD           | |
|                                         | | General & Cosmetic Dentistry    | |
| Available 30-Min Starting Slots:        | |                                 | |
| Morning (09:00 AM - 12:00 PM)           | | Date & Time:                    | |
| [ 09:00 AM ]  [● 09:30 AM ]  [ 10:30 AM]| | Tuesday, Nov 3, 2026            | |
| [ 11:15 AM ]  [ 11:45 AM ]              | | 09:30 AM - 10:15 AM             | |
|                                         | |                                 | |
| Afternoon (01:00 PM - 05:00 PM)         | | Total Estimated Cost:           | |
| [ 01:30 PM ]  [ 02:00 PM ]  [ 03:30 PM] | | ₱1,500.00 (Pay at clinic)       | |
| [ 04:00 PM ]                            | +---------------------------------+ |
|                                         |                                     |
| [ ] Unavailable slots are hidden        | Policy Notice:                      |
|                                         | • Requests are confirmed by clinic. |
|                                         | • Free cancellation up to 24h prior.|
|                                         |                                     |
| [ < Previous: Dentist ]                 | [ Continue to Patient Notes > ]     |
+-----------------------------------------+-------------------------------------+
```

---

## 3. Mobile Wireframe (Viewport 375px: Step 3 Slot Picker)

```
+-----------------------------------+
| [<-] Step 3 of 5: Date & Time     |
+-----------------------------------+
| [======       ] 60% complete      |
|                                   |
| Select Appointment Date           |
| [ 📅 Tuesday, Nov 3, 2026       v ]|
|                                   |
| Dentist: Dr. Maria Santos         |
| Service: Dental Cleaning (45m)    |
|                                   |
| Available Starting Times:         |
| Morning Slots                     |
| +-----------+ +-----------+       |
| |  09:00 AM | |● 09:30 AM |       | (Selected Teal - 48px height)
| +-----------+ +-----------+       |
| +-----------+ +-----------+       |
| |  10:30 AM | |  11:15 AM |       |
| +-----------+ +-----------+       |
|                                   |
| Afternoon Slots                   |
| +-----------+ +-----------+       |
| |  01:30 PM | |  02:00 PM |       |
| +-----------+ +-----------+       |
| +-----------+ +-----------+       |
| |  03:30 PM | |  04:00 PM |       |
| +-----------+ +-----------+       |
|                                   |
| 🕒 All times in Asia/Manila       |
|                                   |
| +-------------------------------+ |
| | [ Next: Patient Notes -> ]    | | (Sticky bottom bar)
| +-------------------------------+ |
+-----------------------------------+
```

---

## 4. Step 5 & 6: Review, Submission & Conflict Handling

### 4.1 Step 5: Review & Agreement Screen
```
+-------------------------------------------------------------------------------+
| Review Your Booking Details                                                   |
| Please double-check your appointment request before submitting to reception.  |
|                                                                               |
| +---------------------------------------------------------------------------+ |
| | PATIENT: Juan Dela Cruz (+63 917 123 4567 • juan.delacruz@email.ph)       | |
| | DENTIST: Dr. Maria Santos, DMD (General & Preventive Dentistry)           | |
| | SERVICE: Dental Prophylaxis (Cleaning) • Est. Duration: 45 minutes        | |
| | SCHEDULE: Tuesday, November 3, 2026 at 09:30 AM – 10:15 AM (Asia/Manila) | |
| | CHIEF COMPLAINT: "Routine cleaning, slight sensitivity on lower molars"   | |
| | ESTIMATED FEE: ₱1,500.00 (No advance payment required; pay at clinic)     | |
| +---------------------------------------------------------------------------+ |
|                                                                               |
| [x] I understand this request is subject to clinic approval.                  |
| [x] I agree that cancellations must be made at least 24 hours in advance.     |
|                                                                               |
| [ < Back: Edit Details ]            [ Submit Appointment Request (Primary) ]  |
+-------------------------------------------------------------------------------+
```

### 4.2 Step 6: 409 Conflict Modal (Slot Collision Recovery)
When another user books the slot between fetch and submit:
```
+-------------------------------------------------------------+
| [!] Selected Time Slot Is No Longer Available               |
+-------------------------------------------------------------+
| Another patient just completed booking 09:30 AM on Nov 3.   |
| To ensure scheduling integrity, please pick an alternative. |
|                                                             |
| Recommended Alternative Slots for Dr. Santos on Nov 3:      |
| [ (•) 10:30 AM ]    [ ( ) 11:15 AM ]    [ ( ) 01:30 PM ]    |
|                                                             |
| +-----------------------------+ +-------------------------+ |
| | [ Choose Highlighted Slot ] | | [ Pick Different Date ] | |
| +-----------------------------+ +-------------------------+ |
+-------------------------------------------------------------+
```

---

## 5. Screen States & Validation Rules

| State | Visual Behavior | Interactive Behavior |
| :--- | :--- | :--- |
| **Loading Slots** | Shimmer skeleton cards on time grid | Slot buttons disabled; message *"Checking live clinic schedule..."* |
| **No Slots Available** | Calendar icon with text *"No slots open on this date"* | Button: `[ View Next Available Date (Nov 5) ]` |
| **Submitting** | Submit button shows spinner + text *"Reserving slot..."* | Form inputs locked; navigation blocked to avoid duplicate POST |
| **Confirmed Success** | Checkmark animation + reference `#APP-1042` | Primary button: `[ View My Appointments ]` |

---

## 6. Accessibility (WCAG 2.2 AA)
- Stepper header announces current step via `aria-current="step"`.
- Time slots operate as an accessible radio group (`role="radiogroup"` with `aria-label="Available appointment starting times"`).
- Keyboard arrows navigate smoothly through slot options; Space/Enter selects slot.
- Slot buttons include explicit screen reader text (e.g., `aria-label="09:30 AM, 45 minutes duration, Dr. Maria Santos"`).
