# Phase 9: REST API Documentation
## ToothCare Hub — Dental Appointment and Clinic Management System

---

## 1. Overview

Phase 9 introduces the availability and scheduling endpoints under `/api/v1`. All endpoints enforce strict JSON envelopes `{ data, meta, error }`, correlation tracking via `X-Request-ID`, and `Asia/Manila` temporal integrity.

---

## 2. Endpoint Catalog

### 2.1 Calculate Availability
`GET /api/v1/availability`
- **Access**: Public / Authenticated
- **Parameters**:
  - `dentist_id` (int, required): Practitioner ID
  - `service_id` (int, required): Service procedure ID
  - `date` or `start_date` (YYYY-MM-DD, required): Target start date
  - `end_date` (YYYY-MM-DD, optional): Range query limit (max 14 days)
- **Response**:
```json
{
  "data": {
    "dentist": {
      "id": 1,
      "name": "Dr. Maria Santos",
      "specialization": "General Dentistry"
    },
    "service": {
      "id": 1,
      "name": "Routine Cleaning 30m",
      "duration_minutes": 30,
      "price": 1200.00,
      "buffer_minutes": 10
    },
    "timezone": "Asia/Manila",
    "availability": [
      {
        "date": "2026-11-10",
        "day_of_week": 2,
        "is_clinic_open": true,
        "slots": [
          {
            "start_at": "2026-11-10T08:00:00+08:00",
            "end_at": "2026-11-10T08:30:00+08:00",
            "blocking_end_at": "2026-11-10T08:40:00+08:00",
            "duration_minutes": 30,
            "buffer_minutes": 10,
            "dentist_id": 1,
            "operatory_chair": "Chair 1",
            "available": true
          }
        ]
      }
    ]
  },
  "meta": {
    "request_id": "893cfa31-8234-4b52-9b22-83213abde123"
  },
  "error": null
}
```

---

### 2.2 Clinic Operating Hours
- `GET /api/v1/clinic/hours` (Public / Authenticated): List operating hours for all 7 days.
- `PUT /api/v1/admin/clinic/hours` (Admin Only): Update operating hours for a specific day or all days.
  - Body: `{ day_of_week: 6, opening_time: "08:30:00", closing_time: "13:00:00", is_closed: 0 }`

---

### 2.3 Clinic Facility Closures
- `GET /api/v1/clinic/closures` (Public / Authenticated): List scheduled facility closures.
- `POST /api/v1/admin/clinic/closures` (Admin Only): Schedule a closure.
  - Body:
    ```json
    {
      "title": "Christmas Holiday",
      "start_at": "2026-12-25 00:00:00",
      "end_at": "2026-12-25 23:59:59",
      "closure_type": "HOLIDAY",
      "notes": "Clinic facility closed."
    }
    ```
- `DELETE /api/v1/admin/clinic/closures/{id}` (Admin Only): Remove a closure.

---

### 2.4 Dentist Weekly Shifts
- `GET /api/v1/dentists/{id}/schedules` (Public / Authenticated): List recurring weekly shifts for a dentist.
- `POST /api/v1/admin/dentists/{id}/schedules` (Admin Only): Create a recurring shift.
  - Body: `{ day_of_week: 1, start_time: "08:00:00", end_time: "17:00:00", operatory_chair: "Chair 1", is_active: 1 }`
- `PUT /api/v1/admin/dentists/{id}/schedules/{scheduleId}` (Admin Only): Update recurring shift.
- `DELETE /api/v1/admin/dentists/{id}/schedules/{scheduleId}` (Admin Only): Delete recurring shift.

---

### 2.5 Dentist Time-Off & Leaves
- `GET /api/v1/dentists/{id}/time-off` (Public / Authenticated):
  - Admins and the practitioner themselves see full reasons.
  - Third-party or unauthenticated users see reasons masked to `"Unavailable"`.
- `POST /api/v1/admin/dentists/{id}/time-off` (Admin Only): Schedule leave period.
  - Body: `{ start_at: "2026-11-20 08:00:00", end_at: "2026-11-20 17:00:00", reason: "Medical leave" }`
- `DELETE /api/v1/admin/dentists/{id}/time-off/{timeOffId}` (Admin Only): Cancel/remove leave.

