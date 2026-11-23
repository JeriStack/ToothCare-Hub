# Legal Document Versioning & Publication Lifecycle

## States (`legal_documents.status`)

| Status | Publicly Active? | Mutable? | Description |
|---|---|---|---|
| `DRAFT` | No | Yes (`legal_documents.edit`) | Work-in-progress version prepared for clinic & legal review. Cannot be accepted during registration. |
| `PUBLISHED` | Yes | **No (Immutable)** | Currently active version served at `/api/v1/legal/*` and required for new registrations. |
| `SUPERSEDED` | No | **No (Immutable)** | Prior published version preserved verbatim after a newer version is published. |
| `WITHDRAWN` | No | **No (Immutable)** | Explicitly withdrawn document preserved for historical audit traceability. |

## Immutability Guarantee

- Updating an already `PUBLISHED`, `SUPERSEDED`, or `WITHDRAWN` document returns HTTP `409 Conflict` (`LEGAL_DOCUMENT_IMMUTABLE`).
- Every version stores a SHA-256 digest (`content_sha256`) of its JSON content (`content_json`).
- Foreign key `user_legal_acceptances.document_id -> legal_documents.id` uses `ON DELETE RESTRICT` so historical versions referenced by user acceptance records cannot be deleted.

## Publishing Workflow

1. Authorized staff with `legal_documents.create` creates a `DRAFT` (`POST /api/v1/admin/legal/documents`) with a unique `(document_type, version)` pair, `effective_date`, `change_summary`, and `requires_reacceptance` flag.
2. Reviewers refine the draft via `PATCH /api/v1/admin/legal/documents/{id}` (`legal_documents.edit`).
3. Only personnel explicitly granted `legal_documents.publish` via DRBAC (NOT auto-granted to all `admin` users) may call `POST /api/v1/admin/legal/documents/{id}/publish`.
4. Publishing runs inside a single database transaction: prior `PUBLISHED` versions of the same `document_type` transition to `SUPERSEDED`, the draft becomes `PUBLISHED` with a server-generated `published_at`, and `LEGAL_DOCUMENT_PUBLISHED` is written to `audit_logs`.
