# ToothCare Hub — Design Tokens & Visual Design System

**Document ID:** `TCH-P3-DTS-001`  
**Version:** `1.0.0`  
**Phase:** Phase 3 — Requirements, User Journeys, Wireframes, and Design System  
**Prepared Date:** `2026-10-27`  
**Status:** Approved Baseline  
**Author:** Lead UI/UX Designer & Design Systems Engineer  

---

## 1. Design System Foundations & Brand Philosophy

The **ToothCare Hub** design system delivers a clinical, trustworthy, modern aesthetic tailored for dental healthcare. The palette balances authoritative clinical professionalism with approachable warmth:
- **Deep Navy (`#12304A`):** Anchors navigation, headings, and primary structural elements.
- **ToothCare Teal (`#0D9488`):** Inspires cleanliness, health, and confidence; serves as the primary interactive accent.
- **Soft Teal (`#CCFBF1`):** Provides accessible background tints, active tab fills, and notification highlights.
- **Neutral Canvas (`#F5F8FA`):** Alleviates eye strain in prolonged clinical administrative use.
- **Body Slate (`#334155`):** Delivers optimal readability and contrast across all typography.

---

## 2. Color Tokens

### 2.1 Core Brand Palette

```css
:root {
  /* Brand Core */
  --tch-color-navy-900: #0B1D2D;
  --tch-color-navy-800: #12304A; /* Primary Brand Navy */
  --tch-color-navy-700: #1B4568;
  --tch-color-navy-600: #265D8B;

  --tch-color-teal-700: #0F766E;
  --tch-color-teal-600: #0D9488; /* Primary Accent Teal */
  --tch-color-teal-500: #14B8A6;
  --tch-color-teal-100: #CCFBF1; /* Soft Highlight Teal */
  --tch-color-teal-50:  #F0FDFA;

  /* Surfaces & Backgrounds */
  --tch-color-canvas:     #F5F8FA; /* Global App Background */
  --tch-color-surface:    #FFFFFF; /* Card / Modal Surface */
  --tch-color-surface-sub:#F8FAFC; /* Secondary Muted Surface */

  /* Text & Content */
  --tch-color-text-primary:   #0F172A; /* Slate 900 */
  --tch-color-text-body:      #334155; /* Slate 700 */
  --tch-color-text-secondary: #64748B; /* Slate 500 */
  --tch-color-text-muted:     #94A3B8; /* Slate 400 */
  --tch-color-text-inverse:   #FFFFFF;

  /* Borders & Dividers */
  --tch-color-border-subtle:  #E2E8F0; /* Slate 200 */
  --tch-color-border-strong:  #CBD5E1; /* Slate 300 */
  --tch-color-border-focus:   #0D9488; /* Teal 600 */
}
```

### 2.2 Semantic Feedback & State Tokens

| Semantic Token | Hex Code | Purpose | Accessible Contrast vs. Surface |
| :--- | :---: | :--- | :---: |
| **Success Fill** | `#10B981` | Positive outcomes, confirmed bookings | 3.2:1 (pair with dark text) |
| **Success Text** | `#065F46` | High-contrast success messaging | 7.8:1 on `#ECFDF5` |
| **Warning Fill** | `#F59E0B` | Pending status, cautionary alerts | 2.1:1 (pair with `#78350F`) |
| **Warning Text** | `#78350F` | High-contrast warning messaging | 8.4:1 on `#FFFBEB` |
| **Error / Danger Fill** | `#EF4444` | Cancellations, allergies, validation errors | 4.6:1 on white |
| **Error / Danger Text** | `#991B1B` | High-contrast error messaging | 7.2:1 on `#FEF2F2` |
| **Info Fill** | `#0284C7` | Neutral informational tooltips | 4.5:1 on white |
| **Info Text** | `#075985` | Informational alert text | 7.6:1 on `#F0F9FF` |

### 2.3 Appointment Status Tokens

> [!IMPORTANT]
> **Non-Color Dependence Rule:** Appointment status is **never** conveyed through color alone. Every status badge must pair its background tint with an accessible SVG icon and visible text label.

