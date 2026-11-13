# ToothCare Hub Wireframe: Patient Portal Dashboard

**Document ID:** `TCH-P3-WFR-003`  
**Screen ID:** `SCR-PAT-001`  
**Route:** `/patient/dashboard`  
**Authorized Roles:** `PATIENT`  

---

## 1. Screen Specification

### 1.1 Purpose
Serves as the personalized home hub for dental patients. Displays upcoming confirmed and pending appointments, rapid action to book a new appointment, recent visit history, and contextual alerts or notifications.

### 1.2 Layout & Hierarchy
- **Desktop:** Full application shell with top bar (logo, search, notification bell with unread badge, user profile menu), left navigation sidebar, and main grid layout:
  - Hero banner with friendly greeting and next upcoming appointment card.
  - Quick action toolbar (`Book Appointment`, `View History`, `Update Profile`).
  - Active appointment cards list (with status badge, dentist name, date/time, cancel/reschedule actions).
  - Clinic operational hours and emergency contact card.
- **Mobile:** Top header with hamburger drawer button, greeting banner, prominent primary CTA *"Book Appointment"*, followed by stacked appointment cards.

---

## 2. Desktop Wireframe

```
+-------------------------------------------------------------------------------+
| [Logo] ToothCare Hub           [Search appointments...]   [🔔 2] [Juan D. v] |
+-------------------------------------------------------------------------------+
| [Sidebar]          | Dashboard Overview                                       |
|                    | Good morning, Juan! Welcome to your dental care portal.   |
| (•) Dashboard      |---------------------------------------------------------|
| ( ) Book Appt      | +-----------------------------------------------------+ |
| ( ) My Appts (2)   | | NEXT SCHEDULED VISIT                                | |
| ( ) Past History   | | Dental Prophylaxis (Cleaning)                       | |
| ( ) Profile        | | 📅 Tuesday, Nov 3, 2026 • 09:30 AM (Asia/Manila)     | |
|                    | | 👨‍⚕️ Dr. Maria Santos, DMD • Clinic Chair 2           | |
| ------------------ | | Status: [CONFIRMED (Teal)]                          | |
| [Log Out]          | |                                                     | |
|                    | | [ View Details ]     [ Reschedule ]   [ Cancel Appt]| |
|                    | +-----------------------------------------------------+ |
|                    |                                                         |
|                    | Quick Actions                                           |
|                    | +------------------+ +------------------+ +-----------+ |
|                    | | [+] Book New     | | [📋] View Visit  | | [💬] Call | |
|                    | |     Appointment  | |      History     | |    Clinic | |
|                    | +------------------+ +------------------+ +-----------+ |
|                    |                                                         |
|                    | Your Active Requests & Appointments                     |
|                    | +-----------------------------------------------------+ |
|                    | | ID     Service         Dentist       Date & Time  Status|
|                    | |-----------------------------------------------------| |
|                    | | #1042  Cleaning        Dr. Santos    Nov 3, 09:30 [CONF]|
|                    | | #1049  Fluoride Trt    Dr. Reyes     Nov 17, 14:00[PEND]|
|                    | +-----------------------------------------------------+ |
+--------------------+---------------------------------------------------------+
```

---

## 3. Mobile Wireframe (Viewport 375px)

```
+-----------------------------------+
| [=] ToothCare Hub          [🔔 2] |
+-----------------------------------+
| Welcome back, Juan!               |
|                                   |
| +-------------------------------+ |
| | NEXT VISIT                    | |
| | Dental Prophylaxis            | |
| | 📅 Nov 3, 2026 • 09:30 AM     | |
| | 👨‍⚕️ Dr. Maria Santos          | |
| | Status: [● Confirmed]         | |
| |                               | |
| | [ View Details ]              | |
| | [ Reschedule ]  [ Cancel ]    | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| |   [+ Book New Appointment]    | | (Primary Teal Button - 48px height)
| +-------------------------------+ |
|                                   |
| Pending Requests (1)              |
| +-------------------------------+ |
| | Fluoride Treatment            | |
| | 📅 Nov 17, 2026 • 02:00 PM    | |
| | 👨‍⚕️ Dr. Reyes                 | |
| | Status: [⏳ Pending Approval] | |
| | [Cancel Request]              | |
| +-------------------------------+ |
|                                   |
| Need Emergency Assistance?        |
| Call Reception: (02) 8123-4567    |
+-----------------------------------+
```

---

## 4. UI Elements & State Specifications

### 4.1 Loading State
- Card skeletons render with subtle pulsing gradient across metrics and appointment slots.
- Sidebar links disabled during initial session hydration.

### 4.2 Empty State (No Upcoming Appointments)
- Center container displays friendly dental illustration:
  - Header: *"No upcoming visits scheduled"*.
  - Body: *"Keep your smile healthy with routine dental checkups every 6 months."*.
  - Primary Action: `[ Book Your Next Visit ]`.

### 4.3 Error State (Network Disconnected)
- Top banner alert with amber background:
  `[!] Unable to synchronize live appointments. Showing cached data from 10 minutes ago. [Retry]`

---

## 5. Accessibility (WCAG 2.2 AA)
- Status badges use dual indicators: Icon + Text (e.g., `[✓ Confirmed]` vs. `[⏳ Pending]`).
- Next visit card is marked as a landmark region (`<section aria-labelledby="next-visit-heading">`).
- All buttons have min 44x44px touch bounding boxes on mobile screens.
