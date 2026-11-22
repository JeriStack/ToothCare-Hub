# Image Tagging, Digests & Promotion Strategy

## 1. Tagging Convention

- **CI Commit Artifact:** `toothcare-frontend:<git-sha>`, `toothcare-backend:<git-sha>`, `toothcare-realtime:<git-sha>`
- **Approved Release:** `toothcare-frontend:vX.Y.Z`, `toothcare-backend:vX.Y.Z`, `toothcare-realtime:vX.Y.Z`
- Unreviewed `latest` tags are prohibited in production Compose deployments (`compose.prod.yaml` defaults to `${IMAGE_TAG:-v1.0.0}`).

## 2. Build-Once Promotion Workflow

1. CI builds immutable images once per commit SHA and runs `nginx -t` + Trivy vulnerability scans (`.github/workflows/ci.yml`).
2. Record image tags and SHA-256 digests (`docker images --digests`) in release metadata alongside Git SHA, base image versions, test results, and scan results.
3. Deploy the exact tested image digest to staging and execute smoke tests.
4. Promote the **identical image digest** to production (`IMAGE_TAG=<tag> docker compose -f compose.yaml -f compose.prod.yaml up -d`) — never rebuild a fresh image after staging sign-off.
