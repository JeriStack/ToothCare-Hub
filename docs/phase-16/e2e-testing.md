# Phase 16 — End-to-End Browser Testing (Playwright)

## Setup & Commands

```powershell
# One-time Chromium installation
npm --prefix frontend exec playwright install chromium

# Run local Chromium E2E suite (auto-starts isolated Vite 8 server on port 5174)
npm run test:e2e:local

# Run interactive Playwright UI mode
npm run test:e2e:ui

# Open the last HTML report
npm --prefix frontend exec -- playwright show-report playwright-report
```

## Spec Inventory (`frontend/e2e/`)

- `landing-page.spec.ts`: Homepage title, semantic `<main>` and `<h1>` visibility, brand navigation, zero uncaught `pageerror`s.
- `theme-management.spec.ts`: Light Mode default enforcement (ignoring OS dark preference), Dark Mode toggle & `localStorage` persistence, and zero horizontal overflow across 9 viewports (`320px`–`1920px`) on `/`, `/login`, `/register`, `/forgot-password`.
- `critical-journeys.spec.ts`: Isolated browser E2E flows for login validation/error display and authenticated Admin executive dashboard + operational health verification without external SMTP or production DB dependencies.
