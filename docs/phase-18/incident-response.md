# Security & Privacy Incident Response Guide

## 1. Covered Incident Categories

1. Unauthorized account access / credential stuffing
2. Patient personal or clinical information exposure (SPI breach)
3. Stolen credentials, session hijacking, or compromised admin account
4. Database compromise or unauthorized query activity
5. Malicious file upload attempt or avatar storage abuse
6. SMTP / email account compromise or unauthorized outbound mail
7. Application vulnerability (CSRF, IDOR, injection, XSS)
8. Unauthorized administrative or DRBAC permission change
9. Real-time Socket.IO notification privacy leak
10. Backup file or encryption key exposure

---

## 2. Standard 10-Step Incident Response Process

1. **Detection:** Alerts from Prometheus/Grafana, `audit_logs`, `/api/v1/admin/operations/errors`, rate-limit spikes, or user reports.
2. **Initial Assessment:** Classify severity (Critical/High/Medium/Low), determine whether patient SPI or credentials are affected, and assign an Incident Commander.
3. **Containment:**
   - Deactivate compromised accounts (`PATCH /api/v1/admin/users/{id}/status` — automatically revokes active Socket.IO tickets).
   - Rotate compromised secrets (`DB_PASSWORD`, `REALTIME_INTERNAL_SECRET`, `EMAIL_PAYLOAD_KEY`, `SMTP_PASSWORD`, backup keys).
   - Block abusive IPs/routes at Nginx/firewall without destroying forensic state.
4. **Evidence Preservation:** Export relevant `audit_logs`, Nginx access/error logs, and `backend/storage/logs/*.log` (read-only archive with SHA-256 hash).
5. **Investigation:** Trace `request_id`, actor IDs, affected `patient_id`/`appointment_id` records, and root cause.
6. **Recovery:** Patch root cause, verify via automated security regression tests, restore clean state if required (using verified encrypted backups), and monitor closely.
7. **Internal Escalation:** Notify clinic leadership, IT/engineering owner, and the designated **Data Protection Officer (DPO)**.
8. **Privacy & Institutional Notification Review:** Consult the clinic's DPO and qualified legal counsel to determine whether regulatory (e.g., National Privacy Commission under RA 10173) or data-subject breach notifications are required and within what applicable legal timelines. *(Do not assume or improvise legal notification deadlines.)*
9. **Post-Incident Analysis:** Document timeline, root cause, detection gaps, and impact within a blameless postmortem.
10. **Corrective Actions:** Track permanent security fixes, new automated tests, and monitoring alerts to closure.
