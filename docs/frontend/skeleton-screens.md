# ToothCare Hub — Skeleton Screen Design System & Guidelines

**System:** ToothCare Hub — Dental Appointment and Clinic Management System  
**Component:** Frontend Skeleton Screen Subsystem  
**Design Guide:** Impeccable Agent / ToothCare Hub Design System  
**Framework:** React 18 + Tailwind CSS + Vitest  
**Version:** 1.0.0-Production  

---

## 1. Overview & Objectives

ToothCare Hub implements a comprehensive, reusable, accessible, and responsive skeleton screen system across all public, patient, dentist, and administrator portals.

The skeleton screens:
- Preserve exact layout geometry and card dimensions, preventing Cumulative Layout Shifts (CLS).
- Deliver immediate visual feedback during asynchronous API and database requests.
- Eliminate jarring content pop-in and flashes of unstyled or zero-value states.
- Support both Light Mode and Dark Mode via theme-aware tokens (`bg-slate-200/80 dark:bg-slate-700/80`).
- Fully respect accessibility standards with `aria-hidden="true"`, `aria-busy="true"`, and `motion-reduce:animate-none`.

---

## 2. Component Inventory

```text
src/
├── components/
│   ├── ui/
│   │   └── Skeleton.jsx              # Base theme-aware pulsing surface
│   └── skeletons/
│       ├── StatCardSkeleton.jsx      # KPI & clinical metric cards
│       ├── TableSkeleton.jsx         # Data registries (Patients, Dentists, Services, Appointments)
│       ├── CardSkeleton.jsx          # Service and Dentist roster profile cards
│       ├── AppointmentCardSkeleton.jsx # Patient and Dentist appointment cards
│       ├── DashboardSkeleton.jsx     # Composite Patient, Dentist, and Admin dashboards
│       ├── BookingStepSkeleton.jsx   # 4-Step booking wizard and dynamic slot picker
│       ├── ScheduleCalendarSkeleton.jsx # Operating hours and weekly shift schedule grid
│       └── index.js                  # Centralized barrel export
```

---

## 3. Base Component: `Skeleton.jsx`

### Usage
```jsx
import { Skeleton } from '@/components/ui/Skeleton';

// Basic rectangular bar
<Skeleton className="h-4 w-48" />

// Circular avatar
<Skeleton className="w-12 h-12 rounded-full" />

// Rounded card box with shimmer animation
<Skeleton animation="shimmer" className="h-32 w-full rounded-2xl" />
```

### Props
| Prop | Type | Default | Description |
|---|---|---|---|
| `className` | `string` | `''` | Tailwind CSS dimension, radius, margin, and layout classes |
| `animation` | `'pulse' \| 'shimmer' \| 'none'` | `'pulse'` | Animation style (`motion-reduce:animate-none` applied automatically) |
| `children` | `ReactNode` | `undefined` | Optional nested placeholder elements |

---

## 4. Shared Skeleton Variants

### 4.1 `StatCardSkeleton`
Replicates executive and clinical KPI cards:
```jsx
import { StatCardSkeleton } from '@/components/skeletons';

// Renders 4 KPI cards in responsive grid
<StatCardSkeleton count={4} />
```

### 4.2 `TableSkeleton`
Configurable for any administrative data registry:
```jsx
import { TableSkeleton } from '@/components/skeletons';

// Standalone table with header, rows, and pagination
<TableSkeleton
  rows={6}
  columns={['w-16', 'w-48', 'w-32', 'w-24', 'w-20']}
  showHeader={true}
  showPagination={true}
/>

// Inside an existing <tbody> during background refetch
<tbody>
  {loading ? (
    <TableSkeleton.Rows count={5} columns={6} />
  ) : (
    data.map(...)
  )}
</tbody>
```

### 4.3 `CardSkeleton`
Supports specialized clinical card variants:
```jsx
// 1. Dental Procedure Cards (Services catalog)
<CardSkeleton variant="service" count={6} />

// 2. Licensed Practitioner Cards (Dentist roster)
<CardSkeleton variant="dentist" count={3} />

// 3. General Clinical Cards
<CardSkeleton variant="general" count={4} />
```

### 4.4 `AppointmentCardSkeleton`
Exact layout match for patient visits and dentist schedules:
```jsx
<AppointmentCardSkeleton count={4} />
```

### 4.5 `DashboardSkeleton`
Composite skeleton matching entire role-specific dashboards:
```jsx
// Patient portal (greeting, next visit banner, quick metrics, upcoming visits)
<DashboardSkeleton role="patient" />

// Administrator portal (4 KPI cards, 5 triage pills, recent tables)
<DashboardSkeleton role="admin" />

// Dentist clinical practice (7-day shift grid, consultation roster)
<DashboardSkeleton role="dentist" />
```

### 4.6 `BookingStepSkeleton`
Specialized for the 4-step dental booking wizard:
```jsx
// Stepper stages: 1 (Services), 2 (Dentists), 3 (Date/Slots), 4 (Review)
<BookingStepSkeleton step={step} />

// Isolated dynamic slot pills inside AvailabilitySlotPicker
<BookingStepSkeleton.Slots count={8} />
```

### 4.7 `ScheduleCalendarSkeleton`
For administrative schedule planning:
```jsx
<ScheduleCalendarSkeleton view="hours" />  {/* Weekly facility operating hours */}
<ScheduleCalendarSkeleton view="shifts" /> {/* 7-day recurring dentist shifts grid */}
```

---

## 5. Asynchronous UI State Architecture

Every data-driven view adheres to the **Loading → Success → Empty → Error** lifecycle:

```jsx
// 1. Loading State: Structured layout skeleton
if (loading && items.length === 0) {
  return <TableSkeleton rows={6} columns={['w-16', 'w-48', 'w-32']} />;
}

// 2. Error State: Clear diagnostic banner with retry trigger
if (error) {
  return (
    <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200">
      <p>{error}</p>
      <button onClick={refetch}>Try Again</button>
    </div>
  );
}

// 3. Empty State: Engaging actionable feedback
if (items.length === 0) {
  return (
    <EmptyState
      icon={Stethoscope}
      title="No records found"
      description="Registered entries will appear here."
      actionLabel="Create Entry"
      onAction={openModal}
    />
  );
}

// 4. Success State: Real database-backed content
return <DataTable items={items} />;
```

---

## 6. Accessibility & Motion Guidelines

1. **Screen Readers**:
   - Every individual skeleton element carries `role="presentation"` and `aria-hidden="true"`.
   - The outer loading container carries `aria-busy="true"` and an informative `aria-label` (e.g. `aria-label="Loading clinical metrics"`).
2. **Reduced Motion**:
   - `motion-reduce:animate-none` is embedded in the base Skeleton class, immediately pausing animations when the operating system preference `prefers-reduced-motion: reduce` is active.
3. **Non-Interactive**:
   - Skeletons are never focusable and contain no tab stops.

---

## 7. Testing & Verification

Run the Vitest component test suite:
```bash
cd frontend
npm run test
```

Build the production bundle:
```bash
cd frontend
npm run build
```
