# ToothCare Hub — Reusable Component Inventory (26 Core Components)

**Document ID:** `TCH-P3-CMP-001`  
**Version:** `1.0.0`  
**Phase:** Phase 3 — Requirements, User Journeys, Wireframes, and Design System  
**Prepared Date:** `2026-10-27`  
**Status:** Approved Baseline  
**Author:** Lead UI Engineer & Design System Architect  

---

## 1. Inventory Overview

This document specifies the 26 reusable UI components that constitute the **ToothCare Hub** interface. Each component specification defines:
- **Component Identifier & Purpose**
- **Variants & Sizes**
- **Interactive States:** Default, Hover, Active, Focus, Disabled, Loading, Error
- **Accessibility & ARIA Attributes:** Roles, labels, keyboard interactions, touch targets
- **Usage Context & Screen Mapping**

---

## 2. Master Component Table

| # | Component Name | Category | Primary Purpose | Key Variants |
| :---: | :--- | :--- | :--- | :--- |
| **01** | `Button` | Input / Action | Primary and secondary user triggers | `primary`, `secondary`, `outline`, `ghost`, `danger` |
| **02** | `Input` | Input / Form | Single-line alphanumeric text entry | `text`, `email`, `tel`, `number` |
| **03** | `PasswordInput` | Input / Form | Masked password entry with eye reveal | `default`, `with-strength-meter` |
| **04** | `Select` | Input / Form | Single option selection from dropdown | `standard`, `pill-group` |
| **05** | `DateTimePicker` | Input / Scheduling | 30-min slot & calendar date picker | `calendar-grid`, `time-slot-pill` |
| **06** | `Textarea` | Input / Form | Multi-line text for notes & diagnoses | `standard`, `with-char-counter` |
| **07** | `Checkbox` | Input / Form | Boolean agreements & multi-filters | `standard`, `card-checkbox` |
| **08** | `FormField` | Layout / Form | Accessible wrapper binding label & error | `vertical`, `horizontal` |
| **09** | `FormErrorMessage` | Feedback / Form | Accessible error text container | `inline`, `callout` |
| **10** | `Card` | Surface / Layout | Elevated container for grouped content | `default`, `metric`, `timeline` |
| **11** | `Table` | Data Display | Tabular list of patients, visits, fees | `striped`, `compact`, `responsive-cards` |
| **12** | `AppointmentCard` | Domain / Display | Comprehensive appointment presentation | `compact`, `hero-next-visit`, `queue-triage` |
| **13** | `StatusBadge` | Feedback / Domain| Visual tag with text + icon pairing | `confirmed`, `pending`, `completed`, `cancelled` |
| **14** | `Alert` | Feedback / Notice| High-visibility system status banners | `info`, `warning`, `danger-allergy`, `success` |
| **15** | `Toast` | Feedback / Global| Non-intrusive transient notifications | `success`, `error`, `network-offline` |
| **16** | `Dialog` | Overlay / Modal | Focus-trapping modal confirmation box | `alertdialog`, `form-modal`, `drawer-slideover` |
| **17** | `DropdownMenu` | Navigation / Action| Contextual action menu triggered by button| `profile-menu`, `row-action-menu` |
| **18** | `Sidebar` | Shell / Navigation | Persistent left-side role navigation | `desktop-expanded`, `tablet-collapsed`, `mobile-drawer` |
| **19** | `TopNavigation` | Shell / Navigation | Global sticky header with logo & profile | `public-header`, `app-header` |
| **20** | `Breadcrumbs` | Navigation / Context| Hierarchical pathway navigation links | `default`, `compact` |
| **21** | `Pagination` | Navigation / Data | Page switching controls for data tables | `full`, `simple-prev-next` |
| **22** | `SearchToolbar` | Navigation / Data | Debounced search with filter dropdowns | `table-toolbar`, `global-omnibox` |
| **23** | `LoadingSkeleton` | Feedback / Loading| Content-shaped shimmers during fetch | `text-skeleton`, `card-skeleton`, `table-skeleton` |
| **24** | `EmptyState` | Feedback / State | Informational graphic for zero data | `no-appointments`, `no-search-results`, `queue-empty` |
| **25** | `ErrorState` | Feedback / State | Error boundary container with retry CTA | `404-not-found`, `403-forbidden`, `network-error` |
| **26** | `NotificationItem` | Domain / Messaging| Real-time notification card & count pill | `unread-item`, `read-item`, `nav-badge-pill` |

