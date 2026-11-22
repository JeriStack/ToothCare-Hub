# Help Center Step-by-Step User Guides

Source of truth: `frontend/src/features/help/data/helpContent.js` (`HELP_GUIDES`).

Each guide corresponds directly to implemented UI flows in the repository—no unimplemented workflows or fabricated screenshots are included.

| Guide ID | Title | Application Workflow Mapped | Next-Step Action |
|---|---|---|---|
| `guide-create-account` | How to Create a Patient Account | `RegisterForm.jsx` (`/register`) + `VerifyEmailPage.jsx` (`/verify-email`) | Navigates to `/register` |
| `guide-login` | How to Log In to Your Portal | `LoginForm.jsx` (`/login`) + `App.jsx` role routing | Navigates to `/login` (or active portal if signed in) |
| `guide-book-appointment` | How to Book a Dental Appointment | `BookAppointmentPage.jsx` (`/patient/book` 4-step wizard) | Opens booking flow (or `/login` if unauthenticated) |
| `guide-check-status` | How to Check Your Appointment Status | `AppointmentHistoryPage.jsx` (`/patient/appointments`) | Navigates to `/login` / active portal |
| `guide-cancel-reschedule` | How to Cancel or Reschedule an Appointment | `AppointmentHistoryPage.jsx` Cancel & Reschedule modals + `AppointmentService.php` | Navigates to `/login` / active portal |
| `guide-reset-password` | How to Reset a Forgotten Password | `ForgotPasswordPage.jsx` (`/forgot-password`) + `ResetPasswordPage.jsx` (`/reset-password`) | Navigates to `/forgot-password` |

## Cross-Linking

- Every FAQ links directly to its relevant step-by-step guide(s) (`relatedGuideIds`).
- Every step-by-step guide links directly to its related FAQ items (`relatedFaqIds`); clicking a related FAQ clears conflicting filters if necessary, expands the FAQ item, scrolls it into view, and moves keyboard focus to its trigger button.
