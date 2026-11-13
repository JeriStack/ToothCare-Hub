# ToothCare Hub Wireframe: Dentist Management Directory (Admin)

**Document ID:** `TCH-P3-WFR-008`  
**Screen ID:** `SCR-ADM-003`  
**Route:** `/admin/dentists`  
**Authorized Roles:** `ADMIN`  

---

## 1. Screen Specification

### 1.1 Purpose
Allows clinic administrators to manage licensed dental practitioners, their clinical specialties, contact details, active practice status, assigned operatory chairs, and authorized dental procedures.

### 1.2 Layout & Hierarchy
- **Desktop:** Administrative shell, top action bar with `[ + Add New Dentist ]`, filterable practitioner roster (card grid or table view), and detailed practitioner profile drawer.
- **Mobile:** Single-column practitioner cards with quick status toggle and schedule overview button.

---

## 2. Desktop Wireframe

```
+-------------------------------------------------------------------------------+
| [Logo] ToothCare Hub Admin         [Search clinic records...]  [🔔 4] [Admin v]|
+-------------------------------------------------------------------------------+
| [Sidebar]     | Dentist Roster & Profiles (6 Licensed Practitioners)          |
| ( ) Dashboard | Status Filter: [ All Dentists (6) ] [ Active (5) ] [ On Leave (1) ]|
| ( ) Appts     | Search: [ 🔍 Filter by name or specialty...                 ] |
| ( ) Patients  | Action: [ + Add New Dentist (Teal) ]                          |
| (•) Dentists  |---------------------------------------------------------------|
| ( ) Services  | +-----------------------------------------------------------+ |
| ( ) Schedules | | Photo  Dentist Name       Specialty     License Status Action|
| ( ) Reports   | |-----------------------------------------------------------| |
|               | | [🧑‍⚕️] Dr. Maria Santos    General & Cos #008472 Active [Edit]|
|               | | [👨‍⚕️] Dr. Roberto Reyes   Orthodontics  #009124 Active [Edit]|
|               | | [👩‍⚕️] Dr. Carmela Lim     Endodontics   #007812 Active [Edit]|
|               | | [👨‍⚕️] Dr. Arthur Pangan   Oral Surgery  #006541 Leave  [Edit]|
|               | +-----------------------------------------------------------+ |
|               |                                                               |
|               | +-----------------------------------------------------------+ |
|               | | Profile Drawer: Dr. Maria Santos, DMD                 [X] | |
|               | |-----------------------------------------------------------| |
|               | | License: PRC #008472 (Valid until 2028-11-30)             | |
|               | | Specialty: General Dentistry, Cosmetic & Veneers          | |
|               | | Contact: dr.santos@toothcare.ph • (02) 8123-4568          | |
|               | | Assigned Chair: Operatory Chair 1                         | |
|               | | Weekly Shifts: Monday, Tuesday, Thursday, Friday (9am-5pm)| |
|               | |                                                           | |
|               | | Authorized Services (8 services):                         | |
|               | | [✓ Cleaning] [✓ Composite Filling] [✓ Teeth Whitening]     | |
|               | | [✓ Simple Extraction] [✓ Dental Crown Evaluation]         | |
|               | |                                                           | |
|               | | Actions: [ Edit Shifts ]  [ Deactivate Practitioner ]     | |
|               | +-----------------------------------------------------------+ |
+---------------+---------------------------------------------------------------+
```

---

## 3. Mobile Wireframe (Viewport 375px)

```
+-----------------------------------+
| [=] Dentists (6)           [🔔 4] |
+-----------------------------------+
| [ + Add New Dentist (Teal) ]      |
|                                   |
| +-------------------------------+ |
| | [🧑‍⚕️] Dr. Maria Santos, DMD    | |
| | Specialty: General & Cosmetic | |
| | License: PRC #008472          | |
| | Status: [● Active (Teal)]     | |
| | Shifts: Mon, Tue, Thu, Fri    | |
| |                               | |
| | [ Manage Shifts ]  [ Edit ]   | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | [👨‍⚕️] Dr. Arthur Pangan, DMD   | |
| | Specialty: Oral Surgery       | |
| | License: PRC #006541          | |
| | Status: [● On Leave (Amber)]  | |
| | [ View Leave Dates ] [ Edit ] | |
| +-------------------------------+ |
+-----------------------------------+
```

---

## 4. Add / Edit Dentist Modal Wireframe

```
+-------------------------------------------------------------+
| Add Licensed Dentist to Clinic                        [ X ] |
+-------------------------------------------------------------+
| First Name *                  Last Name *                   |
| [ Maria                     ] [ Santos                    ] |
|                                                             |
| Professional Title *          PRC Dental License Number *   |
| [ DMD                       ] [ 008472                    ] |
|                                                             |
| Clinical Email *              Phone Number *                |
| [ dr.santos@toothcare.ph    ] [ +63 917 555 1234          ] |
|                                                             |
| Primary Specialty *           Default Operatory Chair       |
| [ General Dentistry       v ] [ Operatory Chair 1         v ]|
|                                                             |
| Active Status *                                             |
| (•) Active (Eligible for bookings)   ( ) Inactive / On Leave|
|                                                             |
| Authorized Services:                                        |
| [x] Dental Prophylaxis (Cleaning)    [x] Tooth Filling      |
| [x] Teeth Whitening                  [ ] Surgical Extraction|
|                                                             |
| +-----------------------------+ +-------------------------+ |
| | [ Cancel ]                  | | [ Save Dentist Profile] | |
| +-----------------------------+ +-------------------------+ |
+-------------------------------------------------------------+
```

---

## 5. Screen States & Business Rules
- **Deactivation Protection:** If an admin attempts to deactivate a dentist who has upcoming `CONFIRMED` appointments, the system displays an alert modal: *"Dr. Santos has 5 confirmed appointments. Please reassign these appointments before deactivating."*
- **Audit Logging:** Any update to dentist credentials or license status is recorded in `audit_logs` with the admin's user ID and timestamp.

---

## 6. Accessibility (WCAG 2.2 AA)
- Status toggles use standard checkbox or radio patterns with visible labels (never color-only dots).
- Modal handles focus trapping and returns focus to the `[+ Add Dentist]` button upon dismissal.
