# ToothCare Hub Wireframe: Dental Services & Pricing Management (Admin)

**Document ID:** `TCH-P3-WFR-009`  
**Screen ID:** `SCR-ADM-004`  
**Route:** `/admin/services`  
**Authorized Roles:** `ADMIN`  

---

## 1. Screen Specification

### 1.1 Purpose
Enables clinic administrators to configure the clinic's catalog of dental services, procedure categories, standard treatment durations (which drive the 30-minute slot scheduling grid: 30, 45, 60, or 90 minutes), baseline pricing in Philippine Pesos (PHP), and public booking visibility.

### 1.2 Layout & Hierarchy
- **Desktop:** Administrative navigation shell, category filter tabs (All, Preventive, Restorative, Cosmetic, Surgery), search input, primary action `[ + Add New Service ]`, and categorized data table.
- **Mobile:** Category segmented selector, service cards with duration, price pill, and inline toggle switch.

---

## 2. Desktop Wireframe

```
+-------------------------------------------------------------------------------+
| [Logo] ToothCare Hub Admin         [Search clinic records...]  [🔔 4] [Admin v]|
+-------------------------------------------------------------------------------+
| [Sidebar]     | Dental Services & Treatment Pricing Catalog                   |
| ( ) Dashboard | Filter: [ All (14) ] [ Preventive ] [ Restorative ] [ Cosmetic ]|
| ( ) Appts     | Search: [ 🔍 Search service name or description...          ] |
| ( ) Patients  | Action: [ + Add New Dental Service (Teal) ]                   |
| ( ) Dentists  |---------------------------------------------------------------|
| (•) Services  | +-----------------------------------------------------------+ |
| ( ) Schedules | | Service Name     Category    Duration  Price (PHP)  Status| |
| ( ) Reports   | |-----------------------------------------------------------| |
|               | | Prophylaxis (Cl) Preventive  45 mins   ₱1,500.00    Active| |
|               | | Composite Fill   Restorative 45 mins   ₱1,800.00    Active| |
|               | | Teeth Whitening  Cosmetic    60 mins   ₱7,500.00    Active| |
|               | | Root Canal Ther  Restorative 90 mins   ₱8,000.00    Active| |
|               | | Simple Extract   Surgery     30 mins   ₱1,200.00    Active| |
|               | +-----------------------------------------------------------+ |
|               |                                                               |
|               | +-----------------------------------------------------------+ |
|               | | Modal / Drawer: Edit Dental Service (#1)              [X] | |
|               | |-----------------------------------------------------------| |
|               | | Service Name: Dental Prophylaxis (Cleaning)               | |
|               | | Category: [ Preventive                                  v ]| |
|               | | Duration: [ 45 Minutes (Occupies two 30-min grid slots) v ]| |
|               | | Base Price (PHP): [ ₱ 1,500.00                          ] | |
|               | | Description: "Comprehensive scaling, polishing, and oral  | |
|               | | hygiene evaluation."                                      | |
|               | |                                                           | |
|               | | Visibility: [x] Allow patients to self-book online        | |
|               | | Status:     (•) Active service   ( ) Archived / Inactive  | |
|               | |                                                           | |
|               | | [ Cancel ]                      [ Save Service Changes ]  | |
|               | +-----------------------------------------------------------+ |
+---------------+---------------------------------------------------------------+
```

---

## 3. Mobile Wireframe (Viewport 375px)

```
+-----------------------------------+
| [=] Services & Pricing     [🔔 4] |
+-----------------------------------+
| [ + Add Dental Service (Teal) ]   |
|                                   |
| Filter: [ All ] [ Prev ] [ Rest ] |
|                                   |
| +-------------------------------+ |
| | Dental Cleaning (Prophylaxis) | |
| | Category: Preventive          | |
| | Duration: ⏱ 45 mins           | |
| | Fee: ₱1,500.00                | |
| | Online Booking: [✓ Enabled]   | |
| | Status: [● Active (Teal)]     | |
| |                               | |
| | [ Edit Service Details > ]    | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | Teeth Whitening (In-Office)   | |
| | Category: Cosmetic            | |
| | Duration: ⏱ 60 mins           | |
| | Fee: ₱7,500.00                | |
| | Online Booking: [✓ Enabled]   | |
| | Status: [● Active (Teal)]     | |
| |                               | |
| | [ Edit Service Details > ]    | |
| +-------------------------------+ |
+-----------------------------------+
```

---

## 4. Duration Grid Alignment Rules

| Duration Selected | Grid Block Formula | Slots Reserved | Booking Calculation Note |
| :---: | :---: | :---: | :--- |
| **30 Minutes** | $1 \times 30\text{m}$ | 1 Slot | Exact single slot alignment (e.g., 09:00 - 09:30). |
| **45 Minutes** | $1.5 \times 30\text{m}$ | 2 Slots | Blocks 09:00 - 09:45; next available slot starts at 10:00 (15m buffer). |
| **60 Minutes** | $2 \times 30\text{m}$ | 2 Slots | Covers two consecutive 30-min slots (e.g., 09:00 - 10:00). |
| **90 Minutes** | $3 \times 30\text{m}$ | 3 Slots | Covers three consecutive 30-min slots (e.g., 09:00 - 10:30). |

---

## 5. Screen States & Validation
- **Price Validation:** Must be positive integer or decimal with 2 decimal places. Currency strictly Philippine Peso (`PHP`).
- **Archive Safety:** Deactivating a service does not alter or delete existing appointments already booked under that service.
- **Empty State:** Shows: *"No services configured in this category. [Add First Service]"*.

---

## 6. Accessibility (WCAG 2.2 AA)
- Price fields formatted with currency prefix `<span aria-hidden="true">₱</span>` and input `aria-label="Price in Philippine Pesos"`.
- Table headers provide scope attributes. Online booking status toggle contains visible descriptive text.
