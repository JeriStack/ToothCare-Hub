# Legal Documents & User Consent Management — Test Coverage

## Automated Verification Suites

### Backend (PHPUnit 11.5 / PHP 8.5)
- `backend/tests/Integration/LegalDocumentsApiTest.php`
  - Public `/api/v1/legal/documents`, `/legal/terms-of-service`, `/legal/privacy-policy` unauthenticated access & draft/private-data isolation.
  - Registration rejection of missing acceptance, `accept_legal: false`, invalid/outdated/draft document versions (HTTP `422`).
  - Server-generated `accepted_at` ignoring forged client timestamps; distinct `ACCEPTED` vs `ACKNOWLEDGED` records; `audit_logs` integration without credential leakage.
  - Atomic rollback of `user_legal_acceptances` when registration fails mid-transaction.
  - Security boundaries: `401` unauthenticated, `403` patient admin access, `403` IDOR acceptance for another `user_id`, `409` immutable published edit attempt, `403` admin publish attempt without explicit `legal_documents.publish` DRBAC permission.
  - Versioning & re-acceptance: minor update (`requires_reacceptance = false`) does not force re-acceptance; material update (`requires_reacceptance = true`) supersedes `v1.0` without altering history, prompts user, records `v2.0`, handles duplicate requests idempotently, and exposes records to authorized audit viewers.
- Regression suites: `AuthValidatorTest.php`, `AuthServiceTest.php`, `Phase16BusinessRuleRegressionTest.php`, `EmailOutboxFlowTest.php`.

### Frontend (Vitest / React Testing Library)
- `frontend/src/tests/legal/LegalDocumentsAndConsent.test.jsx`
  - `TermsOfServicePage` & `PrivacyPolicyPage` rendering (title, version, effective date, draft banner, TOC, Philippine DPA sections, Back to Registration).
  - `LandingFooter` clickable links (`/terms-of-service`, `/privacy-policy`).
  - `RegisterForm` unchecked default checkbox, link clicks without form submit/toggle, non-sensitive `sessionStorage` draft recovery with zero password storage, validation error wording, versioned submission payload without client timestamp.
  - `LegalReacceptanceModal` unchecked default confirmation and submission payload.
- Regression suites: `authSchema.test.js`, `RegisterForm.test.jsx`, `LoginForm.test.jsx`, `AuthContext.test.jsx`, `HelpCenterPage.test.jsx`, `LandingAnimations.test.jsx`.

### Live Container & Build Verification
- Vite production build (`npm --prefix frontend run build`)
- MySQL migration `033_create_legal_documents_and_acceptances.sql` applied cleanly to `toothcare-mysql`
- Live HTTP checks against `http://127.0.0.1:8080/api/v1/legal/*` and `POST /api/v1/auth/register` after restarting `toothcare-php-fpm`.
