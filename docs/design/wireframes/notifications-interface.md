# ToothCare Hub Wireframe: Centralized Notifications Interface

**Document ID:** `TCH-P3-WFR-0015`  
**Screen ID:** `SCR-NOTIF-001`  
**Route:** Notification Drawer (Global) & Dedicated Route `/notifications`  
**Authorized Roles:** All Roles (`PATIENT`, `DENTIST`, `ADMIN`)  

---

## 1. Screen Specification

### 1.1 Purpose
Provides all system actors with an accessible, real-time notification center. Informs patients of appointment approval, rejection, or reminders; alerts dentists of new appointments or schedule changes; notifies administrators of incoming requests and cancellations. Supports mark-as-read, unread filtering, and direct deep-linking to referenced appointments.

### 1.2 Layout & Hierarchy
- **Desktop:** Slide-over notification panel (`400px` wide) triggered by clicking the top navigation bell `[🔔 3]`, plus dedicated full-page view at `/patient/notifications`, `/admin/notifications`, or `/dentist/notifications`.
- **Mobile:** Full-bleed slide-down or overlay drawer with sticky header actions `[ Mark All as Read ]`.

---

## 2. Desktop Wireframe (Slide-Over Drawer)

```
+-------------------------------------------------------------------------------+
| [Logo] ToothCare Hub                               [Search...] [🔔 3] [User v]|
+-------------------------------------------------------------------------------+
|                                            | NOTIFICATION CENTER          [X] |
|                                            |----------------------------------|
|                                            | Filter: [ (•) All ] [ Unread (3)]|
|                                            | [ ✓ Mark all as read ]           |
|                                            |----------------------------------|
|                                            | TODAY                            |
|                                            | +------------------------------+ |
|                                            | | [● Unread (Teal Dot)]        | |
|                                            | | Appointment Confirmed!       | |
|                                            | | 📅 Your Dental Cleaning on   | |
|                                            | |    Nov 3 at 09:30 AM is now  | |
|                                            | |    approved by reception.    | |
|                                            | | 12 mins ago • [View Details >]| |
|                                            | +------------------------------+ |
|                                            | +------------------------------+ |
|                                            | | [● Unread (Teal Dot)]        | |
|                                            | | Schedule Reminder            | |
|                                            | | 🕒 Visit with Dr. Santos in  | |
|                                            | |    6 days (Operatory Chair 1)| |
|                                            | | 2 hours ago • [View Details >]| |
|                                            | +------------------------------+ |
|                                            |                                  |
|                                            | YESTERDAY                        |
|                                            | +------------------------------+ |
|                                            | | [○ Read]                     | |
|                                            | | Request Submitted            | |
|                                            | | 📋 Your booking request #1042| |
|                                            | |    is pending clinic review. | |
|                                            | | Yesterday 10:14 PM           | |
|                                            | +------------------------------+ |
|                                            |                                  |
|                                            | [ View All Notification History ]|
+--------------------------------------------+----------------------------------+
```

---

## 3. Mobile Wireframe (Viewport 375px)

```
+-----------------------------------+
| [<-] Notifications (3)     [✓ All]|
+-----------------------------------+
| Filter: [ (•) Unread (3) ] [ All ]|
|                                   |
| +-------------------------------+ |
| | [●] APPOINTMENT CONFIRMED     | |
| | Your visit on Nov 3, 09:30 AM | |
| | has been confirmed by clinic. | |
| | 12m ago • Ref #APP-1042       | |
| | [ Open Appointment Card > ]   | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | [●] UPCOMING REMINDER         | |
| | Dental Cleaning in 6 days     | |
| | 2h ago                        | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | [○] Welcome to ToothCare Hub! | |
| | Account verified successfully | |
| | Oct 26                        | |
| +-------------------------------+ |
+-----------------------------------+
```

---

## 4. UI Elements & State Specifications

### 4.1 Loading State
- Drawer renders skeleton shimmers for notification titles, timestamps, and icons.

### 4.2 Empty State (No Notifications)
- Center bell illustration with soft teal accent:
  - Header: *"You're completely caught up!"*
  - Body: *"New appointment updates, confirmations, and reminders will appear here."*

### 4.3 Offline / Reconnection Banner
- If browser drops connection to the Socket.IO server:
  - Sticky sub-banner in drawer:  
    `[!] Real-time sync paused. Reconnecting to clinic server...`
  - Reconnection triggers automatic REST delta synchronization (`GET /api/notifications?since=...`).

---

## 5. Accessibility (WCAG 2.2 AA)
- Trigger bell icon has dynamic accessible name: `aria-label="Notifications, 3 unread updates"`.
- Real-time incoming notifications announce via `aria-live="polite"` landmark.
- Unread indicator uses dual visual design: teal circle icon `[●]` plus explicit text tag `[Unread]`.
- Pressing Escape closes drawer and restores focus to the bell button.
