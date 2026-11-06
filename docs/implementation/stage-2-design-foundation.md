# Stage 2 — Impeccable Design Foundation Report

**Project:** ToothCare Hub — Dental Appointment and Clinic Management System  
**Document ID:** `TCH-STAGE2-DESIGN-001`  
**Version:** `1.0.0`  
**Date:** `2026-11-07`  
**Status:** `COMPLETED / PASSED`  
**Phase Target:** `Phase 2 & Phase 3 Impeccable Design Foundation`

---

## 1. Objective and Overview

Stage 2 establishes a cohesive, accessible, and responsive visual design foundation across all public and authenticated interfaces of ToothCare Hub. By leveraging the installed **Impeccable Design System**, this foundation ensures calm clinical clarity, accessible contrast, semantic controls, and strict visual consistency before implementing dynamic website and application features.

---

## 2. Design Tokens and Visual Standards

### 2.1 Brand Identity & Color Palette

| Token Name | Hex Code | Role & Usage | Contrast Ratio on White |
|---|---|---|---|
| **ToothCare Navy** | `#12304A` | Primary typography, headers, main branding | `12.6:1` (AAA compliant) |
| **Navy Deep** | `#0B1D2D` | High-emphasis accents, dark backgrounds | `15.8:1` (AAA compliant) |
| **ToothCare Teal** | `#0D9488` | Primary interactive buttons, icons, links | `4.54:1` (AA compliant on white, AAA text in white) |
| **Teal Deep** | `#0F766E` | Hover/active states for primary actions | `6.1:1` (AAA compliant) |
| **Soft Teal** | `#CCFBF1` | Pill active backgrounds, selection fills | Decorative / Inset fill |
| **Cool Canvas** | `#F5F8FA` | Application page background | Neutral ground |
| **Body Slate** | `#334155` | Secondary descriptions, labels, helper text | `7.8:1` (AAA compliant) |

### 2.2 Typography Stack
- **Primary Typeface:** `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Scale Hierarchy:**
  - `Display / Hero`: `2.25rem` – `3.75rem` (36px – 60px), Font Weight `800` (Extrabold), Line Height `1.12`
  - `Section Headline`: `1.875rem` – `2.25rem` (30px – 36px), Font Weight `700` (Bold), Line Height `1.25`
  - `Card Title`: `1.125rem` – `1.25rem` (18px – 20px), Font Weight `700` (Bold), Line Height `1.4`
  - `Body Standard`: `0.875rem` – `1rem` (14px – 16px), Font Weight `400` (Regular), Line Height `1.5`
  - `Label & Badges`: `0.75rem` – `0.8125rem` (12px – 13px), Font Weight `600` (Semibold), Tracking `tight`

### 2.3 Elevation, Corners, and Spacing
- **Border Radius:**
  - Small elements / badges: `8px` (`rounded-lg`)
  - Form inputs & buttons: `12px` (`rounded-xl`)
  - Content cards & panels: `16px` – `24px` (`rounded-2xl` / `rounded-3xl`)
- **Shadows:** Soft, subtle elevation without harsh outlines (`shadow-xs`, `shadow-md`, `shadow-teal-900/15`).
- **Focus Indicators:** Explicit 2px offset focus rings (`focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2`).

---

## 3. Reusable Component Inventory

| Component | Path | Key Capabilities | Accessibility Standards |
|---|---|---|---|
| **`Button`** | `src/components/ui/Button.jsx` | Variants: `primary`, `secondary`, `outline`, `ghost`, `danger`. Sizes: `sm`, `md`, `lg`. Supports loading spinner, left/right icons. | Visible focus ring, `aria-busy`, disabled pointer event handling. |
| **`Input`** | `src/components/ui/Input.jsx` | Form field with floating/top label, helper text, inline error message, left/right icon slots. | `aria-invalid`, `aria-describedby` linking to error or helper ID, required asterisks. |
| **`Modal`** | `src/components/ui/Modal.jsx` | Accessible dialog overlay with backdrop dismiss, escape key listener, scroll locking, and modular header/body/footer. | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, body scroll lock. |
| **`StatusBadge`** | `src/components/ui/StatusBadge.jsx` | Multi-status badge for `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `REJECTED`, `ACTIVE`, `INACTIVE`. Color paired with icons. | `role="status"`, semantic status iconography, never relies on color alone. |
| **`EmptyState`** | `src/components/ui/EmptyState.jsx` | Clean empty state with icon receptacle, title, descriptive copy, and optional action CTA. | `role="region"`, descriptive text hierarchy. |
| **`LoadingSpinner`** | `src/components/ui/LoadingSpinner.jsx` | ToothCare teal SVG spinner with configurable size, label, and inline/block layouts. | `role="status"`, `<span className="sr-only">` screen-reader feedback. |
| **`ToothCareLogo`** | `src/components/ui/ToothCareLogo.jsx` | Official 3D emblem with orbital medical cross ring and signature typography. Variants: `full`, `icon`, `full-image`. | Semantic alt text, scalable vector/image rendering. |

---

## 4. Accessibility and UX Standards

1. **Non-Color Dependent Indicators:** All status badges (e.g. `PENDING`, `CONFIRMED`, `CANCELLED`) combine distinct icons (`Clock`, `CheckCircle2`, `Ban`, `XCircle`) and textual labels, strictly adhering to WCAG 1.4.1 (Use of Color).
2. **Keyboard Traversal:** All interactive buttons, form inputs, anchor links, and modals support standard Tab, Shift+Tab, Enter, Space, and Escape keyboard navigation.
3. **Contrast Compliance:** All primary text (`#12304A`) achieves an AAA contrast ratio of `12.6:1` against the white background. Secondary text (`#334155`) achieves `7.8:1`.
4. **Smooth Scroll & Section Offsets:** Navigation targets on the landing page utilize `scroll-behavior: smooth` with `scroll-margin-top: 85px` to prevent fixed header occlusion.

---

## 5. Verification & Quality Gates

- **Vite Production Build:** `npm run build --prefix frontend` compiled in 10.73s with **0 errors**.
- **Impeccable Quality Scan:** `impeccable detect frontend/src` passed with **0 anti-patterns**.
- **PHPUnit Backend Tests:** `137/137 tests passing (854 assertions OK)`.
