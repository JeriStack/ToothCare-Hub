# Help Center FAQ Content Inventory

Source of truth: `frontend/src/features/help/data/helpContent.js` (`HELP_FAQS`).

All 19 FAQ entries below reflect implemented ToothCare Hub behavior. Items marked **Clinic Confirmation Required** describe configurable clinic settings or contact details that clinic management must confirm before production publication.

---

## Account & Login

1. **How do I create a ToothCare Hub account?** (`faq-create-account`)
   - Grounded in `RegisterForm.jsx` (`/register`) and `VerifyEmailPage.jsx` (`/verify-email`).
2. **How do I log in?** (`faq-login`)
   - Grounded in `LoginForm.jsx` (`/login`) and role-based portal routing in `App.jsx`.
3. **What should I do if I forget my password?** (`faq-forgot-password`)
   - Grounded in `ForgotPasswordPage.jsx` (`/forgot-password`, neutral anti-enumeration response).
4. **How can I recover access to my account?** (`faq-recover-access`)
   - Covers password reset, resending verification links at `/verify-email`, and reception identity verification.

## Appointments

5. **How do I book a dental appointment?** (`faq-book-appointment`)
   - Grounded in `BookAppointmentPage.jsx` (4-step wizard + confirmation screen).
6. **How do I select a dental service?** (`faq-select-service`)
   - Grounded in `ServicesSection.jsx` and Step 1 of `BookAppointmentPage.jsx`.
7. **Can I choose a dentist?** (`faq-choose-dentist`)
   - Grounded in `DentistsSection.jsx` and Step 2 of `BookAppointmentPage.jsx`.
8. **How do I check my appointment status?** (`faq-check-status`)
   - Grounded in `AppointmentHistoryPage.jsx` (`/patient/appointments`).
9. **What does Pending mean?** (`faq-status-pending`)
   - Grounded in `AppointmentService.php` (`STATUS_PENDING`).
10. **What does Confirmed mean?** (`faq-status-confirmed`)
    - Grounded in `AppointmentService.php` (`STATUS_CONFIRMED`).
11. **Can I cancel my appointment?** (`faq-cancel-appointment`) — **Clinic Confirmation Required**
    - Grounded in `AppointmentService.php` (`cancelAppointment`, `cancellation_cutoff_hours` default `24` hours for `CONFIRMED` visits). Clinic-specific late-cancellation exceptions must be confirmed by clinic management.
12. **Can I reschedule my appointment?** (`faq-reschedule-appointment`) — **Clinic Confirmation Required**
    - Grounded in `AppointmentService.php` (`reschedule`, creates linked `rescheduled_from_id` `PENDING` request). Clinic-specific rescheduling notice limits must be confirmed by clinic management.

## Dental Services

13. **How are dental service durations, fees, and dentist availability determined?** (`faq-service-info-and-availability`) — **Clinic Confirmation Required**
    - Grounded in `AvailabilitySlotPicker` and `AppointmentService.php` (10-minute sanitization buffer, `Asia/Manila` hours, dentist shifts & approved leaves). Final in-clinic treatment costs are confirmed by the attending dentist.

## Notifications

14. **Will I receive an email after booking?** (`faq-email-after-booking`)
    - Grounded in transactional `email_outbox` + `PHPMailer` worker.
15. **How will I know if my appointment is confirmed?** (`faq-know-confirmed`)
    - Grounded in email outbox + Socket.IO real-time Notification Center (`/patient/notifications`).
16. **What should I do if I do not receive an email?** (`faq-missing-email`)
    - Covers async delivery delay, spam/junk folders, `/verify-email` resend, and checking live status in My Appointments.

## General

17. **Do I need an account to book an appointment?** (`faq-need-account`)
    - Public browsing vs. authenticated patient booking/tracking.
18. **Can I access ToothCare Hub using my phone?** (`faq-mobile-access`)
    - Responsive mobile-first UI + Light/Dark Mode support.
19. **How can I contact the clinic?** (`faq-contact-clinic`) — **Clinic Confirmation Required**
    - Directs users to Section E (`#help-contact`) and includes the dental emergency guidance. Verified clinic phone, email, and approved address must be configured via `VITE_CLINIC_*`.