---

## 3. Detailed Component Specifications

### 01. `Button`
- **Purpose:** Executes commands, submits forms, or opens dialogs.
- **Variants:**
  - `primary`: Background `#0D9488` (Teal), text `#FFFFFF`.
  - `secondary`: Background `#12304A` (Navy), text `#FFFFFF`.
  - `outline`: Border 1px `#CBD5E1`, text `#12304A`, hover background `#F8FAFC`.
  - `ghost`: Transparent background, hover background `#F1F5F9`, text `#334155`.
  - `danger`: Background `#EF4444`, text `#FFFFFF`.
- **States:** Default, `:hover`, `:focus-visible` (2px Teal ring), `:active`, `:disabled` (`opacity: 0.5; cursor: not-allowed`), `loading` (spinner with `aria-busy="true"`).
- **Accessibility:** Minimum touch target $44 \times 44\text{px}$ on mobile (`h-11 px-4`). Focusable via Tab; triggers on Space / Enter.

---

### 02. `Input`
- **Purpose:** Standard single-line text entry for names, emails, phone numbers, and search terms.
- **Variants:** `text`, `email`, `tel`, `number`, `search`.
- **States:** Default (border `#CBD5E1`), `:hover`, `:focus-visible` (border `#0D9488`, ring 2px `#CCFBF1`), `:disabled` (background `#F1F5F9`), `error` (border `#EF4444`, ring 2px `#FEE2E2`).
- **Accessibility:** Explicitly associated with `<label for="...">`. Error state pairs with `aria-invalid="true"` and `aria-describedby="{id}-error"`.

---

### 03. `PasswordInput`
- **Purpose:** Masked credentials input with accessible visibility reveal button.
- **States:** Masked (`type="password"`), Revealed (`type="text"`), Validation error.
- **Accessibility:** Toggle button has dynamic accessible label (`aria-label="Show password"` / `"Hide password"`) and does not submit form when activated.

---

### 04. `Select`
- **Purpose:** Single selection from pre-defined list (Dentist specialties, cancellation reasons, time-off types).
- **States:** Closed, Open (popover with `role="listbox"`), Highlighted option (`role="option"` with `aria-selected="true"`), Disabled.
- **Accessibility:** Full keyboard arrow navigation; Esc closes menu; Enter commits selection.

---

### 05. `DateTimePicker`
- **Purpose:** Guides patients to pick appointment date and 30-minute start slot.
- **Variants:**
  - `DateCalendar`: Month grid with past dates and clinic holidays disabled (`aria-disabled="true"`).
  - `TimeSlotPill`: Discrete 30-min buttons (e.g., `09:30 AM`).
- **States:** Available, Selected (Teal background, check icon), Occupied / Blocked (gray slashed-through), Focused.
- **Accessibility:** Slots grouped in `<div role="radiogroup" aria-label="Available appointment starting times">`.

---

### 06. `Textarea`
- **Purpose:** Multi-line text for patient chief complaints and clinical treatment findings.
- **States:** Default, Focus, Error, Disabled.
- **Accessibility:** Includes dynamic character count container with `aria-live="polite"` (e.g., `"154 of 1,000 characters"`).

---

### 07. `Checkbox`
- **Purpose:** Legal agreements, terms acceptance, and table multi-selection.
- **States:** Unchecked (`aria-checked="false"`), Checked (`aria-checked="true"`), Indeterminate (`aria-checked="mixed"`), Disabled.
- **Accessibility:** Min bounding box $44 \times 44\text{px}$; styled via accessible SVG check icon.

---

