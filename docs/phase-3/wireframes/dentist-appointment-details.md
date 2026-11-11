# ToothCare Hub Wireframe: Dentist Assigned Appointment Details

**Document ID:** `TCH-P3-WFR-0013`  
**Screen ID:** `SCR-DEN-002`  
**Route:** `/dentist/appointments/:id`  
**Authorized Roles:** `DENTIST` (assigned practitioner only)  

---

## 1. Screen Specification

### 1.1 Purpose
Enables an attending dentist to review the specific clinical and personal context of a patient scheduled for their appointment. Displays permitted patient information (name, age, emergency contact, verified allergies, previous clinic visit notes) without granting unauthorized access to the wider clinic patient registry.

### 1.2 Layout & Hierarchy
- **Desktop:** Dentist portal shell, back button to `/dentist/dashboard`, patient clinical banner with red allergy alert, two-column split view (Left: Appointment metadata & Chief complaint; Right: Longitudinal past visit history & prior treatments).
- **Mobile:** Single-column layout with collapsible accordion sections for Past Visits and Medical Alerts.

---

## 2. Desktop Wireframe

```
+-------------------------------------------------------------------------------+
| [Logo] ToothCare Hub Doctor Portal [Today: Nov 3, 2026] [🔔 1] [Dr. Santos v] |
+-------------------------------------------------------------------------------+
| [<- Back to Today's Agenda]                                                   |
|                                                                               |
| APPOINTMENT CLINICAL CONTEXT — REF #1042                                      |
| +---------------------------------------------------------------------------+ |
| | Patient: Elena Gomez (#104) • Female, 30y (DOB: 1996-04-12)               | |
| | Phone: 0919-444-3322 • Emergency Contact: Carlos Gomez (Brother) 0919-111 | |
| | [⚠️ CRITICAL MEDICAL ALERT: PENICILLIN ALLERGY • NO PENICILLIN / AMOXICILLIN] |
| +---------------------------------------------------------------------------+ |
|                                                                               |
| CURRENT APPOINTMENT                   | PATIENT TREATMENT HISTORY             |
| +-----------------------------------+ | +-----------------------------------+ |
| | Scheduled Time:                   | | | Oct 12, 2026 - ToothCare Hub      | |
| | Tuesday, Nov 3 • 09:30 - 10:15 AM | | | Dentist: Dr. Maria Santos         | |
| | Clinic Chair: Operatory Chair 1   | | | Procedure: Oral Prophylaxis       | |
| |                                   | | | Notes: "Mild gingivitis on lower  | |
| | Service Booked:                   | | | incisors. Advised flossing."      | |
| | Composite Tooth Filling (45 mins) | | |-----------------------------------| |
| |                                   | | | May 14, 2026 - ToothCare Hub      | |
| | Patient's Chief Complaint:        | | | Dentist: Dr. Roberto Reyes        | |
| | "Sharp sensitivity to cold water  | | | Procedure: Consultation & X-Ray   | |
| | and sweet food on tooth #14."     | | | Notes: "Incipient caries #14."    | |
| |                                   | | +-----------------------------------+ |
| | Status: [● IN CHAIR]              | |                                       |
| |                                   | | Clinical Action:                      | |
| | [ Proceed to Treatment Record > ] | | [ Print Clinical Summary ]            | |
| +-----------------------------------+ | +-----------------------------------+ |
+-------------------------------------------------------------------------------+
```

---

## 3. Mobile Wireframe (Viewport 375px)

```
+-----------------------------------+
| [<-] Patient Context: Elena Gomez |
+-----------------------------------+
| Elena Gomez (30y • Female)        |
| Ref: #1042 • 09:30 AM Today       |
|                                   |
| [!] ALLERGY: PENICILLIN (Red)     |
|                                   |
| Scheduled Procedure:              |
| Tooth Filling (Composite)         |
|                                   |
| Chief Complaint:                  |
| "Sharp pain on tooth #14 with cold|
| liquids and sweet foods."         |
|                                   |
| Past Clinic Visits:               |
| +-------------------------------+ |
| | [v] Oct 12, 2026 (Cleaning)   | |
| | Dr. Santos • Prophylaxis      | |
| +-------------------------------+ |
| +-------------------------------+ |
| | [>] May 14, 2026 (Consult)    | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | [ Enter Clinical Notes (Teal) ] | (Min 50px touch height)
| +-------------------------------+ |
+-----------------------------------+
```

---

## 4. UI Elements & Form Requirements

| Element | Type | Purpose | Behavior |
| :--- | :--- | :--- | :--- |
| **Medical Alert Card** | Accessible Banner | Flags life-threatening drug allergies | Red border, bold typography, cannot be dismissed |
| **Past Visit Accordion** | Interactive Disclosure | Displays previous treatment summaries | Expand/collapse with `aria-expanded="true/false"` |
| **Proceed to Treatment** | Primary CTA (Teal) | Transitions to clinical recording | Navigates to `/dentist/treatments/new?appointment_id=1042` |

---

## 5. Security & Privacy Guardrails
- **RBAC Boundary:** A dentist attempting to open `/dentist/appointments/:id` for an appointment assigned to another practitioner is met with HTTP `403 Forbidden` and routed back to their own dashboard.
- **Audit Logging:** Every view of patient medical notes is logged: `AUTH_VIEW_PATIENT_RECORD` with timestamp and IP address.

---

## 6. Accessibility (WCAG 2.2 AA)
- Accordion headers use standard `<button aria-controls="section-id" aria-expanded="...">`.
- Critical medical alert container has `role="alert"` and persistent accessible text.
- Keyboard navigation: Tab keys seamlessly through back button, alerts, history accordions, and primary action.
