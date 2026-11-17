# Phase 8 — Server-Side Pagination, Filtering & Sorting Security

---

## 1. Server-Side Pagination Architecture

All administrative lists (`services`, `dentists`, `patients`) operate with server-side pagination to ensure low memory footprints and sub-100ms response times even as records scale into tens of thousands.

### Query Parameters
- `page` (integer): 1-based index (clamped to `max(1, $page)`).
- `per_page` (integer): Records per batch (clamped between 1 and 100, default 10 or 15).

### SQL Offset Computation
```sql
LIMIT :per_page OFFSET :offset
-- where offset = (page - 1) * per_page
```

### Response Envelope (`meta`)
```json
{
  "total": 142,
  "page": 1,
  "per_page": 10,
  "last_page": 15
}
```

---

## 2. Dynamic Search & Multi-Column Wildcards

Search parameters are escaped and bound securely using PDO prepared statements with wildcard `%` wrapping.

### Example Search in `PatientRepository`:
```php
if (!empty($filters['search'])) {
    $search = '%' . trim((string) $filters['search']) . '%';
    $conditions[] = '(p.first_name LIKE :s1 OR p.last_name LIKE :s2 OR p.phone LIKE :s3 OR u.email LIKE :s4)';
    $params[':s1'] = $search;
    $params[':s2'] = $search;
    $params[':s3'] = $search;
    $params[':s4'] = $search;
}
```

---

## 3. SQL Injection Prevention on Sorting (`ORDER BY`)

### The Vulnerability
SQL prepared statements can parameterize values (`WHERE col = ?`), but cannot parameterize SQL identifiers, table names, or `ORDER BY` column names. Concatenating user input into `ORDER BY $sortBy $sortDir` opens severe SQL injection risks (e.g. blind boolean extraction, time-based attacks).

### The Solution: Compile-Time Allowlisting
Every repository defines an explicit, immutable allowlist map translating client-provided keys to fully qualified database columns.

```php
private const SORT_ALLOWLIST = [
    'id'               => 's.id',
    'name'             => 's.name',
    'price'            => 's.price',
    'duration_minutes' => 's.duration_minutes',
    'category'         => 's.category',
    'is_active'        => 's.is_active',
    'created_at'       => 's.created_at',
];

// Fallback to safe default if user passes unexpected or malicious input
$sortColumn = self::SORT_ALLOWLIST[$sortBy] ?? 's.name';
$direction = strtoupper($sortDir) === 'DESC' ? 'DESC' : 'ASC';
```

If an attacker supplies `'name; DROP TABLE users; --'` or `'SLEEP(5)'`, the lookup fails to match the allowlist keys and defaults safely to `'s.name ASC'`, completely neutralizing injection.

