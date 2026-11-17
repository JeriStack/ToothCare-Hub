# Phase 10: REST API Documentation

## 1. Overview
ToothCare Hub provides 10 dedicated RESTful endpoints for appointment booking, status tracking, cancellation, rescheduling, and administrative review. All endpoints follow the standard unified JSON envelope structure:

```json
{
  "status": "success",
  "data": { ... },
  "meta": { "request_id": "...", "timestamp": "..." }
}
```

---

## 2. Patient Appointment Endpoints

### 2.1 Book Dental Appointment
- **Method:** `POST /api/v1/appointments`
- **Auth:** Patient session cookie + `X-CSRF-Token`
- **Request Body:**
  ```json
  {
    "dentist_id": 1,
    "service_id": 2,
    "start_at": "2026-11-10 09:00:00",
    "chief_complaint": "Persistent sensitivity on upper molar."
  }
  ```
- **Responses:**
  - `201 Created`: Appointment submitted in `PENDING` status.
  - `400 Bad Request`: Missing mandatory parameters.
  - `401 Unauthorized`: No active session.
  - `404 Not Found`: Dentist or service does not exist or is inactive.
  - `409 Conflict`: Slot unavailable or overlapping with another booking.
  - `422 Unprocessable Entity`: Invalid date/time format or past timestamp.

### 2.2 List Patient Appointments
- **Method:** `GET /api/v1/appointments`
- **Auth:** Patient session cookie
- **Responses:**
  - `200 OK`: Array of appointments for the authenticated patient ordered by `start_at DESC`.

### 2.3 Get Appointment Details
- **Method:** `GET /api/v1/appointments/{id}`
- **Auth:** Patient session cookie (owns appointment) or Admin
- **Responses:**
  - `200 OK`: Full appointment record including `status_history` timeline array.
  - `403 Forbidden`: Patient does not own the appointment.
  - `404 Not Found`: Appointment does not exist.

### 2.4 Cancel Appointment
- **Method:** `POST /api/v1/appointments/{id}/cancel`
- **Auth:** Patient session cookie (owns appointment) or Admin + `X-CSRF-Token`
- **Request Body:**
  ```json
  {
    "reason": "Sudden fever and inability to travel."
  }
  ```
- **Responses:**
  - `200 OK`: Status updated to `CANCELLED`; slot released.
  - `422 Unprocessable Entity`: Appointment is already completed, rejected, or cancelled.

### 2.5 Reschedule Appointment
- **Method:** `POST /api/v1/appointments/{id}/reschedule`
- **Auth:** Patient session cookie (owns appointment) or Admin + `X-CSRF-Token`
- **Request Body:**
  ```json
  {
    "new_start_at": "2026-11-12 14:00:00",
    "reason": "Work conflict on original date."
  }
  ```
- **Responses:**
  - `201 Created`: Original appointment cancelled; new appointment created with `rescheduled_from_id`.
  - `409 Conflict`: Target new slot is not available.

---

## 3. Administrative Review and Management Endpoints

### 3.1 List All Appointments (Filtered & Paginated)
- **Method:** `GET /api/v1/admin/appointments`
- **Auth:** Admin session cookie
- **Query Parameters:**
  - `status`: Filter by `PENDING`, `CONFIRMED`, `CANCELLED`, `REJECTED`, or `COMPLETED`.
  - `dentist_id`: Filter by attending dentist ID.
  - `search`: Filter by patient name, email, or appointment ID.
  - `date_from`: Filter bookings starting on or after date (`YYYY-MM-DD`).
  - `date_to`: Filter bookings starting on or before date (`YYYY-MM-DD`).
  - `page`: Page number (default: 1).
  - `limit`: Records per page (default: 15).
- **Responses:**
  - `200 OK`: Returns `{ data: [...], meta: { total, page, per_page, last_page } }`.

### 3.2 Admin Get Appointment Details
- **Method:** `GET /api/v1/admin/appointments/{id}`
- **Auth:** Admin session cookie
- **Responses:**
  - `200 OK`: Full appointment record with patient contact info and complete audit history.

### 3.3 Confirm Pending Appointment
- **Method:** `PATCH /api/v1/admin/appointments/{id}/confirm`
- **Auth:** Admin session cookie + `X-CSRF-Token`
- **Responses:**
  - `200 OK`: Status updated from `PENDING` to `CONFIRMED`.
  - `409 Conflict`: Slot conflict detected upon confirmation attempt.
  - `422 Unprocessable Entity`: Appointment is not in `PENDING` state.

### 3.4 Reject Pending Appointment
- **Method:** `PATCH /api/v1/admin/appointments/{id}/reject`
- **Auth:** Admin session cookie + `X-CSRF-Token`
- **Request Body:**
  ```json
  {
    "reason": "Dentist on unexpected emergency hospital leave."
  }
  ```
- **Responses:**
  - `200 OK`: Status updated to `REJECTED`; slot released.
  - `422 Unprocessable Entity`: Reason is empty or status is not `PENDING`.

### 3.5 Mark Appointment Completed
- **Method:** `PATCH /api/v1/admin/appointments/{id}/complete`
- **Auth:** Admin session cookie + `X-CSRF-Token`
- **Responses:**
  - `200 OK`: Status updated from `CONFIRMED` to `COMPLETED`.
  - `422 Unprocessable Entity`: Appointment is not in `CONFIRMED` state.
