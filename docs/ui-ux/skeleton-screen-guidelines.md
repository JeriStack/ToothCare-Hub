# ToothCare Hub — Skeleton Screen Design & Implementation Guidelines

## 1. Objective & Philosophy

The **ToothCare Hub** Skeleton Screen system provides a polished, consistent, responsive, accessible, and theme-aware placeholder experience across all user roles (Administrator, Receptionist, Dentist, and Patient).

### Core Principles
1. **Prevent Cumulative Layout Shift (CLS)**: Skeletons must accurately match the height, width, padding, border radius, and flex/grid geometry of the live content they precede.
2. **Eliminate Fabricated Data**: Never display fake clinical records, dummy patient names, or fabricated status counters during loading.
3. **Role-Accurate Mental Models**: Every dashboard and module must render a skeleton layout reflecting its authentic interface (e.g. 11 KPI cards for Administrator, front desk queue for Receptionist, operatory schedule for Dentist, booking progress for Patient).
4. **Accessible by Default**: All skeleton wrappers advertise `aria-busy="true"` with a descriptive `aria-label`. Internal geometry nodes carry `role="presentation"` and `aria-hidden="true"`. Screen reader announcements use `.sr-only` text when appropriate.
5. **Theme-Aware & Motion-Conscious**: Built with ToothCare Hub tokens (`bg-slate-200/80 dark:bg-slate-700/80`), subtle pulsing animations, and automatic motion reduction via `motion-reduce:animate-none`.

---

## 2. Component Architecture

All skeleton primitives and page-level layouts reside under:
- `frontend/src/components/ui/Skeleton.jsx` (Core primitives)
- `frontend/src/components/skeletons/` (Specialized domain skeletons)

```
frontend/src/components/
├── ui/
│   └── Skeleton.jsx              # Skeleton, SkeletonText, SkeletonAvatar, SkeletonButton
└── skeletons/
    ├── index.js                  # Centralized barrel export
    ├── DashboardSkeleton.jsx     # Role-based dashboard (admin, receptionist, dentist, patient)
    ├── StatCardSkeleton.jsx      # Summary metrics and KPI cards
    ├── TableSkeleton.jsx         # Configurable data tables and table rows
    ├── CardSkeleton.jsx          # Service, dentist, and general card grids
    ├── AppointmentCardSkeleton.jsx # Patient appointment cards
    ├── AppointmentDetailSkeleton.jsx # Clinical appointment detail & treatment records
    ├── BookingStepSkeleton.jsx   # Multi-step booking wizard (services, dentists, slots)
    ├── ScheduleCalendarSkeleton.jsx # Operating hours & recurring shift calendars
    ├── ProfileSkeleton.jsx       # Staff, dentist, and patient profiles (1:2 split layout)
    ├── NotificationSkeleton.jsx  # Compact dropdown and full-page notification feeds
    ├── SystemHealthSkeleton.jsx  # Health metrics, diagnostics, and clinic parameters
    ├── ReportSkeleton.jsx        # Clinical & financial analytics, charts, and provider tables
    └── PermissionMatrixSkeleton.jsx # DRBAC role capability grid and category groups
```

---

## 3. Component Catalog & API Reference

### 3.1 `Skeleton` (Base Component)
```jsx
import { Skeleton } from '@/components/skeletons';

<Skeleton
  className="h-6 w-48 rounded-xl"
  animation="pulse" // 'pulse' | 'shimmer' | 'none'
  shape="rect"     // 'rect' | 'circle' | 'pill'
  width={200}      // number (px) or string
  height={24}      // number (px) or string
  srText="Loading confidential section"
/>
```

### 3.2 Typography & Element Primitives
```jsx
import { SkeletonText, SkeletonAvatar, SkeletonButton } from '@/components/skeletons';

// Multi-line text with natural ragging
<SkeletonText lines={3} lastLineWidth="w-3/5" gap="space-y-2" />

// Avatar with preset sizing (xs, sm, md, lg, xl, 2xl)
<SkeletonAvatar size="lg" shape="circle" />

// Buttons matching ToothCare Hub design tokens
<SkeletonButton size="md" width="w-32" />
```

### 3.3 Dashboard Skeletons
```jsx
import { DashboardSkeleton } from '@/components/skeletons';

// Supported roles: 'admin' | 'receptionist' | 'dentist' | 'patient'
<DashboardSkeleton role="admin" />
```

### 3.4 Table Skeletons
```jsx
import { TableSkeleton } from '@/components/skeletons';

// Full standalone table card
<TableSkeleton rows={6} cols={6} />

// Or nested inside existing <tbody> to preserve table headers
<table>
  <thead>...</thead>
  <tbody>
    <TableSkeleton.Rows count={5} columns={6} />
  </tbody>
</table>
```

