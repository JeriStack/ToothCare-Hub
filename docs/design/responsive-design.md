# ToothCare Hub — Shared Layout & Responsive Design Specification

**Document ID:** `TCH-P3-RDS-001`  
**Version:** `1.0.0`  
**Phase:** Phase 3 — Requirements, User Journeys, Wireframes, and Design System  
**Prepared Date:** `2026-10-27`  
**Status:** Approved Baseline  
**Author:** Lead UI/UX Designer & Frontend Architect  

---

## 1. Architectural Purpose & Layout Shells

The ToothCare Hub user interface is built on a responsive application shell that guarantees visual consistency, role-specific navigation, and predictable interaction across all screen sizes.

The application implements three layout shells:
1. **Public Shell (`PublicLayout`):** Centered card or hero layout for unauthenticated visitors (`/login`, `/register`, `/forgot-password`).
2. **Authenticated App Shell (`AppLayout`):** The primary work environment featuring a shared top bar, role-tailored sidebar (or mobile drawer), notification center, and responsive main content area.
3. **Focused Flow Shell (`WizardLayout`):** Distraction-free layout utilized by the 6-Step Appointment Booking Wizard and Clinical Treatment Entry to maximize task completion without navigational leakage.

---

## 2. Shared App Shell Structure

```
+-------------------------------------------------------------------------------+
| TOP BAR (Height: 64px, Sticky, z-index: 40)                                   |
| [Logo] ToothCare Hub       [Global Search (Admin)]      [🔔 3] [User Avatar v]|
+-------------------------------------------------------------------------------+
| SIDEBAR (Width: 260px)  | MAIN CONTENT REGION (Fluid, min-height 100vh - 64px)|
| [Role Badge]            | Page Title & Breadcrumbs                            |
|                         |-----------------------------------------------------|
| (•) Nav Link 1 (Active) | [Page Toolbar / Filters / Action CTA]               |
| ( ) Nav Link 2          |                                                     |
| ( ) Nav Link 3          | [Content Cards / Data Tables / Form Grid]           |
| ( ) Nav Link 4          |                                                     |
|                         |                                                     |
| ----------------------- |                                                     |
| [Clinic Help & Phone]   |                                                     |
| [Log Out Button]        |                                                     |
+-------------------------+-----------------------------------------------------+
```

### 2.1 Top Bar Elements
- **Branding:** Official ToothCare Hub logo mark + logotype (`ToothCare Hub`). Clicking logo navigates to role home.
- **Role Indicator Badge:** Displays user's active role in subtle rounded pill (`Patient`, `Attending Dentist`, or `Clinic Administrator`).
- **Global Search (Admin only):** Debounced omnibox searching patients, appointments, and dentists.
- **Notification Center Trigger:** Bell icon with dynamic badge indicator (Teal `#0D9488` pill showing unread count). Triggers slide-over drawer.
- **User Profile Dropdown:** Displays user avatar/initials, full name, role, and actions (`My Profile`, `Settings`, `Log Out`).

### 2.2 Navigation Sidebar Elements (Role-Tailored)
- **Patient Nav:** Dashboard, Book Appointment, My Appointments, Visit History, Help Center.
- **Dentist Nav:** Today's Practice, My Schedule, Patient Context, Clinical Records, Notifications.
- **Admin Nav:** Dashboard, Appointment Triage, Patient Registry, Dentist Roster, Services & Fees, Clinic Schedules, Reports.

---

## 3. Responsive Breakpoints & Device Adaptations

ToothCare Hub strictly adheres to standard Tailwind CSS responsive breakpoints:

| Breakpoint | Minimum Width | Target Devices | Layout Adaptations |
| :--- | :--- | :--- | :--- |
| **`xs` (Base)** | `< 640px` | Mobile Phones (375px - 430px) | Single column; Sidebar collapses into slide drawer; Tables convert to stacked cards; Min touch target 44x44px. |
| **`sm`** | `640px` | Large Phones / Small Phablets | 2-column form grids; Modal width capped at 90vw. |
| **`md`** | `768px` | Tablets (Portrait) / Foldables | Collapsible compact icon sidebar (80px); 2-column dashboard widgets. |
| **`lg`** | `1024px` | Tablets (Landscape) / Small Laptops | Full sidebar expanded (260px); Multi-column data tables; Slide-over drawers (480px). |
| **`xl`** | `1280px` | Standard Desktop Monitors | Max container width `1280px` centered; 4-card metric strips; Side-by-side schedule timelines. |
| **`2xl`**| `1536px` | High-Resolution Displays | Max container width `1440px`; Optimal readable line lengths (max 75ch). |

