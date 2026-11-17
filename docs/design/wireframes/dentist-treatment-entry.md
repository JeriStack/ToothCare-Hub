# ToothCare Hub Wireframe: Clinical Treatment Record Entry

**Document ID:** `TCH-P3-WFR-0014`  
**Screen ID:** `SCR-DEN-003`  
**Route:** `/dentist/treatments/new` & `/dentist/treatments/:id`  
**Authorized Roles:** `DENTIST` (assigned practitioner only)  

---

## 1. Screen Specification

### 1.1 Purpose
Provides attending dentists with a standardized clinical documentation form to record procedures performed, diagnosis, teeth numbers treated, prescriptions, and home care advice. Submitting this record transitions the appointment to `COMPLETED` and initiates the 24-hour clinical modification audit window.

### 1.2 Layout & Hierarchy
- **Desktop:** Dentist clinical shell with patient context header, FDI 2-digit dental notation tooth selection grid (teeth 11–48), clinical diagnosis textarea, procedure notes textarea, prescriptions/recommendations, and completion footer.
- **Mobile / Tablet:** Chairside tablet-friendly touch grid for teeth numbers, expandable textareas with voice-to-text browser support, and prominent finalization button.

---

## 2. Desktop Wireframe

```
+-------------------------------------------------------------------------------+
| [Logo] ToothCare Hub Doctor Portal [Today: Nov 3, 2026] [🔔 1] [Dr. Santos v] |
+-------------------------------------------------------------------------------+
| [<- Cancel & Return to Agenda]                                                |
|                                                                               |
| CLINICAL TREATMENT RECORD — APPOINTMENT #1042                                 |
| Patient: Elena Gomez (#104) • Date: Nov 3, 2026 • Operatory Chair 1           |
| Alert: [⚠️ Penicillin Allergy (Red)] • Booked: Composite Tooth Filling        |
|-------------------------------------------------------------------------------|
| 1. TEETH NUMBERS TREATED (Select FDI Two-Digit Notation):                     |
| Upper Right (18-11)          | Upper Left (21-28)                             |
| [18] [17] [16] [15] [●14] [13] [12] [11] | [21] [22] [23] [24] [25] [26] [27] [28]|
| -----------------------------------------+----------------------------------- |
| Lower Right (48-41)          | Lower Left (31-38)                             |
| [48] [47] [46] [●45] [44] [43] [42] [41] | [31] [32] [33] [34] [35] [36] [37] [38]|
| Selected Teeth: Tooth #14 (Maxillary 1st Premolar), Tooth #45 (Mandibular 2nd)|
|                                                                               |
| 2. CLINICAL DIAGNOSIS & FINDINGS *                                            |
| +---------------------------------------------------------------------------+ |
| | Moderate occlusal dentin caries on #14 and #45. Pulp vitality confirmed    | |
| | normal with cold test. No periapical pathology noted on bite-wing.        | |
| +---------------------------------------------------------------------------+ |
| (Min 10 characters • 154 / 1,000 characters)                                  |
|                                                                               |
| 3. PROCEDURES PERFORMED & MATERIALS USED *                                    |
| +---------------------------------------------------------------------------+ |
| | Administered 1 carpule 2% Mepivacaine (non-epinephrine). Caries excavation | |
| | completed on #14 and #45. Etch, bond, and shade A2 nanohybrid composite   | |
| | restored. High-speed finishing and occlusion adjusted with articulating.  | |
| +---------------------------------------------------------------------------+ |
|                                                                               |
| 4. PRESCRIPTIONS & POST-TREATMENT ADVICE                                      |
| +---------------------------------------------------------------------------+ |
| | Paracetamol 500mg tab PRN for pain (Every 6h, max 3 doses).               | |
| | Avoid hard/sticky foods on right side for 24h. Return if sensitivity persists|
| +---------------------------------------------------------------------------+ |
|                                                                               |
| Policy Notice: You may edit this clinical record for up to 24 hours after     |
| completion. After 24 hours, this record will be permanently locked for audit. |
|                                                                               |
| [ Save Draft ]                    [ Complete Visit & Finalize Record (Teal) ] |
+-------------------------------------------------------------------------------+
```

---

## 3. Mobile / Tablet Wireframe (Viewport 375px)

```
+-----------------------------------+
| [<-] Treatment: Elena Gomez (#104)|
+-----------------------------------+
| Scheduled: Nov 3 • Chair 1        |
| [!] Allergy: Penicillin (Red)     |
|                                   |
| Select Teeth Treated:             |
| Upper Teeth:                      |
| [18] [17] [16] [15] [●14] [13] ...|
| Lower Teeth:                      |
| [48] [47] [46] [●45] [44] [43] ...|
| Selected: #14, #45                |
|                                   |
| Diagnosis *                       |
| +-------------------------------+ |
| | Moderate occlusal caries #14  | |
| | and #45. Normal pulp.         | |
| +-------------------------------+ |
|                                   |
| Procedure & Materials *           |
| +-------------------------------+ |
| | 2% Mepivacaine local. Caries  | |
| | excavated, A2 composite placed| |
| +-------------------------------+ |
|                                   |
| Home Care & Prescription:         |
| +-------------------------------+ |
| | Paracetamol 500mg PRN.        | |
| | Avoid chewing on right side.  | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | [ Complete & Finalize Record ]| | (Primary Teal - 50px height)
| +-------------------------------+ |
+-----------------------------------+
```

---

## 4. Finalization Confirmation Dialog Wireframe

```
+-------------------------------------------------------------+
| Finalize Treatment & Complete Visit                   [ X ] |
+-------------------------------------------------------------+
| Are you sure you want to mark Appointment #1042 as COMPLETED?|
|                                                             |
| Summary:                                                    |
| • Patient: Elena Gomez                                      |
| • Teeth Treated: #14, #45                                   |
| • Procedure: Composite Restorations                         |
|                                                             |
| Clinical Audit Notice:                                      |
| As the authoring practitioner, you have 24 hours to modify  |
| or amend these notes. After 24 hours, the record is locked  |
| into the patient's permanent medical archive.               |
|                                                             |
| +-----------------------------+ +-------------------------+ |
| | [ Keep Editing ]            | | [ Confirm & Complete ]  | |
| +-----------------------------+ +-------------------------+ |
+-------------------------------------------------------------+
```

---

## 5. UI Elements & Form Requirements

| Field / Element | Type | Validation Rules | Error Message Display |
| :--- | :--- | :--- | :--- |
| **Teeth Selection Grid** | Multiselect Pill Grid | Optional (required if restorative/surgery) | N/A |
| **Clinical Diagnosis** | Textarea (`rows="4"`) | Required; Min 10, Max 2,000 chars | *"Clinical diagnosis is required (min 10 characters)."* |
| **Procedure Performed** | Textarea (`rows="5"`) | Required; Min 10, Max 2,000 chars | *"Detailed procedure description is required."* |
| **Prescriptions / Advice**| Textarea (`rows="3"`) | Optional; Max 1,000 chars | N/A |
| **Complete Visit CTA** | Button (`type="submit"`) | Disabled while submitting | N/A |

---

## 6. Accessibility (WCAG 2.2 AA)
- Teeth selector structured as an accessible toggle button group with `aria-pressed="true/false"`.
- Textareas clearly labeled with `<label for="...">` and dynamic live character count (`aria-live="polite"`).
- Keyboard accessibility: Enter or Space toggles tooth selection pills; Tab navigates through quadrants.
