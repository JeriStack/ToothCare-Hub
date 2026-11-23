# Clinic & Legal/Privacy Approval Checklist

> **Production Release Gate:** All items below remain **`PENDING CLINIC APPROVAL`** or **`PENDING LEGAL/PRIVACY REVIEW`** until signed off by clinic management, the designated Data Protection Officer (DPO), and qualified Philippine legal counsel.

## 1. Clinic Organizational Information (`PENDING CLINIC APPROVAL`)

- [ ] Registered legal name of the dental clinic / Personal Information Controller (PIC).
- [ ] Official clinic physical address (configure via `VITE_CLINIC_ADDRESS`).
- [ ] Official clinic email address and telephone number (configure via `VITE_CLINIC_EMAIL` and `VITE_CLINIC_PHONE`; replace `.local` development defaults).
- [ ] Designated Data Protection Officer (DPO) full name, official DPO email address, and direct contact procedure.

## 2. Clinic Operational & Terms Policies (`PENDING CLINIC APPROVAL`)

- [ ] Minimum patient age for self-registration and parent/guardian consent procedures for minor patients.
- [ ] Approved appointment cancellation cutoff window, rescheduling limits, and no-show policy.
- [ ] Approved fee disclosure, billing, and in-clinic payment/refund terms.
- [ ] Account suspension/termination notice and patient appeal workflow.
- [ ] Final approved wording for the registration agreement checkbox statement.

## 3. Philippine Data Privacy Act (RA 10173) & NPC Review (`PENDING LEGAL/PRIVACY REVIEW`)

- [ ] Qualified legal/privacy review of the Privacy Policy draft against Republic Act No. 10173, its IRR, and applicable National Privacy Commission (NPC) circulars.
- [ ] Confirmation of lawful basis for each personal information (Section 12) and sensitive personal/health information (Section 13) processing activity.
- [ ] Review of IP address and User-Agent collection in `user_legal_acceptances` and `audit_logs` for proportionality and disclosure adequacy.
- [ ] Approved data retention periods and secure disposal procedures for patient profiles, treatment records, audit logs, and legal acceptance records.
- [ ] Inventory of named third-party data processors (hosting provider, SMTP mail provider) and execution of Data Sharing / Outsourcing Agreements.
- [ ] Formal Data Subject Request (DSR) identity verification workflow and statutory response timelines.
- [ ] Governance decision on which personnel receive the explicit `legal_documents.publish` DRBAC permission.

## 4. Production Publication Steps (After Approval)

1. Grant `legal_documents.publish` to the designated compliance/governance role via DRBAC.
2. Create an approved draft (`is_approved = true`) containing the final clinic-approved text and verified contact details.
3. Publish the approved version (`POST /api/v1/admin/legal/documents/{id}/publish`) with the official `effective_date` and approved `requires_reacceptance` setting.
