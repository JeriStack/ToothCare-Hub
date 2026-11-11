# Clinical Treatment Records & FDI Odontogram System

## 1. Regulatory & Compliance Context
Electronic health records in clinical dentistry require high-fidelity recording of diagnosis, procedures, and affected anatomical structures. Furthermore, legal and compliance regulations stipulate that charts cannot be retroactively modified after a reasonable clinical window without audit detection.

## 2. FDI Two-Digit Notation (ISO 3950)
ToothCare Hub adopts the World Dental Federation (FDI) two-digit notation system standard:
- **Quadrant 1 (Upper Right / Maxillary Right)**: Teeth 18 to 11
- **Quadrant 2 (Upper Left / Maxillary Left)**: Teeth 21 to 28
- **Quadrant 3 (Lower Left / Mandibular Left)**: Teeth 31 to 38
- **Quadrant 4 (Lower Right / Mandibular Right)**: Teeth 41 to 48

### Data Structure & Validation
In the database, treated teeth are stored as a structured JSON array of two-digit integers:
```json
[14, 16]
```
The backend `TreatmentRecordService` strictly verifies that every element in `teeth_treated` is an integer adhering to valid FDI ranges:
```php
$quadrant = (int) floor($tooth / 10);
$position = $tooth % 10;
if ($quadrant < 1 || $quadrant > 4 || $position < 1 || $position > 8) {
    throw HttpException::badRequest("Invalid FDI tooth notation: {$tooth}.");
}
```

## 3. 24-Hour Compliance Lock Window
Upon record creation, `locked_at` is stamped as `NOW() + 24 hours`:
```sql
locked_at = DATE_ADD(NOW(), INTERVAL 24 HOUR)
```
- **Editable Period**: While `NOW() < locked_at`, the attending clinician can edit diagnosis, procedure notes, prescriptions, and advice via `PATCH /api/v1/treatment-records/{id}`.
- **Permanent Lock**: Once 24 hours have elapsed (`NOW() >= locked_at`), `is_locked` evaluates to `true`. Any further mutation attempt is halted with HTTP `409 Conflict` and code `RECORD_LOCKED`.
- **Audit Logging**: Any update within the 24-hour window records previous values, modified values, and the clinician actor in `audit_logs` under action `TREATMENT_RECORD_UPDATED`.