| Status Enum | Badge Background | Badge Text Color | Icon | Visual Representation |
| :--- | :---: | :---: | :---: | :--- |
| `CONFIRMED` | `#CCFBF1` (Soft Teal) | `#0F766E` (Dark Teal) | `CheckCircle2` | `[✓ Confirmed]` |
| `PENDING` | `#FEF3C7` (Soft Amber) | `#92400E` (Dark Amber) | `Clock` | `[⏳ Pending Review]` |
| `COMPLETED` | `#E0F2FE` (Soft Sky) | `#0369A1` (Dark Sky) | `CheckCheck` | `[✓✓ Completed]` |
| `CANCELLED` | `#FEE2E2` (Soft Rose) | `#991B1B` (Dark Red) | `XCircle` | `[✕ Cancelled]` |

---

## 3. Typography Hierarchy & Scale

ToothCare Hub utilizes **Inter** (or standard system-ui sans-serif fallback) to maintain high legibility across medical records, dense tables, and touch screens.

```css
:root {
  --tch-font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --tch-font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Font Sizes & Line Heights */
  --tch-text-xs:   0.75rem;    /* 12px, line-height: 1rem (16px) */
  --tch-text-sm:   0.875rem;   /* 14px, line-height: 1.25rem (20px) */
  --tch-text-base: 1rem;       /* 16px, line-height: 1.5rem (24px) */
  --tch-text-lg:   1.125rem;   /* 18px, line-height: 1.75rem (28px) */
  --tch-text-xl:   1.25rem;    /* 20px, line-height: 1.75rem (28px) */
  --tch-text-2xl:  1.5rem;     /* 24px, line-height: 2rem (32px) */
  --tch-text-3xl:  1.875rem;   /* 30px, line-height: 2.25rem (36px) */
  --tch-text-4xl:  2.25rem;    /* 36px, line-height: 2.5rem (40px) */

  /* Font Weights */
  --tch-font-normal:    400;
  --tch-font-medium:    500;
  --tch-font-semibold:  600;
  --tch-font-bold:      700;
}
```

---

## 4. Spacing, Elevation & Radii

### 4.1 Spacing Scale (4px Base Grid)

```css
:root {
  --tch-space-1:  0.25rem; /* 4px */
  --tch-space-2:  0.5rem;  /* 8px */
  --tch-space-3:  0.75rem; /* 12px */
  --tch-space-4:  1.0rem;  /* 16px (Standard component padding) */
  --tch-space-5:  1.25rem; /* 20px */
  --tch-space-6:  1.5rem;  /* 24px (Standard card padding) */
  --tch-space-8:  2.0rem;  /* 32px (Section separation) */
  --tch-space-10: 2.5rem;  /* 40px */
  --tch-space-12: 3.0rem;  /* 48px */
  --tch-space-16: 4.0rem;  /* 64px (Layout shell padding) */
}
```

### 4.2 Border Radii

```css
:root {
  --tch-radius-sm:   0.25rem; /* 4px - Badges & tags */
  --tch-radius-md:   0.375rem;/* 6px - Form controls & buttons */
  --tch-radius-lg:   0.5rem;  /* 8px - Toolbars & dropdowns */
  --tch-radius-xl:   0.75rem; /* 12px - Cards & slide drawers */
  --tch-radius-2xl:  1.0rem;  /* 16px - Modals & hero banners */
  --tch-radius-full: 9999px;  /* Pill buttons & avatar frames */
}
```

### 4.3 Elevation & Shadows

```css
:root {
  --tch-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --tch-shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --tch-shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --tch-shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
}
```

---

## 5. Animation, Focus & Motion Standards

### 5.1 Focus Rings
Every interactive element displays an accessible focus ring:
`outline: 2px solid #0D9488; outline-offset: 2px;`

### 5.2 Transition Timings & Reduced-Motion
```css
:root {
  --tch-transition-fast:   150ms cubic-bezier(0.4, 0, 0.2, 1);
  --tch-transition-normal: 250ms cubic-bezier(0.4, 0, 0.2, 1);
  --tch-transition-slow:   350ms cubic-bezier(0.4, 0, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 6. Tailwind CSS Theme Integration Mapping

To seamlessly apply these tokens in `frontend/tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#12304A',
          teal: '#0D9488',
          'soft-teal': '#CCFBF1',
          canvas: '#F5F8FA',
        },
        slate: {
          body: '#334155',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```
