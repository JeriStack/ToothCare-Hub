# Postman Collection Guide

The repository ships a ready-to-import Postman v2.1 collection at [`docs/api/toothcare-hub.postman_collection.json`](toothcare-hub.postman_collection.json).

---

## 1. Importing into Postman

1. Open Postman and choose **Import**.
2. Select `docs/api/toothcare-hub.postman_collection.json`.
3. Verify the collection variables under the **Variables** tab:
   - `baseUrl`: `http://localhost:8080/api/v1` (adjust if running on another local port)
   - `patientEmail`, `patientPassword`, `adminEmail`, `adminPassword`: synthetic local test accounts only (**never** enter production credentials or commit real secrets).

---

## 2. Running the Workflow

1. Run **1. Health, CSRF & Public Catalog** first:
   - `GET /auth/csrf-token` automatically stores `csrfToken` in collection variables and initializes Postman's cookie jar (`toothcare_session`).
   - `GET /services` and `GET /dentists` automatically populate `serviceId` and `dentistId`.
2. Run **2. Authentication & Session Lifecycle** to verify unauthenticated `401` handling, patient registration, login, and `/auth/me`.
3. Run **3. Appointment Booking, Triage & Cancellation** and **4. Notifications & Realtime Ticket**.
4. Run **5. Admin Triage, Dashboards, Reports & Operations** after signing in as an admin user.

---

## 3. Running Headlessly with Newman (Optional)

```bash
npx newman run docs/api/toothcare-hub.postman_collection.json \
  --env-var "baseUrl=http://localhost:8080/api/v1"
```
