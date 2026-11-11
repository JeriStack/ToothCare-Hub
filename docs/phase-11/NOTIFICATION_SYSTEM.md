# In-App Notification System

## 1. Overview
The Notification System provides real-time in-app alerts and historical records for appointment status transitions and clinic announcements.

---

## 2. Notification Types & Triggers

| Event Trigger | Type Constant | Target User | Title Template | Message Template |
|---------------|---------------|-------------|----------------|------------------|
| Appointment Requested | `APPOINTMENT_REQUESTED` | Patient | Booking Request Received | Your booking request for {service} on {date} at {time} has been submitted for clinic review. |
| Appointment Confirmed | `APPOINTMENT_CONFIRMED` | Patient | Appointment Confirmed! | Your appointment for {service} with {dentist} has been confirmed for {date} at {time}. |
| Appointment Rejected / Declined | `APPOINTMENT_REJECTED` | Patient | Booking Request Declined | Your appointment request for {service} could not be accommodated. Reason: {notes}. |
| Appointment Cancelled | `APPOINTMENT_CANCELLED` | Patient / Staff | Appointment Cancelled | Appointment #{id} for {service} has been cancelled. |
| Appointment Completed | `APPOINTMENT_COMPLETED` | Patient | Dental Visit Completed | Thank you for visiting ToothCare Hub! Your appointment for {service} has been completed. |
| Appointment Rescheduled | `APPOINTMENT_RESCHEDULED` | Patient | Appointment Rescheduled | Your appointment for {service} has been rescheduled to {new_start}. |

---

## 3. Database Schema
Table: `notifications`
- `id`: BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
- `user_id`: BIGINT UNSIGNED NOT NULL (Foreign key to `users.id`)
- `title`: VARCHAR(255) NOT NULL
- `message`: TEXT NOT NULL
- `type`: VARCHAR(50) NOT NULL
- `appointment_id`: BIGINT UNSIGNED NULLABLE (Foreign key to `appointments.id`)
- `read_at`: TIMESTAMP NULLABLE
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

Indexes:
- `INDEX idx_notifications_user_read (user_id, read_at)`
- `INDEX idx_notifications_user_created (user_id, created_at)`

---

## 4. API Endpoints

- `GET /api/v1/notifications`: Paginated notifications for the authenticated user. Supports `only_unread=1`.
- `GET /api/v1/notifications/unread-count`: Returns `{ unread_count: int }`.
- `PATCH /api/v1/notifications/{id}/read`: Marks a single notification as read.
- `POST /api/v1/notifications/read-all`: Marks all unread notifications for the authenticated user as read.
