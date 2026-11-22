# Accessibility Audit (WCAG 2.2 Level AA Target)

> **Engineering Target Note:** WCAG 2.2 Level AA is used as the technical evaluation target for this review. This document is **not** a formal accessibility certification.

---

## 1. Audited Controls & Automated Test Evidence

| Area | Verified Implementation | Evidence |
|---|---|---|
| Landmarks & Semantic Structure | `<header>`, `<nav>`, `<aside>`, `<main id="main-content" tabIndex={-1}>`, `<footer>`, and `role="status"` / `aria-live="polite"` toast & Suspense loading announcements | `frontend/src/app/App.jsx`, `AppHeaderUserMenu.test.jsx` |
| Keyboard & Focus Visibility | Visible `focus-visible:ring-2 focus-visible:ring-teal-400` rings on header controls, sidebar nav buttons, theme toggle, modals, and forms; Escape closes menus/dialogs | `AppHeaderUserMenu.test.jsx`, `ThemeContext.test.jsx` |
| Forms & Error Feedback | Accessible `<label htmlFor>` / `aria-label` associations, inline validation error messages, and non-color-only status indicators (icons + text badges) | `LoginPage.test.jsx`, `RegisterPage.test.jsx`, `BookAppointmentPage` tests |
| Light & Dark Mode Contrast | Dual Light/Dark token system with high-contrast text/surface pairs and `motion-reduce:transition-none` / `motion-reduce:transform-none` support | `ThemeContext.test.jsx`, `ResponsiveContracts.test.jsx` |
| Touch Targets | Interactive header controls use `min-h-11` (`44px`) on mobile viewports | `App.jsx`, `ResponsiveContracts.test.jsx` |

---

## 2. Outstanding Manual & Automated Verification Items

- **Full `axe-core` / Lighthouse Live Browser Sweep:** Automated Vitest + RTL component accessibility assertions pass (`39/39` test files), and Playwright E2E covers core flows, but a full `axe-core` + screen-reader (NVDA/VoiceOver) manual pass across all 17 authenticated role views in both Light and Dark modes is **NOT VERIFIED** in this CLI-only run and should be executed in staging before production launch.
