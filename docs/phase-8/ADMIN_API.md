# Phase 8 — Administrative & Public API Reference

---

## 1. Authentication & Headers

All administrative endpoints under `/api/v1/admin/*` require:
1. **Active Admin Session**: Authenticated via HttpOnly session cookie (`toothcare_session`).
2. **Role Verification**: Verified server-side by `AuthorizationMiddleware(['ADMIN'])`.
3. **Anti-CSRF Header**: `X-CSRF-Token` required on state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`).
4. **Standard Envelopes**: All responses adhere to the unified JSON contract `{ data, meta, error }`.

---

## 2. Dental Services Catalog

### Public Endpoints
- **`GET /api/v1/services`**
  - **Auth**: Public
  - **Response**: List of active services (`is_active = 1`) available for patient booking.

### Administrative Endpoints
- **`GET /api/v1/admin/services`**
  - **Auth**: Admin
  - **Query Params**:
    - `search` (string): Matches `name`, `category`, or `description`.
    - `category` (string): Exact category match.
    - `is_active` (0 | 1): Active status filter.
    - `sort_by` (string): Allowlist: `id`, `name`, `price`, `duration_minutes`, `category`, `is_active`, `created_at`.
    - `sort_dir` (`ASC` | `DESC`): Sort direction.
    - `page` (int, default 1): Page number.
    - `per_page` (int, default 10, max 100): Records per page.
  - **Response**: Paginated envelope with `items` and `pagination` metadata.

- **`POST /api/v1/admin/services`**
  - **Auth**: Admin + CSRF
  - **Request Body**:
    ```json
    {
      "name": "Comprehensive Oral Prophylaxis",
      "category": "General",
      "description": "Thorough scaling, stain polishing, and gum evaluation.",
      "price": 1500.00,
      "duration_minutes": 45,
      "is_active": 1
    }
    ```
  - **Response**: `201 Created` with created service record.
  - **Errors**: `409 Conflict` (duplicate name), `422 Unprocessable` (negative price, invalid duration).

- **`GET /api/v1/admin/services/{id}`**
  - **Auth**: Admin
  - **Response**: Single service details.

- **`PUT /api/v1/admin/services/{id}`**
  - **Auth**: Admin + CSRF
  - **Request Body**: Partial or full update payload.

- **`PATCH /api/v1/admin/services/{id}/status`**
  - **Auth**: Admin + CSRF
  - **Request Body**: `{"is_active": 0}` (or `1`)
  - **Behavior**: Soft deactivates or reactivates procedure. Preserves all past appointments and treatments.

---

## 3. Dentist Roster Management

### Public Endpoints
- **`GET /api/v1/dentists`**
  - **Auth**: Public
  - **Response**: Active licensed practitioners (`is_active = 1`).

### Administrative Endpoints
- **`GET /api/v1/admin/dentists`**
  - **Auth**: Admin
  - **Query Params**: `search`, `specialization`, `is_active`, `sort_by`, `sort_dir`, `page`, `per_page`.
  - **Response**: Paginated dentist roster with linked user identity details.

- **`POST /api/v1/admin/dentists`**
  - **Auth**: Admin + CSRF
  - **Request Body**:
    ```json
    {
      "first_name": "Roberto",
      "last_name": "Reyes",
      "email": "dr.reyes@toothcare.com",
      "password": "ToothCare!Pass2026",
      "license_number": "PRC-DEN-001234",
      "specialization": "Orthodontics",
      "phone": "+639171234567",
      "default_operatory_chair": "Chair 2",
      "bio": "Certified specialist in clear aligners.",
      "is_active": 1
    }
    ```
  - **Response**: `201 Created` with created dentist profile and linked `user_id`.
  - **Errors**: `409 Conflict` (duplicate email or license number), `422 Unprocessable` (weak password, missing fields).

- **`GET /api/v1/admin/dentists/{id}`**
  - **Auth**: Admin
  - **Response**: Full practitioner profile.

- **`PUT /api/v1/admin/dentists/{id}`**
  - **Auth**: Admin + CSRF
  - **Request Body**: Updatable profile fields (`first_name`, `last_name`, `specialization`, `phone`, `default_operatory_chair`, `bio`).

- **`PATCH /api/v1/admin/dentists/{id}/status`**
  - **Auth**: Admin + CSRF
  - **Request Body**: `{"is_active": 0}` (or `1`)
  - **Behavior**: Synchronizes `dentists.is_active` AND `users.is_active`. Deactivating a dentist immediately suspends login access and removes booking availability while preserving consultation history.

---

## 4. Patient Registry & Record Oversight

- **`GET /api/v1/admin/patients`**
  - **Auth**: Admin
  - **Query Params**: `search` (name, email, phone), `gender`, `is_active`, `sort_by`, `sort_dir`, `page`, `per_page`.
  - **Response**: Paginated patient registry directory.

- **`GET /api/v1/admin/patients/{id}`**
  - **Auth**: Admin (or patient owner via `/api/v1/patients/{id}`)
  - **Response**: Full demographic profile, emergency contacts, medical alerts, and appointment count summary.

- **`PUT /api/v1/admin/patients/{id}`**
  - **Auth**: Admin + CSRF (or patient owner via `PATCH /api/v1/patients/{id}`)
  - **Request Body**:
    ```json
    {
      "first_name": "Juan",
      "last_name": "Dela Cruz",
      "date_of_birth": "1990-08-20",
      "phone": "+639178889999",
      "gender": "MALE",
      "address": "Manila City, Philippines",
      "emergency_contact_name": "Maria Dela Cruz",
      "emergency_contact_phone": "+639178880000",
      "medical_alerts": "Allergic to penicillin; Mild hypertension"
    }
    ```

- **`PATCH /api/v1/admin/patients/{id}/status`**
  - **Auth**: Admin + CSRF
  - **Request Body**: `{"is_active": 0}` (or `1`)
  - **Behavior**: Sets `users.is_active = 0` to revoke portal login without deleting clinical records or appointment history.

---

## 5. Administrative Dashboard Metrics

- **`GET /api/v1/admin/dashboard`**
  - **Auth**: Admin
  - **Response Format**:
    ```json
    {
      "data": {
        "counts": {
          "patients": { "total": 142, "active": 139, "inactive": 3 },
          "dentists": { "total": 5, "active": 4, "inactive": 1 },
          "services": { "total": 18, "active": 16, "inactive": 2 },
          "appointments": {
            "total": 312,
            "pending": 7,
            "confirmed": 45,
            "completed": 240,
            "cancelled": 20,
            "today": 14
          }
        },
        "recent": {
          "patients": [ ... ],
          "services": [ ... ]
        },
        "generated_at": "2026-11-06T00:45:00+08:00"
      },
      "meta": {
        "request_id": "3c26210f-6fb6-4556-9e90-c2d96abcf76a"
      },
      "error": null
    }
    ```

