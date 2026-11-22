# Phase 16 — Frontend Testing Guide (Vitest 5 + React Testing Library)

## Commands

```powershell
# Run full frontend suite once
npm --prefix frontend test -- --run

# Watch mode during local development
npm --prefix frontend run test:watch

# Generate V8 coverage report (text, HTML, JSON summary)
npm --prefix frontend run test:coverage

# Run Phase 16 regression suite
npm --prefix frontend test -- --run src/tests/phase16/Phase16RegressionCoverage.test.jsx

# Verify production build
npm --prefix frontend run build
```

## Coverage Areas

- **Authentication**: `authSchema.test.js`, `Phase16RegressionCoverage.test.jsx` (`LoginForm` validation & server error display).
- **Dashboards & Reports**: `Phase15DashboardsReportsSearch.test.jsx` (all 7 live admin metrics, zero hardcoded fallback data, operational utilization reports, date-range validation).
- **Appointments & Clinical**: `AdminAppointmentsPage`, `TreatmentRecordEditor.test.jsx`, `PatientProfilePage.test.jsx`, `DentistProfilePage.test.jsx`, `StaffProfilePage.test.jsx`.
- **Notifications & Real-Time**: `PatientNotificationsPage.test.jsx`, `Phase16RegressionCoverage.test.jsx` (REST recovery & read state).
- **Theme, Skeletons, & Responsive Contracts**: `ThemeContext.test.jsx`, `Skeleton.test.jsx`, `GlobalLoadingBar.test.jsx`, `ResponsiveContracts.test.jsx`, `LandingAnimations.test.jsx`.
