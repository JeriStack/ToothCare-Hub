# Policy Update & Re-Acceptance Workflow

## Policy Governing Renewed Confirmation

- **Minor / editorial updates** (`requires_reacceptance = 0`): Published as a new version (e.g., `1.1`) for transparency and new registrations without forcing existing users to re-confirm.
- **Material updates** (`requires_reacceptance = 1`): Published as a new version (e.g., `2.0`) when clinic leadership and legal/privacy counsel determine renewed agreement or acknowledgment is required.

## Authenticated User Flow

1. On login (`POST /api/v1/auth/login`) and session bootstrap (`GET /api/v1/auth/me`), `AuthService` includes `legal_status`:
   - `requires_reacceptance`: `boolean`
   - `pending_count`: `integer`
   - `pending_types`: `string[]`
2. When `requires_reacceptance === true`, `App.jsx` displays `LegalReacceptanceModal`, which loads full pending document details from `GET /api/v1/legal/acceptances/me`.
3. Viewing a document never triggers automatic acceptance. Each pending document has its own **unchecked-by-default** checkbox distinguishing Terms agreement from Privacy acknowledgment.
4. On submission, `POST /api/v1/legal/acceptances` validates the session user, verifies the document version is currently `PUBLISHED`, records the new row with a server-generated `accepted_at` timestamp, logs the audit event, and preserves all historical acceptance rows.
5. Users who do not wish to confirm may sign out cleanly without recording false acceptance.
