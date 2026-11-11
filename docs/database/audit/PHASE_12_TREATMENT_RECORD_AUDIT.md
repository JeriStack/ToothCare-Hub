# ToothCare Hub — Phase 12 Treatment Records Audit Report

**Scope:** FDI Notation (ISO 3950), Clinical Documentation, Compliance Window Lock, Amendments, Versioning, Privacy Controls  
**Audit Status:** PASSED WITH MINOR ACTION ITEM (See Finding TR-01)

---

## 1. Compliance Matrix

| Requirement | Phase 12 Specification | Database / Backend Implementation | Status |
|---|---|---|---|
| **FDI Tooth Chart** | Two-digit notation (11–48 adult dentition) | Validated in `TreatmentRecordService::validateFdiTeeth()`, stored as JSON in `treatment_records.teeth_treated` | Verified |
| **Record Uniqueness** | Exactly 1 treatment record per appointment | Enforced via unique constraint `uq_treatment_records_appointment` and pre-insert check in `TreatmentRecordService` | Verified |
| **Status Eligibility** | Only CONFIRMED or COMPLETED appointments | Validated in `TreatmentRecordService::createRecord()` before starting transaction | Verified |
| **Ownership Consistency** | Attending dentist & patient match appointment | Sourced directly from `$appointment` row, zero client trust | Verified |
| **24-Hour Edit Lock** | Permanent lock 24 hours after completion | Enforced via `locked_at <= NOW()` / `is_locked` check with HTTP 409 `RECORD_LOCKED` | Verified |
| **Clinical Validation** | Diagnosis & procedure notes required; sanitized | Validated in `TreatmentRecordService::validateRecordInput()` | Verified |
| **Zero XSS in HTML** | Treatment notes rendered safely | Stored as sanitized plaintext, rendered via React DOM escaping (never raw `dangerouslySetInnerHTML`) | Verified |
| **Privacy Redaction** | Clinical notes excluded from email & webhooks | Notifications & outbox emails store generic messages ("Treatment documented"), excluding diagnosis | Verified |
| **Immutable Versioning**| Preserve prior snapshots upon note amendments | Table `treatment_record_versions` created with sequential versions | Minor Gap (TR-01) |

---

## 2. In-Depth Evaluation

### 2.1 24-Hour Compliance Lock Implementation
- In `TreatmentRecordRepository`:
  ```sql
  SELECT tr.*,
         CASE WHEN tr.locked_at IS NOT NULL AND tr.locked_at <= NOW() THEN 1 ELSE 0 END AS is_locked
  FROM treatment_records tr
  ```
- In `TreatmentRecordService::updateRecord()`:
  ```php
  if (!empty($record['is_locked'])) {
      throw HttpException::conflict(
          'This treatment record is permanently locked (24-hour edit window elapsed) and cannot be modified.',
          'RECORD_LOCKED'
      );
  }
  ```
- Any attempt to modify a record after 24 hours returns an explicit `RECORD_LOCKED` error.

---

## 3. Findings & Recommendations

### Finding TR-01 (Severity: MEDIUM) — Automated Version Snapshot Creation on Update
- **Affected File**: `backend/src/Services/TreatmentRecordService.php`
- **Description**: While `treatment_record_versions` table exists in MySQL with proper foreign keys and unique constraints (`uq_record_version`), `TreatmentRecordService::updateRecord()` updates the row in `treatment_records` without currently calling `treatment_record_versions` to insert the previous snapshot version.
- **Evidence**: `grep "treatment_record_versions"` in `backend/src` returns zero references in PHP services.
- **Impact**: Clinical amendments within the 24-hour window overwrite previous text in `treatment_records` without saving the prior revision in `treatment_record_versions`.
- **Remediation**:
  1. Add `recordVersion(int $treatmentRecordId, array $data, ?PDO $pdo = null): int` in `TreatmentRecordRepository`.
  2. In `TreatmentRecordService::updateRecord()`, before executing `$this->treatmentRepo->update()`, insert the current state as a version snapshot into `treatment_record_versions` within the active transaction.
- **Verification Test**: Update an existing treatment record and verify `SELECT COUNT(*) FROM treatment_record_versions WHERE treatment_record_id = ?` increments by 1.
