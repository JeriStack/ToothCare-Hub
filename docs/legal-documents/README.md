# ToothCare Hub — Legal Documents & User Consent Management

> **Status Notice:** Software implementation is complete and tested. Initial Terms of Service (`v1.0`) and Privacy Policy (`v1.0`) text are **DRAFT — NOT APPROVED FOR PRODUCTION** and must be reviewed and approved by clinic leadership and a qualified Philippine privacy/legal adviser prior to public production release.

## Overview

This feature adds publicly accessible **Terms of Service** (`/terms-of-service`) and **Privacy Policy** (`/privacy-policy`) pages, mandatory legal agreement verification during patient registration, immutable server-side acceptance records in MySQL, versioned document lifecycle management, controlled re-acceptance for material policy updates, Audit Trail integration, and strict DRBAC authorization.

## Architecture Summary

| Layer | Implementation |
|---|---|
| Database Migration | [033_create_legal_documents_and_acceptances.sql](../../database/migrations/033_create_legal_documents_and_acceptances.sql) + [rollback](../../database/migrations/rollback/033_rollback_legal_documents_and_acceptances.sql) |
| Repositories | `LegalDocumentRepository`, `UserLegalAcceptanceRepository` |
| Validation & Service | `LegalValidator`, `LegalService`, integrated with `AuthValidator` & `AuthService` |
| REST API Controller | `LegalDocumentController` (`/api/v1/legal/*`, `/api/v1/admin/legal/*`) |
| Public Frontend Pages | `TermsOfServicePage` (`/terms-of-service`), `PrivacyPolicyPage` (`/privacy-policy`), `LegalDocumentLayout` |
| Consent & Re-Acceptance UI | `RegisterForm` (non-sensitive `sessionStorage` draft recovery + versioned acceptance payload), `LegalReacceptanceModal`, `LandingFooter` |
| Audit Trail & DRBAC | Existing `AuditLogRepository` (`audit_logs`) & `AuthorizationMiddleware::hasPermission()` |

## Key Legal Distinction

- **Terms of Service** is recorded with `acceptance_action = 'ACCEPTED'`.
- **Privacy Policy** is recorded with `acceptance_action = 'ACKNOWLEDGED'`.
- Unrelated consents (such as marketing or promotional communications) are **not** bundled into mandatory patient registration acceptance.

## Documentation Index

- [Terms of Service Draft](./terms-of-service.md) — `DRAFT — NOT APPROVED FOR PRODUCTION`
- [Privacy Policy Draft](./privacy-policy.md) — `DRAFT — NOT APPROVED FOR PRODUCTION`
- [Document Versioning](./document-versioning.md) — Draft, review, publish, supersede, and withdraw lifecycle
- [Acceptance Records](./acceptance-records.md) — MySQL schema, transaction atomicity, and server timestamps
- [Re-Acceptance Workflow](./reacceptance-workflow.md) — Material vs. minor update handling
- [Security & Privacy](./security-and-privacy.md) — DRBAC, IDOR protection, data minimization, and Audit Trail
- [Testing](./testing.md) — Automated frontend, backend, versioning, and security test results
- [Clinic Approval Checklist](./clinic-approval-checklist.md) — Required clinic and legal/privacy confirmations
