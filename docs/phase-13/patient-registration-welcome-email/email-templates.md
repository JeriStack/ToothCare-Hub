# Email Templates Architecture

All onboarding emails are rendered through `App\Services\Email\EmailTemplateRenderer` using the shared branded layout (`backend/templates/emails/layout.php`) and allowlisted template definitions in `backend/templates/emails/`.

## Template Inventory

| Template Key | File | Subject | Purpose |
|---|---|---|---|
| `patient-registration-received` | `backend/templates/emails/patient-registration-received.php` | `Thank You for Registering with ToothCare Hub!` | Confirms registration was received; explains mandatory email verification next step and configured token expiration window (`ttl_hours`); does **not** claim the account is active yet. |
| `verify-email` | `backend/templates/emails/verify-email.php` | `Verify Your ToothCare Hub Email Address` | Provides single-use absolute verification CTA (`{app_url}/verify-email?token=...`), copyable fallback URL, configured expiration (`ttl_hours`), expired-link resend guidance, and security notice. |
| `patient-welcome` | `backend/templates/emails/patient-welcome.php` | `Welcome to ToothCare Hub — We're Glad You're Here!` | Welcomes verified patients; lists 5 core portal capabilities via escaped bullet points; provides primary CTA to `{app_url}/login`. |

## Rendering & Safety Standards

- **Multipart HTML + Plain-Text**: Every rendered `EmailMessage` contains both `htmlBody` (table-based layout with inline CSS and responsive widths for email clients) and `textBody` (clean plain-text fallback with explicit URLs and `- ` bullet formatting).
- **Zero External Assets or Trackers**: Templates contain no remote images, external stylesheets, JavaScript, or tracking pixels.
- **Output Escaping**: All interpolated values (patient names, clinic details, bullet strings, CTA URLs) are escaped with `htmlspecialchars(..., ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')` inside `EmailTemplateRenderer`.
- **No Sensitive Data**: Passwords, clinical diagnoses, medical history, and internal database identifiers are never included in email bodies.

## Template Variables

- `patient-registration-received`: `name` (string), `verification_required` (bool, default `true`), `ttl_hours` (int, default `24`).
- `verify-email`: `name` (string), `token` (64-hex string decrypted at render time by worker), `ttl_hours` (int, default `24`).
- `patient-welcome`: `name` (string).
