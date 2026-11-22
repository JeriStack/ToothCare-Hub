# API Usage Examples (`curl`)

All examples below use **synthetic placeholder values** and a local cookie jar (`cookies.txt`) against `http://localhost:8080/api/v1`.

---

## 1. Health Check & CSRF Token

```bash
# Check API liveness
curl -s http://localhost:8080/api/v1/health

# Fetch CSRF token and initialize session cookie
CSRF=$(curl -s -c cookies.txt http://localhost:8080/api/v1/auth/csrf-token | jq -r '.data.csrf_token')
```

## 2. Login & Inspect Current User

```bash
curl -s -b cookies.txt -c cookies.txt \
  -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"email":"patient.demo@example.com","password":"SyntheticPass123!"}'

# Verify authenticated profile
curl -s -b cookies.txt http://localhost:8080/api/v1/auth/me
```

## 3. Browse Services, Dentists & Availability

```bash
curl -s http://localhost:8080/api/v1/services
curl -s http://localhost:8080/api/v1/dentists
curl -s "http://localhost:8080/api/v1/availability?dentist_id=1&service_id=1&date=2026-12-15"
```

## 4. Book, Search & Cancel an Appointment

```bash
# Refresh CSRF token after login (session ID was regenerated)
CSRF=$(curl -s -b cookies.txt http://localhost:8080/api/v1/auth/csrf-token | jq -r '.data.csrf_token')

# Book appointment
curl -s -b cookies.txt \
  -X POST http://localhost:8080/api/v1/appointments \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"dentist_id":1,"service_id":1,"appointment_date":"2026-12-15","start_time":"10:00","notes":"Routine cleaning"}'

# Search appointments with pagination
curl -s -b cookies.txt "http://localhost:8080/api/v1/appointments/search?page=1&limit=20&status=PENDING"

# Cancel appointment
curl -s -b cookies.txt \
  -X POST http://localhost:8080/api/v1/appointments/1/cancel \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"reason":"Schedule conflict"}'
```

## 5. Notifications & Admin Reports

```bash
# List notifications & mark one read
curl -s -b cookies.txt "http://localhost:8080/api/v1/notifications?page=1&per_page=20"
curl -s -b cookies.txt -X PATCH -H "X-CSRF-Token: $CSRF" http://localhost:8080/api/v1/notifications/1/read

# Admin dashboard & operational reports (requires authenticated ADMIN cookie jar)
curl -s -b admin_cookies.txt http://localhost:8080/api/v1/admin/dashboard/summary
curl -s -b admin_cookies.txt "http://localhost:8080/api/v1/admin/reports/services?start_date=2026-01-01&end_date=2026-12-31"
```
