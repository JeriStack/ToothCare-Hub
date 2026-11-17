# Email Template Reference

Templates live in `backend/templates/emails/<key>.php`. Each returns a closure `fn(array $data, array $clinic): array` that produces a content spec:

```php
['subject' => ..., 'heading' => ..., 'paragraphs' => [...], 'details' => [label => value], 'cta' => ['label' => ..., 'url' => ...], 'closing' => [...]]
```

`EmailTemplateRenderer` turns the spec into a branded HTML email (inline styles, table layout) and a plain-text alternative. Templates never write HTML. The renderer escapes every value with `htmlspecialchars(ENT_QUOTES | ENT_SUBSTITUTE)`, and subjects are forced to a single line. Only keys listed in `EmailTemplateRenderer::TEMPLATES` can be rendered, so a template key cannot be used for path traversal.

The footer shows the clinic name, address, phone and email from `clinic_settings` (`clinic_name`, `clinic_address`, `clinic_phone`, `clinic_email`).

| Key | Event | Subject | Data used |
|---|---|---|---|
| `verify-email` | `EMAIL_VERIFICATION` | Verify your ToothCare Hub email address | `name`, `ttl_hours`, sealed `token` → link `{APP_URL}/verify-email?token=…` |
| `password-reset` | `PASSWORD_RESET` | Reset your ToothCare Hub password | `name`, `ttl_minutes`, sealed `token` → link `{APP_URL}/reset-password?token=…` |
| `appointment-requested` | `APPOINTMENT_REQUESTED` | We received your appointment request | `name`, `reference`, `service`, `dentist`, `start_display` |
| `appointment-confirmed` | `APPOINTMENT_CONFIRMED` | Your appointment is confirmed | same |
| `appointment-rejected` | `APPOINTMENT_REJECTED` | Your appointment request could not be accepted | same + clinic `reason` (max 300 characters) |
| `appointment-cancelled` | `APPOINTMENT_CANCELLED` | Your appointment has been cancelled | same + `cancelled_by` (`patient`/`clinic`) |
| `appointment-reminder` | `APPOINTMENT_REMINDER` | Reminder: your upcoming dental appointment | same |
| `appointment-completed` | `APPOINTMENT_COMPLETED` | Thank you for visiting ToothCare Hub | same |

The verification link format matches the existing frontend routes and `AuthService` token checks. Single use and expiry are enforced by the existing `auth_tokens` logic (Phase 7).

## Adding a template

1. Add `templates/emails/<key>.php` returning the closure.
2. Add the key to `EmailTemplateRenderer::TEMPLATES` and an entry to `EmailOutboxService::EVENTS`.
3. Pass only non-clinical data. Add a renderer test (see `tests/Unit/EmailTemplateRendererTest.php`).
