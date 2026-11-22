# Help Center Testing & Verification

## Automated Test Suites

| Test File | Coverage |
|---|---|
| `frontend/src/tests/help/HelpCenterPage.test.jsx` | Header/mobile drawer/footer navigation links, public `/help-support` routing without authentication, hero & search across titles/answers, no-result empty state & reset, category card + pill filtering combined with search, non-exclusive accordion expand/collapse + `Expand all`/`Collapse all` `aria-expanded` sync, related guide/FAQ cross-linking, guide CTA callbacks, verified `tel:`/`mailto:` links + clipboard copy, Light/Dark theme toggle & persistence |
| `frontend/src/tests/landing/LandingNavbar.test.jsx` | Primary navigation order including `Help & Support`, `href="/help-support"`, callback invocation without triggering in-page smooth scroll, and regression coverage for all 6 section scroll-spy links |
| `frontend/src/tests/components/ResponsiveContracts.test.jsx` | Regression check for responsive component contracts |
| Full Vitest suite (`npm --prefix frontend test -- --run`) | Full frontend regression across landing, auth, patient, dentist, receptionist, admin, theme, and Help Center suites |

## Commands

```powershell
# Run Help Center & Landing tests
npx --prefix frontend vitest run src/tests/help/HelpCenterPage.test.jsx src/tests/landing/LandingNavbar.test.jsx

# Run full frontend test suite
npm --prefix frontend test -- --run

# Production bundle verification
npm --prefix frontend run build
```

## Live Browser Checks

Verify `/help-support` across mobile (`375×812`), tablet (`768×1024`), and desktop (`1440×900`) viewports in both Light Mode and Dark Mode:

- Zero horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth`).
- Search input, category cards, FAQ filter pills, accordion triggers, and contact copy buttons meet touch-target sizing and visible focus ring standards.
- Keyboard-only navigation (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape` on mobile drawer) operates cleanly across all sections.
