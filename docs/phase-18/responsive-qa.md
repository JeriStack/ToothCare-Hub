# Responsive Design Quality Assurance

## 1. Automated Responsive Contract Verification

ToothCare Hub enforces responsive layout contracts via `frontend/src/tests/components/ResponsiveContracts.test.jsx` (also gated in `.github/workflows/ci.yml`):

- Mobile drawer navigation & desktop collapsible sidebar (`<aside>` with `lg:sr-only` collapsed labels).
- Header brand truncation (`min-[420px]:flex`) and `44px` (`min-h-11`) mobile touch targets.
- Mobile-friendly sort controls (`MobileSortControl`) and responsive tables/card layouts across appointment lists, dashboards, reports, and admin views.
- Floating toast notifications constrained to `left-4 right-4 sm:left-auto sm:max-w-sm` to prevent horizontal overflow on `320px` viewports.

---

## 2. Viewport Coverage Status

| Device Category | Viewport | Verification Status |
|---|---|---|
| Small mobile (`320 × 568`) | `ResponsiveContracts.test.jsx` + CSS layout audit | **PASSED (Automated Contracts)** / Manual live device pass recommended before launch |
| Standard mobile (`390 × 844`) | `ResponsiveContracts.test.jsx` + Playwright mobile | **PASSED** |
| Tablet (`768 × 1024`) | Responsive breakpoint audit (`md:` / `lg:`) | **PASSED (Static/Component)** |
| Laptop (`1280 × 800`) & Desktop (`1440 × 900`, `1920 × 1080`) | Playwright E2E + Vite build verification | **PASSED** |
