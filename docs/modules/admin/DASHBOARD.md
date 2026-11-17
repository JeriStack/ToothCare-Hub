# Phase 8 — Administrative Operational Intelligence & Real MySQL Aggregates

---

## 1. Overview & Principles

The administrative dashboard provides immediate operational intelligence for clinic directors and head receptionists.

Unlike naive prototypes that display static mock numbers or pull all records into application memory to call `count()`, ToothCare Hub executes optimized MySQL aggregate queries directly within the database engine.

---

## 2. Real Database Aggregations

`DashboardRepository::getMetrics()` executes index-backed counting queries:

### 1. Patient Totals
```sql
SELECT COUNT(*) FROM patients;
SELECT COUNT(*) FROM patients p INNER JOIN users u ON p.user_id = u.id WHERE u.is_active = 1;
```

### 2. Practitioner Totals
```sql
SELECT COUNT(*) FROM dentists;
SELECT COUNT(*) FROM dentists WHERE is_active = 1;
```

### 3. Procedure Catalog Totals
```sql
SELECT COUNT(*) FROM services;
SELECT COUNT(*) FROM services WHERE is_active = 1;
```

### 4. Appointment Status Distribution
```sql
SELECT COUNT(*) FROM appointments;
SELECT COUNT(*) FROM appointments WHERE status = 'PENDING';
SELECT COUNT(*) FROM appointments WHERE status = 'CONFIRMED';
SELECT COUNT(*) FROM appointments WHERE status = 'COMPLETED';
SELECT COUNT(*) FROM appointments WHERE status = 'CANCELLED';
```

### 5. Today's Appointments (Index-Optimized Sargable Interval)
```sql
SELECT COUNT(*) FROM appointments 
WHERE start_at >= '2026-11-06 00:00:00' AND start_at <= '2026-11-06 23:59:59';
```
> **Performance Note**: Using range boundaries `>= 'YYYY-MM-DD 00:00:00'` and `<= 'YYYY-MM-DD 23:59:59'` avoids wrapping column expressions in functions like `DATE(start_at)`, allowing MySQL to fully exploit the composite index `idx_appointments_status_start (status, start_at)`.

---

## 3. Real-Time Activity Streams

The dashboard also returns the 5 latest registered patients and 5 recently modified services, rendering real-time audit visibility into recent clinic events without full-table scans.

