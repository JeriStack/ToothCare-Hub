# ToothCare Hub — Open Decisions & Assumptions Register

**Document ID:** `TCH-P3-ODA-001`  
**Version:** `1.0.0`  
**Phase:** Phase 3 — Requirements, User Journeys, Wireframes, and Design System  
**Prepared Date:** `2026-10-27`  
**Status:** Approved Baseline  
**Author:** Lead Business Analyst & Enterprise Architect  

---

## 1. Register Overview

This document records the foundational architectural decisions, operational assumptions, policy constraints, and scope boundaries established for **Phase 3 — Requirements, User Journeys, Wireframes, and Design System**.

It serves as the definitive reference to prevent undocumented assumptions from silently entering frontend or backend implementation.

---

## 2. Approved Architectural & Policy Decisions

| Decision ID | Area | Baselined Policy / Decision | Rationale | Impact on Phase 3 UX |
| :--- | :--- | :--- | :--- | :--- |
| **`DEC-P3-001`** | Temporal Anchor | Explicit clinic timezone: **`Asia/Manila` (`UTC+08:00`)**. No Daylight Saving Time. | Eliminates cross-device timezone drift for patients and overseas clinic staff. | All UI pickers, slot grids, and timestamps format strictly in `Asia/Manila`. |
| **`DEC-P3-002`** | Scheduling Grid | Standard **30-minute start-time grid** (`09:00`, `09:30`, `10:00`, ...). Services take 30, 45, 60, or 90 minutes. | Balances clinic chair utilization with predictable patient arrival cadences. | 45-min services block two consecutive 30-min slots with 15-min recovery buffer. |
| **`DEC-P3-003`** | Booking Horizon | **Min 2 hours** advance notice; **Max 60 calendar days** booking horizon. | Prevents unreviewed walk-in conflicts; protects against stale future schedule locks. | Calendar picker disables dates outside the $[t+2\text{h}, t+60\text{d}]$ window. |
| **`DEC-P3-004`** | Slot Blocking | Slots are blocked by **both `PENDING` and `CONFIRMED`** appointments. | Defends against double-booking races while receptionists review pending requests. | Availability query checks `status IN ('PENDING', 'CONFIRMED')`. |
| **`DEC-P3-005`** | Cancellation Rule | Patient self-cancellation: `PENDING` anytime; `CONFIRMED` **$\ge 24$ hours prior** to `start_at`. | Respects patient flexibility while protecting dentist chair revenue against late no-shows. | Detail drawer hides self-service cancel button if $< 24$ hours remain; directs to phone call. |
| **`DEC-P3-006`** | Rescheduling Model | **Atomic cancel-and-rebook** linking the new request to `rescheduled_from_id`. | Guarantees slot release of old appointment only when new appointment successfully commits. | Wizard pre-populates previous service/dentist; confirms cancel-and-rebook atomically. |
| **`DEC-P3-007`** | Clinical Notes | Authored **exclusively by assigned dentist**; editable up to **24 hours post-completion**. | Safeguards medical record integrity; accommodates reasonable same-day dictation edits. | Dentist treatment form enters read-only state after 24h; all revisions generate audit rows. |
| **`DEC-P3-008`** | Real-Time Sync | MySQL is primary store of truth; Socket.IO is transient delivery; REST delta sync on reconnect. | Guarantees zero missed notifications during network drops, tab sleeping, or socket crashes. | UI tracks connection state; reconnect triggers `GET /api/notifications?since=...`. |
| **`DEC-P3-009`** | Unified Role Model | Single `ADMIN` role for both receptionists and clinic administrators in MVP. | Simplifies MVP RBAC while fulfilling all reception, triage, and management requirements. | Admin dashboard unites reception triage queue with clinic management settings. |

---

## 3. Scope Boundaries & Explicit Non-Goals (Out of Scope for MVP)

To maintain focus on core clinic operations, the following features are explicitly confirmed as **Out of Scope for Phase 3 and the MVP**:

1. **Online Payment Gateways (Stripe, GCash, Maya):** Patients pay at the clinic reception upon treatment completion (Cash, Card, QR). No payment forms or credit card inputs are designed.
2. **SMS Gateway Integration (Twilio / Semaphore):** In-app notifications and background email delivery (`email_outbox`) fulfill notification requirements. SMS is deferred to Phase 2.
3. **Multi-Branch Clinic Infrastructure:** All operatory chairs, schedules, and staff belong to the primary clinic location. Multi-tenant clinic routing is deferred.
4. **Interactive Dental Odontograms & DICOM X-Ray Viewers:** Clinical treatment notes utilize FDI two-digit tooth selection buttons (11–48) and structured textareas. Complex graphical odontogram charting is deferred.

---

## 4. Verification & Sign-Off

- **Lead Systems Architect:** Verified & Baselined
- **Senior UI/UX Designer:** Baselined in Wireframes & Design System
- **Product Owner:** Approved for Phase 3 Exit
