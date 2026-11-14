# Responsive Design Guidelines

Applies to the React + Vite + Tailwind CSS 3 frontend in `frontend/`. The project uses plain JSX with Lucide icons and its own component set in `src/components/ui`. It does not use TypeScript or shadcn/ui.

## 1. Breakpoint strategy

Mobile-first. Use Tailwind's default breakpoints and add rules upward (`sm:`, `md:`, `lg:`). Do not write `max-width` overrides, except for the table-to-card rules in `global.css`.

| Tailwind | Min width | Shell behaviour |
|---|---:|---|
| (base) | 0 | Top header with hamburger, off-canvas drawer, single column |
| `sm` | 640px | Wider header padding, 2-column card grids where useful |
| `md` | 768px | Tables switch from stacked cards to real tables |
| `lg` | 1024px | Persistent sidebar (collapsible), drawer is disabled |
| `xl` | 1280px | Wider gutters |

Dashboard grids use container queries on `.portal-main-shell` (`.portal-grid-*`, `.portal-split-*` in `global.css`). A card grid then reacts to the space left beside the sidebar, not to the viewport. Prefer those classes to hand-written `grid-cols-*` for stat cards and two-pane splits.

## 2. Layout rules

- Page-level horizontal scrolling is a defect. The shell root uses `overflow-x-clip`.
- Flex or grid children that contain long text need `min-w-0`. Use `.tch-wrap-anywhere` for emails, IDs and license numbers.
- Prefer `minmax(0, 1fr)`, `max-w-*` and `w-full` over fixed pixel widths.
- Use `dvh` rather than `vh` for full-height surfaces.
- Add `.tch-safe-bottom` to bottom-anchored actions so they clear the iOS home indicator.

## 3. Navigation

One role-aware navigation model (`getSidebarSections` in `src/app/App.jsx`) feeds both the persistent sidebar and the drawer. Never fork it per role.

| Viewport | Behaviour |
|---|---|
| below `lg` | Hamburger opens an off-canvas drawer with a backdrop. |
| `lg` and up | Persistent sidebar. The user's collapsed or expanded choice is saved in `localStorage` (`toothcare_sidebar_collapsed`). |

Drawer contract (verified by `e2e/responsive-interaction-check.mjs`):

1. Opens from the hamburger (`aria-expanded`, `aria-controls="portal-sidebar"`).
2. Focus moves to the close button, and Tab is trapped inside the drawer.
3. Escape, a backdrop click, or choosing a route closes it. Focus returns to the hamburger.
4. `body` scrolling is locked while it is open.
5. It closes itself if the viewport grows to `lg`.
6. The drawer must be `visibility: visible` the moment it opens. A hidden element cannot receive focus, and a `visibility` transition holds the start value at t=0. For that reason only the *closing* state transitions `visibility`. Do not put `visibility` in the transition list for the open state.

The theme toggle and account menu stay in the header at every size.

## 4. Tables

| Pattern | When |
|---|---|
| `tch-responsive-table` + `data-label` on each `<td>` | Default. Rows become labelled cards below `md`. The `<thead>` stays in the accessibility tree. |
| `MobileSortControl` | Replaces the clickable `<th>` sort headers while the table is shown as cards. Pass the page's existing `handleSort`. |
| `.tch-matrix-table` | The DRBAC permission matrix (capability + role toggles). |
| `overflow-x-auto` wrapper | Only when the table structure itself is the content. |

Rules: the last cell holds the actions, and they remain tappable (44px on touch). Permission checks are made before rendering the actions, never through CSS. Do not put anything in the card view that the table view hides for authorization reasons. Both views render from the same DOM.

Any file that renders `<MobileSortControl>` must import it. `ResponsiveContracts.test.jsx` enforces this, because a missing import crashed three pages.

## 5. Forms and dialogs

- Inputs are `w-full`. The shared `Input` uses `text-base sm:text-sm`, so the font is 16px on mobile and iOS does not zoom on focus.
- Use `grid-cols-1 sm:grid-cols-2` for field pairs. Labels sit above fields.
- Button rows wrap (`flex-wrap`), and primary actions go full width on mobile.
- Dialogs use the shared `Modal`. It is a bottom sheet on mobile and a centred dialog from `sm`, with `max-h` in `dvh`, internal scrolling, and header and footer kept visible.

## 6. Calendar and scheduling

Slot pickers wrap as a grid of tappable buttons, not as fixed columns. Do not change the Phase 9 availability rules or the Phase 10 lifecycle when adjusting layout.

## 7. Theme compatibility

There is a single `ThemeProvider` with `light` (default) and `dark`. There is no System/Auto mode. Use semantic tokens (`bg-surface`, `text-foreground`, `border-line`) or the existing `dark:` variants. Do not read `prefers-color-scheme`, and do not keep theme state in pages. Layout classes must not depend on theme.

## 8. Accessibility

