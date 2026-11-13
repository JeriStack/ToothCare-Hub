# ToothCare Hub Wireframe: Patient Management Directory (Admin)

**Document ID:** `TCH-P3-WFR-007`  
**Screen ID:** `SCR-ADM-002`  
**Route:** `/admin/patients`  
**Authorized Roles:** `ADMIN`  

---

## 1. Screen Specification

### 1.1 Purpose
Enables clinic receptionists and administrators to maintain the master patient directory. Allows searching by patient name, phone number, or email, viewing comprehensive patient demographics, past and upcoming visit history, contact information, and registering new walk-in patients.

### 1.2 Layout & Hierarchy
- **Desktop:** Administrative application shell, top search and filter toolbar, primary action `[ + Register Patient ]`, sortable paginated data table, and right-side detail drawer.
- **Mobile:** Search bar with sticky quick-add button, collapsible patient cards with direct phone dial action.

---

## 2. Desktop Wireframe

```
+-------------------------------------------------------------------------------+
| [Logo] ToothCare Hub Admin         [Search clinic records...]  [🔔 4] [Admin v]|
+-------------------------------------------------------------------------------+
| [Sidebar]     | Patient Directory (1,248 Registered Patients)                 |
| ( ) Dashboard | Search: [ 🔍 Filter by name, phone, or email...            ]  |
| ( ) Appts     | Filter by: [ All Patients v ] [ Has Upcoming Visit v ]        |
| (•) Patients  | Primary Action: [ + Register Walk-In Patient ]  [ Export CSV ]|
| ( ) Dentists  |---------------------------------------------------------------|
| ( ) Services  | +-----------------------------------------------------------+ |
| ( ) Schedules | | ID    Patient Name   Phone        DOB (Age)  Visits Last  Actions|
| ( ) Reports   | |-----------------------------------------------------------| |
|               | | #101  Juan Dela Cruz 0917-1234567 1994 (32)    4    Nov 3 [...] |
|               | | #102  Maria Garcia   0918-9876543 1988 (38)    2    Oct 1 [...] |
|               | | #103  Pedro Santos   0922-5551234 2001 (25)    7    Sep 1 [...] |
|               | | #104  Elena Gomez    0919-4443322 1996 (30)    1    Nov 3 [...] |
|               | +-----------------------------------------------------------+ |
|               | Showing 1 - 10 of 1,248 patients       [ < Prev ] [ 1 ] 2 3 [ Next > ]|
|               |                                                               |
|               | +-----------------------------------------------------------+ |
|               | | Detail Drawer: Juan Dela Cruz (#101)                  [X] | |
|               | |-----------------------------------------------------------| |
|               | | Demographics: DOB: May 18, 1994 (32y) • Male              | |
|               | | Contact: juan.delacruz@email.ph • +63 917 123 4567        | |
|               | | Address: 124 Ayala Ave, Makati City, Metro Manila         | |
|               | | Emergency Contact: Elena Dela Cruz (Wife) - 0917-7654321  | |
|               | |                                                           | |
|               | | Visit History (4 Total):                                  | |
|               | | • Nov 3, 2026 - Cleaning (Dr. Santos) [CONFIRMED]         | |
|               | | • Oct 12, 2026 - Composite Filling (Dr. Santos) [COMPLETED]| |
|               | |                                                           | |
|               | | Actions: [ Book Appointment ]  [ Edit Profile ]           | |
|               | +-----------------------------------------------------------+ |
+---------------+---------------------------------------------------------------+
```

---

## 3. Mobile Wireframe (Viewport 375px)

```
+-----------------------------------+
| [=] Patients (1,248)       [🔔 4] |
+-----------------------------------+
| [ 🔍 Search name or mobile...   ] |
|                                   |
| [ + Register New Patient (Teal) ] |
|                                   |
| +-------------------------------+ |
| | Juan Dela Cruz (#101)         | |
| | 📞 0917-1234567  [ 📲 Call ]   | |
| | ✉️ juan.delacruz@email.ph      | |
| | Age: 32 • Visits: 4           | |
| | Next: Nov 3 (Dr. Santos)      | |
| | [ View Patient Record > ]     | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | Maria Garcia (#102)           | |
| | 📞 0918-9876543  [ 📲 Call ]   | |
| | Age: 38 • Visits: 2           | |
| | Status: Pending Request (#1049)| |
| | [ View Patient Record > ]     | |
| +-------------------------------+ |
|                                   |
| Page 1 of 125     [ < ]  [ > ]    |
+-----------------------------------+
```

---

## 4. Register Walk-In Patient Modal Wireframe

```
+-------------------------------------------------------------+
| Register Walk-In Patient                              [ X ] |
+-------------------------------------------------------------+
| First Name *                  Last Name *                   |
| [ Juan                      ] [ Dela Cruz                 ] |
|                                                             |
| Mobile Number * (PH format)   Email (Optional for Walk-In)  |
| [ 0917-123-4567             ] [ juan.walkin@email.ph      ] |
|                                                             |
| Date of Birth *               Gender                        |
| [ 1994-05-18              📅] [ Male                      v ]|
|                                                             |
| Emergency Contact Name        Emergency Contact Phone       |
| [ Elena Dela Cruz           ] [ 0917-765-4321             ] |
|                                                             |
| Medical Alerts (Allergies / Conditions):                    |
| [ Penicillin allergy, mild hypertension                   ] |
|                                                             |
| +-----------------------------+ +-------------------------+ |
| | [ Cancel ]                  | | [ Save & Book Visit ]   | |
| +-----------------------------+ +-------------------------+ |
+-------------------------------------------------------------+
```

---

## 5. Screen States & Validation
- **Search Debounce:** Search input debounces at 300ms before sending query to `GET /api/admin/patients?search=...`.
- **Empty Search Result:** Displays: *"No patients found matching 'XYZ'. [Clear filters] or [Register XYZ as new patient]"*.
- **Data Protection:** Medical alerts highlighted in red tag; phone numbers masked for non-receptionist roles if required by clinic privacy guidelines.

---

## 6. Accessibility (WCAG 2.2 AA)
- Data table utilizes semantic `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`.
- Row action menus (`[...]`) announce context: `aria-label="Actions for patient Juan Dela Cruz"`.
- Mobile phone call links formatted as accessible `<a href="tel:09171234567">` with min 44x44px touch targets.
