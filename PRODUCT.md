# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Patients** use the web app to register or sign in, browse dental services and dentists, request appointments, track appointment status, and cancel when clinic policy allows.
- **Admins / receptionists** manage patient and clinic records, services, dentist schedules, and appointment requests.
- **Dentists** review assigned appointments, access permitted patient visit context, and record diagnosis and treatment notes.

## Product Purpose

ToothCare Hub helps dental clinics manage appointments and related patient workflows digitally, replacing manual appointment request tracking. Success means patients can request and follow appointments while clinic staff can coordinate care without conflicting bookings or losing appointment records when notification services are unavailable.

## Positioning

Appointment availability is validated against dentist schedules, time off, and service durations, with transaction-safe database locking to prevent conflicting bookings. Notifications and email-outbox records are persisted with the booking transaction; external email and realtime delivery happen after commit.

## Operating Context

The product is a browser-based clinic management system. Patients submit appointment requests; admins or receptionists review requests and manage clinic information; dentists review assigned visits and record treatment information. Appointment statuses include `PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`, and `COMPLETED`.

## Capabilities and Constraints

- The project plan defines the initial-release scope; it is a target, not proof that every capability is implemented. Verify the current application before describing planned features as shipped.
- Role boundaries distinguish `PATIENT`, `DENTIST`, and `ADMIN` access.
- The planned MVP includes authentication and profile management; authorized patient-record management; dentist profiles and schedules; a service catalogue with prices and durations; appointment requests, review, cancellation, and history; treatment records; persistent notifications with email and realtime delivery; basic appointment reports; and quality tooling.
- Patients can browse active services and dentists, check availability, request appointments, track status, and cancel only as clinic policy permits.
- Admins and receptionists manage patient records, dentist profiles, services, pricing, working schedules, and appointment requests. They may create a request for a patient only with an audit trail.
- Dentists view assigned appointments and only the patient context needed for those visits, record appropriate treatment notes for authorized visits, and complete eligible visits. They do not approve appointment requests by default.
- Appointment state transitions are authorized and validated by the backend. Retain status history and show records according to role and ownership.
- Support responsive use across mobile, tablet, laptop, and desktop. Provide semantic controls, visible keyboard focus, labels, keyboard operation, readable contrast, and useful validation messages.
- MySQL with InnoDB and the native PHP REST API are the authoritative system of record.
- SMTP email delivery and Socket.IO notifications are side effects after a successful database commit; their outages must not roll back a saved appointment.
- Appointment slot validation must account for dentist working hours, blocked periods, service duration, and overlapping time intervals; concurrent requests must not create conflicting bookings.
- Minimize exposure of personal and health-related data. Do not put clinical notes or unnecessary patient details in ordinary email, realtime events, logs, or metrics.
- The initial release excludes full EHR/clinical decision support, autonomous diagnosis or treatment recommendations, online payments, and unreviewed claims of legal certification or compliance. Payments/refunds, insurance processing, SMS, waitlists, recurring appointments, multiple clinic branches, calendar integrations, and native mobile apps are later enhancements rather than MVP commitments.
- Do not infer clinic rules that the plan leaves open: cancellation and rescheduling windows, no-show handling, email verification scope, and whether patients may view treatment records require an explicit policy.

## Brand Commitments

- Product name: ToothCare Hub.
- Tagline: “Healthier Smiles. Brighter Futures.”

## Evidence on Hand

The repository contains application code, API and architecture documentation, database migrations, and development seed data. Development seed data is synthetic. No real clinic endorsements, patient testimonials, or clinical outcome evidence have been confirmed; future work must not invent them.

## Product Principles

- Prevent conflicting bookings with server-side availability checks and transaction-safe persistence.
- Enforce authentication, role permissions, and resource ownership on every API request.
- Keep saved appointment records reliable even when email or realtime services are unavailable.
- Give patients, clinic staff, and dentists workflows appropriate to their roles.
- Minimize sensitive data exposure and do not imply medical advice, clinical certification, or legal compliance without evidence.

## Accessibility & Inclusion

The project plan requires semantic HTML, visible focus states, labeled controls, keyboard operation, readable contrast, useful validation messages, and responsive layouts for mobile through desktop.