- Minimum target size is 24×24 CSS px (WCAG 2.2 SC 2.5.8). On touch devices (`pointer: coarse`) aim for about 44px.
- Text-link style buttons use `.tch-tap`. Native checkboxes use `.tch-check`.
- Every interactive element has a visible `:focus-visible` ring.
- Status is never colour-only. `StatusBadge` carries a label and a dot.
- Respect `prefers-reduced-motion`.

## 9. Validation matrix

| Viewport | Class |
|---|---|
| 320×568 | Small mobile |
| 375×812 / 390×844 / 430×932 | Mobile |
| 768×1024 | Tablet |
| 1024×768 | Large tablet / small laptop |
| 1280×800 / 1440×900 / 1920×1080 | Laptop / desktop |

Each in Light and Dark.

Local tools (the dev stack must be running, with demo accounts from `database/seeds/002_canonical_demo_accounts.sql`):

```
cd frontend
node e2e/responsive-audit.mjs [--roles=admin,patient] [--viewports=320,768] [--themes=light] [--shots]
node e2e/responsive-interaction-check.mjs        # drawer, focus, scroll lock, theme persistence
node e2e/booking-flow-check.mjs [--shots]        # patient booking wizard, 6 viewports, Manila-time checks
node e2e/dialog-check.mjs [--viewports=320,1280] # every dialog: fit, ARIA, focus trap, Escape, focus return
node e2e/treatment-form-check.mjs [--shots]      # dentist treatment-record editor + odontogram
node e2e/stress-check.mjs [--sections=A,B,C]     # A: tables with long data, B: skeleton layout shift, C: permissions
```

All of these fake non-GET API calls in the browser, so they never write to the database. `stress-check` alters only the GET responses it receives (to enlarge lists), and only inside the test browser.

The audit writes `test-results/responsive-audit/report.json`. It measures page overflow, off-screen elements, targets under 24px, console errors and failed API calls. It cannot judge visual quality, so review screenshots (`--shots`) of dense pages at 320px.

CI runs `npm test` and `npm run build`. Those include `ResponsiveContracts.test.jsx`. The browser tools above need a seeded backend and are not run in CI.

### Clinical forms and the odontogram

- The treatment-record editor is about 2,700px tall at 320px. Show validation and server errors **next to the Save button** (not at the top), with `role="alert"`, and move focus to the alert so it is seen and announced. Mark fields `aria-invalid`.
- Action rows stack full-width on phones (`flex-col-reverse`, `[&>button]:min-h-11`) and go inline from `sm`.
- Odontogram tooth buttons are 44px tall. The grid is 4 columns below 460px and 8 above, and each arch splits into two quadrants from `lg`.
- Label + character-counter rows use `items-start gap-2` with `shrink-0 whitespace-nowrap` on the counter so the counter never wraps.

### Skeletons and layout shift

- A skeleton row should be about as tall as a loaded row, because the footer and pagination below the table jump by the difference. `TableSkeleton.Rows` renders two lines per cell from `md` and three at `md` to `lg`, and 9 rows (the typical page).
- Measure with `stress-check` section B. It reports layout shift (CLS) per route; the target is 0.1 or less.

## 10. Checklist for a new page

- [ ] No horizontal page scroll at 320px in both themes.
- [ ] Grids use `.portal-grid-*` / `.portal-split-*` or `minmax(0, 1fr)`.
- [ ] Tables use `tch-responsive-table` with `data-label`, plus `MobileSortControl` if sortable.
- [ ] Skeleton matches the loaded layout (see `skeleton-screen-guidelines.md`).
- [ ] Empty and error states render at 320px.
- [ ] Controls are at least 24px (44px on touch). Link-style buttons use `tch-tap`.
- [ ] Long text wraps (`min-w-0`, `tch-wrap-anywhere`).
- [ ] Actions are permission-gated in code, not hidden by CSS.
- [ ] Checked in Light and Dark.

## 11. Known open items

- Search placeholders must fit 320px (about 30 characters), and a global rule ellipsizes any overflow. A global rule also forces form fields to 16px below 640px (verified: no field is smaller on any of 28 routes at 320px).
- `/admin/triage` at 768px still shifts by 0.106 while loading (target 0.1). Real rows wrap to three lines there and the table header changes height once content sets the column widths. At 1440px it is 0.039.
- A user without permission who opens a restricted admin URL (for example a receptionist at `/admin/audit`) sees an empty content area. Access is correctly denied at every size, but there is no "access restricted" message. This is a product decision, not a responsive one.
- The app has no chart library. Its visuals are stat tiles, the request-lifecycle stepper, the booking progress bar and the odontogram. All are fluid grids, and none have fixed widths.
- ESLint is not a project dependency (`frontend/eslint.config.js` is empty). A one-off run with recommended + react-hooks rules over `src` found no undefined identifiers or JSX components, 2 empty `catch {}` blocks and 17 warnings (unused variables, hook dependency arrays) in code unrelated to this work.
- TypeScript only covers the Playwright files, and `tsc --strict --noEmit` on them is clean.
- All validation used Chromium emulation. No physical device was tested.
