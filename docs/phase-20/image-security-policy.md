# Container Image & Dependency Security Policy

## 1. Automated Scanning Gates (`.github/workflows/ci.yml`)

- **PHP Dependencies:** `composer audit --no-interaction`
- **Frontend & Realtime Dependencies:** `npm audit --audit-level=high`
- **Container Images:** `aquasecurity/trivy-action@v0.36.0` scans `toothcare-frontend`, `toothcare-backend`, and `toothcare-realtime` on every CI run.

## 2. Severity Remediation Policy

| Severity | Release Gate | Required Action |
|---|---|---|
| **Critical** | **BLOCKS release** (`exit-code: 1`, `ignore-unfixed: true`) | Remediate before promotion; temporary exception requires documented, time-limited risk acceptance. |
| **High** | **BLOCKS frontend image / tracked for backend** | Remediate or document compensating control, owner, and target date. |
| **Medium / Low** | Advisory | Track and address during scheduled Dependabot / base-image maintenance cycles. |

## 3. False Positive Governance

Any suppressed finding must record: scanner ID/CVE, affected package/layer, technical justification why it is non-exploitable, reviewer approval, and next review date.
