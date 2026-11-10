# Security, Authorization & Zero-Trust Clinical Data Isolation

## 1. Clinician Profile Resolution
Dentists authenticate via standard session credentials (`DENTIST` role in `users`).
All dentist endpoints resolve the clinician profile on the server:
```php
$dentist = $this->dentistRepo->findByUserId($userId);
if (!$dentist) {
    throw HttpException::forbidden('Account is not linked to an active dentist profile.');
}
```

## 2. Invariable Ownership Enforcement
For all appointment and clinical treatment operations:
1. **Inspecting Appointments**:
   Dentist A calling `GET /api/v1/dentist/appointments/{id}` verifies `appointment['dentist_id'] === dentist['id']`. If the appointment belongs to Dentist B, the request is rejected with `403 Forbidden` and logged in audit telemetry.
2. **Completing Visits**:
   Dentist A calling `POST /api/v1/dentist/appointments/{id}/complete` verifies appointment ownership and confirms that current status is `CONFIRMED`. Any attempt to complete another dentist's appointment yields `403 Forbidden`. Attempting to complete a `PENDING` or `CANCELLED` visit yields `409 Conflict`.
3. **Treatment Documentation**:
   `POST /api/v1/treatment-records` verifies that the appointment is assigned to the authenticated dentist and that no duplicate record exists for that appointment ID (enforced via DB unique constraint).
4. **Editing Treatment Records**:
   Only the authoring clinician can edit within 24 hours. Cross-dentist edits are rejected with `403 Forbidden`.

## 3. Privacy Preservation in Notifications
In compliance with medical data privacy guidelines:
- In-app notifications and email notifications for appointment completion confirm service name and date, but strictly omit sensitive diagnostic notes, operative procedures, and prescriptions.
- Patient medical alerts are strictly accessible to authorized clinical personnel during consultation and care.