### 3.5 Specialized Feature Skeletons
| Component | Module / Target Page | Key Props |
| :--- | :--- | :--- |
| `ProfileSkeleton` | `StaffProfilePage`, `DentistProfilePage`, `PatientProfilePage` | `title="My Profile"` |
| `NotificationSkeleton` | `NotificationCenter`, `PatientNotificationsPage` | `variant="compact" \| "page"`, `count={4}` |
| `AppointmentDetailSkeleton` | `DentistAppointmentDetailPage`, `AdminAppointmentsPage` | `onBack={fn}` |
| `SystemHealthSkeleton` | `SystemHealthPage` | — |
| `ReportSkeleton` | `ReportsPage` | — |
| `PermissionMatrixSkeleton` | `RolePermissionMatrixPage` | — |
| `CardSkeleton` | `PatientServicesPage`, `PatientDentistsPage` | `variant="service" \| "dentist"`, `count={6}` |
| `BookingStepSkeleton` | `BookAppointmentModal`, `AppointmentBookingWizard` | `step={1 \| 2 \| 3}` |
| `ScheduleCalendarSkeleton` | `FacilityHoursPage`, `DentistShiftsPage` | `view="hours" \| "shifts"` |

---

## 4. Loading States & Data-Fetching Rules

### 4.1 Initial Page Load (`loading && !data`)
- Render the dedicated layout-accurate skeleton immediately before asynchronous network data arrives.
- Enclose the skeleton container with `aria-busy="true"` and an informative `aria-label`.

### 4.2 Background Refetching (`loading && data.length > 0`)
- **Do not replace loaded content with skeletons.**
- Preserve existing content to prevent jarring visual flashes and user input disruption.
- Indicate background activity using a spinning icon (e.g., `<RefreshCw className="animate-spin text-teal-600" />`) on the refresh button or toolbar.

### 4.3 Component-Level Loading
- Use subcomponent skeletons (e.g., `TableSkeleton.Rows`, `BookingStepSkeleton.Slots`) when filtering, paginating, or switching tabs within an already-rendered view.

---

## 5. Visual Design Tokens & Dark Mode

ToothCare Hub enforces cohesive styling across light and dark color schemes:

| Token / Layer | Light Mode | Dark Mode |
| :--- | :--- | :--- |
| Skeleton Surfaces | `bg-slate-200/80` | `dark:bg-slate-700/80` |
| Container Surfaces | `bg-white` | `dark:bg-slate-800` |
| Borders | `border-slate-200/80` | `dark:border-slate-700` |
| Secondary Accent Pill | `bg-slate-100` | `dark:bg-slate-700/60` |
| Motion Class | `animate-pulse` | `motion-reduce:animate-none` |

---

## 6. Accessibility & Screen Reader Standards

1. **Role Presentation**: Base skeleton rectangles and circles must carry `role="presentation"` and `aria-hidden="true"`.
2. **Busy Region**: Skeletons that wrap an entire region or page must provide `aria-busy="true"` and a descriptive `aria-label` (e.g. `aria-label="Loading administrator executive dashboard"`).
3. **Screen Reader Announcements**: Use `<span className="sr-only">Loading content...</span>` when an isolated skeleton replaces text that screen reader users expect to be spoken.
4. **Reduced Motion**: All animations must respect `prefers-reduced-motion: reduce`. The base component incorporates `motion-reduce:animate-none` directly.

---

## 7. Testing Standards

All skeleton components and their parent page integrations must be tested in Vitest with React Testing Library:

```bash
# Run skeleton test suite
cd frontend
npm test -- --run src/tests/components/Skeleton.test.jsx

# Run entire frontend test suite
npm test -- --run
```

Key test assertions:
- Verify `aria-busy="true"` and `aria-label` presence.
- Verify child count matches requested rows or cards.
- Verify presence of `motion-reduce:animate-none` in animation classes.
- Verify smooth transition from skeleton state to rendered data upon API resolution.

---

## 8. Maintenance Checklist for New Pages

When authoring a new page or feature module in ToothCare Hub:
- [ ] Determine whether an existing skeleton component (`TableSkeleton`, `CardSkeleton`, `ProfileSkeleton`, `StatCardSkeleton`) fits the layout.
- [ ] If the page has a unique layout, author a dedicated skeleton under `frontend/src/components/skeletons/` and export it in `index.js`.
- [ ] Ensure the skeleton accurately mirrors the real grid/flex layout and spacing.
- [ ] Apply dark mode classes (`dark:bg-slate-800`, `dark:border-slate-700`).
- [ ] Verify `aria-busy="true"` and `aria-label` accessibility attributes.
- [ ] Add unit test coverage in `src/tests/components/Skeleton.test.jsx`.
- [ ] Verify test passes in CI: `npm test -- --run` and `npm run build`.
