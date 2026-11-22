# Pagination, Filtering & Sorting

List and search endpoints enforce server-side pagination caps to keep database queries predictable and bounded.

---

## 1. Pagination Query Parameters

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `page` | integer (`>= 1`) | `1` | 1-indexed page number |
| `limit` / `per_page` | integer (`1..100`) | `20` | Clamped server-side to safe bounds |

### Pagination Metadata (`meta`)

```json
{
  "total": 84,
  "page": 1,
  "per_page": 20,
  "last_page": 5
}
```

---

## 2. Appointment Search (`GET /api/v1/appointments/search`)

Supports role-scoped filtering across `PATIENT`, `DENTIST`, `RECEPTIONIST`, and `ADMIN`:

| Query Param | Description |
|---|---|
| `q` | Free-text search on patient name, dentist name, service name, or reference |
| `status` | Filter by status (`PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `COMPLETED`) |
| `dentist_id` | Filter by assigned dentist ID |
| `patient_id` | Filter by patient ID (staff/admin only; patients are always scoped to themselves) |
| `service_id` | Filter by dental service ID |
| `start_date` | Inclusive start date (`YYYY-MM-DD`) |
| `end_date` | Inclusive end date (`YYYY-MM-DD`); returns `422` if `start_date > end_date` |
| `sort` | Allowed sort order (e.g., `date_asc`, `date_desc`, `created_desc`) |

---

## 3. Operational Reports & Audit Logs

- `GET /api/v1/admin/reports/appointments`
- `GET /api/v1/admin/reports/services`
- `GET /api/v1/admin/reports/dentists`
- `GET /api/v1/admin/reports/patients`
- `GET /api/v1/admin/audit-logs`
- `GET /api/v1/admin/operations/outbox?channel=email|realtime`
- `GET /api/v1/admin/operations/errors`

All report endpoints accept optional `start_date` and `end_date` (`YYYY-MM-DD`) and return `422` when `start_date > end_date`.
