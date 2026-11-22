# ToothCare Hub — Public Help Center & Support (Stage 1)

## Overview

The **Public Help Center & Support** page provides unauthenticated visitors and signed-in patients with searchable FAQs, categorized self-service topics, step-by-step workflow guides, and clinic contact information without weakening authentication boundaries on private portal routes.

- **Public Route:** `/help-support`
- **Access:** Public (no login required)
- **Scope:** Stage 1 — Public Help Center only (no ticketing system, support inbox, live chat, or new database tables)

---

## Architecture & Implementation Decisions

1. **Frontend-Managed Content Architecture (Zero Backend/DB Changes)**
   - After auditing `backend/src/`, `database/migrations/`, and `frontend/src/`, no CMS table or public FAQ API exists in the current architecture.
   - All Help Center categories, FAQs, and step-by-step guides live in a single data module (`frontend/src/features/help/data/helpContent.js`), cleanly separated from presentation components (`HelpCenterPage.jsx`, `HelpAccordionItem.jsx`, `HelpNavbar.jsx`).
   - No new database tables, API endpoints, roles, or permissions were added.

2. **Existing Routing & Component Reuse**
   - Integrated directly into the existing client-side route state machine in `frontend/src/app/App.jsx` (`HELP_SUPPORT` → `/help-support`), preserving `popstate` history sync and all protected portal guards (`/patient`, `/dentist`, `/admin`).
   - Reused `ThemeToggle`, `ThemeProvider`, `EmptyState`, `LandingFooter`, `useAuth`, and the centralized Light/Dark semantic theme tokens in `frontend/src/styles/global.css`.
   - Added **Help & Support** links to both `LandingNavbar` (desktop primary pill bar and mobile drawer) and `LandingFooter` (`Policies & Care` column).

3. **Accessibility & Modern Web Standards**
   - Non-exclusive FAQ accordions use native `<button type="button" aria-expanded>` elements inside `<h3>` headings so screen reader users can navigate by heading, paired with an `Expand all / Collapse all` control whose `aria-expanded` state stays synchronized.
   - Collapsed FAQ panels use `hidden="until-found"` with a `beforematch` listener (falling back to standard `hidden` on unsupported browsers) so browser Find-in-Page reveals matching hidden answers.
   - Current-page navigation indicator uses `aria-current="page"` plus visual border/underline styling (not color alone).

4. **Clinic Contact Configuration**
   - Centralized in `frontend/src/features/help/data/clinicContact.js`.
   - Reads optional build-time environment overrides (`VITE_CLINIC_PHONE`, `VITE_CLINIC_PHONE_HREF`, `VITE_CLINIC_EMAIL`, `VITE_CLINIC_ADDRESS`, `VITE_CLINIC_TIMEZONE`).
   - Public street address is intentionally hidden unless explicitly approved and provided via `VITE_CLINIC_ADDRESS`.

---

## Items Requiring Clinic Confirmation Before Production Launch

| Item | Current Development Value | Action Needed |
|---|---|---|
| Clinic Support Email | `reception@toothcarehub.local` | Replace via `VITE_CLINIC_EMAIL` with verified clinic domain email |
| Clinic Telephone | `+63 (02) 8123-4567` | Confirm official clinic telephone via `VITE_CLINIC_PHONE` |
| Clinic Physical Address | Hidden by default | Set `VITE_CLINIC_ADDRESS` if approved for public display |
| Operating Hours | Mon–Sat `08:00 AM – 05:00 PM`, Sun Closed (`Asia/Manila`) | Confirm final clinic operating hours and holiday rules |
| Cancellation / Reschedule Cutoff | System default `24` hours (`cancellation_cutoff_hours` in `clinic_settings`) | Confirm clinic-specific late-cancellation and rescheduling exceptions |

---

## Related Documentation

- [`faq-content.md`](./faq-content.md) — Published FAQ inventory and clinic confirmation markers
- [`user-guides.md`](./user-guides.md) — Step-by-step guides mapped to implemented app workflows
- [`testing.md`](./testing.md) — Functional, responsive, theme, accessibility, and regression test coverage