---

## 4. Mobile Layout Adaptations (Touch First)

```
+-----------------------------------+
| [=] ToothCare Hub          [🔔 3] | <- Mobile Header (56px height)
+-----------------------------------+
| Patient Portal                    |
| Next Visit: Nov 3 (Dr. Santos)    |
|                                   |
| +-------------------------------+ |
| | [+ Book New Appointment]      | | <- Primary CTA (Full width, 48px height)
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | APPOINTMENT CARD (Stacked)    | | <- Table columns converted to
| | Ref #1042                     | |    accessible vertical cards
| | Service: Cleaning (45m)       | |
| | Dentist: Dr. Maria Santos     | |
| | Status: [● Confirmed (Teal)]  | |
| |                               | |
| | [ View Details ] [ Cancel ]   | |
| +-------------------------------+ |
+-----------------------------------+
| BOTTOM NAV / DRAWER OVERLAY       |
+-----------------------------------+
```

### 4.1 Mobile Design Rules
1. **Zero Unintentional Horizontal Scroll:** Containers use `w-full max-w-full overflow-x-hidden`. Any wide data table uses a horizontally scrollable wrapper with visible gradient fade shadows or converts automatically to stacked cards on viewports $< 768\text{px}$.
2. **Touch Targets:** All interactive buttons, checkboxes, tabs, and table action triggers enforce a minimum bounding box of **$44 \times 44\text{px}$** (`min-h-[44px] min-w-[44px]`).
3. **Mobile Navigation Drawer:** Triggered by hamburger button `[=]`; slides from the left with backdrop overlay (`bg-slate-900/50 backdrop-blur-sm`). Traps focus while open; dismisses on backdrop tap, swipe-left gesture, or Escape key.
4. **Touch-Optimized Form Inputs:** Inputs use `text-base` (16px) on mobile to prevent iOS Safari auto-zooming. Number inputs declare `inputmode="numeric"`; phone fields declare `inputmode="tel"`.

---

## 5. Master Reusable Page Patterns

### 5.1 Dashboard Metric Cards
- Container: Rounded-xl (`rounded-xl`), white background (`#FFFFFF`), 1px slate border (`#E2E8F0`), subtle shadow (`shadow-sm`).
- Contents: Icon badge with soft background (e.g., Soft Teal `#CCFBF1`), secondary uppercase label (`#64748B`), bold numeric metric (`#12304A`, text-2xl), and delta / trend tag.

### 5.2 Filterable Data Tables
- Header: Sticky table header (`bg-slate-50 text-slate-700 uppercase font-semibold text-xs tracking-wider`).
- Rows: Alternating hover highlight (`hover:bg-slate-50/80 transition-colors`).
- Overflow: Wrapped in `overflow-x-auto` container with custom thin scrollbar.
- Responsive switch: On `< 768px`, rows render as individual flex cards.

### 5.3 Confirmation & Action Dialogs (Modals)
- Overlay: Dark semi-transparent backdrop with blur (`fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50`).
- Container: Centered modal card (`max-w-lg w-full bg-white rounded-2xl p-6 shadow-2xl`).
- Focus Trap: Traps focus within modal; initial focus placed on primary safe action (e.g., *"Keep Appointment"*); dangerous action (e.g., *"Confirm Cancellation"*) requires deliberate selection.

### 5.4 Loading Skeletons
- Replaces raw spinners for page content to prevent layout shifts (CLS optimization).
- Implements pulsing gray bars (`animate-pulse bg-slate-200 rounded`) matching exact dimensions of text, cards, and buttons.

### 5.5 Empty States
- Consists of: Centered SVG illustration, primary heading (`text-lg font-bold text-slate-800`), descriptive paragraph (`text-slate-500 max-w-md`), and primary call-to-action button.

### 5.6 Toast Feedback
- Fixed position: Bottom-right on desktop (`bottom-6 right-6`), top-center on mobile (`top-4 inset-x-4`).
- Lifespan: Auto-dismisses after 5,000ms; persistent close button `[X]`; announces via `aria-live="polite"`.

---

## 6. Verification & Acceptance Criteria
- [x] **AC-RD1:** Layout seamlessly adjusts across 375px, 768px, 1024px, and 1280px without layout distortion or content clipping.
- [x] **AC-RD2:** All mobile touch targets measure $\ge 44 \times 44\text{px}$.
- [x] **AC-RD3:** Desktop tables cleanly convert to stacked card layouts below the `md` breakpoint.