### 08. `FormField`
- **Purpose:** Standard layout wrapper uniting label, required asterisk `*`, helper description, input element, and validation message.
- **Accessibility:** Guarantees programmatic label binding and proper ARIA relationship linkages.

---

### 09. `FormErrorMessage`
- **Purpose:** Renders validation error text directly below invalid input controls.
- **Accessibility:** Decorated with warning icon; declared with `id="{field}-error"` and `role="alert"`.

---

### 10. `Card`
- **Purpose:** Grouping related content into a distinct visual surface.
- **Variants:** `default` (white fill, 1px slate border), `metric` (large KPI typography with icon badge), `timeline` (date ribbon on left border).

---

### 11. `Table`
- **Purpose:** Displays structured clinic records (Patients, Appointments, Services, Audit Logs).
- **Accessibility:** Proper `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`. Responsive wrapper provides horizontal scroll bar with visible gradient fade indicators.

---

### 12. `AppointmentCard`
- **Purpose:** Displays single appointment context across dashboard, agenda, and triage views.
- **Contents:** Patient name, service title, dentist photo/name, date & time in `Asia/Manila`, status badge, and context actions.

---

### 13. `StatusBadge`
- **Purpose:** Accessible status indicator for `CONFIRMED`, `PENDING`, `COMPLETED`, `CANCELLED`.
- **Accessibility:** Always pairs accessible icon + text label (never color alone).

---

### 14. `Alert`
- **Purpose:** Contextual banners highlighting critical clinical notes, penicillin allergies, or policy warnings.
- **Variants:** `info` (Sky), `warning` (Amber), `danger-allergy` (High-contrast Red `#EF4444` with white text), `success` (Teal).

---

### 15. `Toast`
- **Purpose:** Ephemeral snackbar notifications for asynchronous actions (e.g., *"Appointment request submitted"*).
- **Accessibility:** Dispatches via `aria-live="polite"` region; persists for 5 seconds; close button `[X]`.

---

### 16. `Dialog`
- **Purpose:** Modal window interrupting flow for destructive actions (Cancellations, Rejections) or multi-step forms.
- **Accessibility:** Traps focus inside modal (`aria-modal="true"`); closes on Escape; returns focus to trigger upon close.

---

### 17. `DropdownMenu`
- **Purpose:** Contextual popover menu for user profile or row actions (`[...]`).
- **Accessibility:** Keyboard navigable with Arrow Up/Down; closes on blur or Escape.

---

### 18. `Sidebar`
- **Purpose:** Left-aligned role-tailored navigation panel.
- **Variants:** Desktop expanded (260px), Tablet collapsed (80px icon-only), Mobile drawer (slide-in overlay).

---

### 19. `TopNavigation`
- **Purpose:** Sticky global app header holding clinic branding, role badge, notification bell, and user menu.

---

### 20. `Breadcrumbs`
- **Purpose:** Hierarchical navigation trail (e.g., `Appointments > Triage > Ref #1042`).
- **Accessibility:** Structured in `<nav aria-label="Breadcrumb">` with `<ol>` and `aria-current="page"`.

---

### 21. `Pagination`
- **Purpose:** Page controls for large data tables (10, 25, 50 rows per page).
- **Accessibility:** Current page marked with `aria-current="page"`; prev/next buttons have accessible text labels.

---

### 22. `SearchToolbar`
- **Purpose:** Filter bar containing debounced search input, date pickers, and status dropdowns.

---

### 23. `LoadingSkeleton`
- **Purpose:** Pulse placeholder matching component shapes to eliminate cumulative layout shift (CLS).

---

### 24. `EmptyState`
- **Purpose:** Friendly zero-data feedback with graphic and primary call to action.

---

### 25. `ErrorState`
- **Purpose:** Comprehensive boundary for unhandled errors, 404 Not Found, or 403 Forbidden screens.

---

### 26. `NotificationItem` & `NotificationBadge`
- **Purpose:**
  - `NotificationBadge`: Pill showing unread count in navbar (`[🔔 3]`).
  - `NotificationItem`: Row in drawer with icon, title, message snippet, relative timestamp, and unread dot indicator.
