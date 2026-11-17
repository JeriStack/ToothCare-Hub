# Phase 10: Appointment Booking and Lifecycle

## Overview
Phase 10 implements the central appointment booking and lifecycle engine for **ToothCare Hub**. It establishes:
1. Patient-facing multi-step booking wizard with dynamic availability recalculation.
2. Robust concurrency safety with MySQL InnoDB pessimistic locking (`SELECT ... FOR UPDATE`) on target dentist records to prevent concurrent double-booking.
3. Strict finite state machine lifecycle transitions: `PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`, and `COMPLETED`.
4. Immutable transition history tracking in `appointment_status_history` logging actor, timestamp, previous status, next status, and reasoning.
5. Atomic rescheduling implementing **Option A (Cancel-and-Create)** linking historical appointments via `rescheduled_from_id`.
6. Administrative triage and review queue with server-side filtering, pagination, and one-click confirmation/rejection modals.
7. End-to-end integration with Phase 7 authentication/RBAC, Phase 8 catalogs, and Phase 9 `AvailabilityService`.

---

## Directory Index

| Document | Purpose |
| :--- | :--- |
| [BOOKING_WORKFLOW.md](BOOKING_WORKFLOW.md) | Multi-step booking pipeline, client-side wizard, and server-side validation |
| [APPOINTMENT_LIFECYCLE.md](APPOINTMENT_LIFECYCLE.md) | Lifecycle state transition matrix, terminal states, and audit trails |
| [TRANSACTION_STRATEGY.md](TRANSACTION_STRATEGY.md) | Concurrency protection, pessimistic row locking, and rollback boundaries |
| [RESCHEDULING_POLICY.md](RESCHEDULING_POLICY.md) | Cancel-and-create architecture, reference linking, and patient rules |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | RESTful API specifications for patient and administrative endpoints |
| [SECURITY_AND_AUTHORIZATION.md](SECURITY_AND_AUTHORIZATION.md) | Authentication checks, RBAC authorization, ownership enforcement, CSRF |
| [TESTING.md](TESTING.md) | PHPUnit unit, integration, and high-concurrency race condition test coverage |
| [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) | Comprehensive engineering delivery summary and verification evidence |

---

## Core Domain Principles
1. **Zero Client Trust:** The client only supplies `dentist_id`, `service_id`, `start_at`, and optional `chief_complaint`. Duration, fee, and patient identity are strictly resolved on the server side from database records and authenticated sessions.
2. **Pessimistic Concurrency Safety:** When validating and booking a slot, the target dentist record is locked with `SELECT id FROM dentists WHERE id = :id FOR UPDATE`. This serializes concurrent booking requests for the same provider, preventing race conditions.
3. **No Duplicate Engines:** Availability re-verification during booking directly invokes Phase 9 `AvailabilityService::isSlotAvailable()`.
4. **Immutable History:** Every change of status automatically writes a persistent audit entry into `appointment_status_history` within the same database transaction.
