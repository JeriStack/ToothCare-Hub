# ToothCare Hub — Phase 1 Team Git Workflow & Collaboration Guide

**Document ID:** `TCH-P1-GIT-001`  
**Version:** `1.0`  
**Phase:** `Phase 1 — Repository, Local Environment, and Team Workflow`  
**Prepared Date:** `2026-10-27`

---

## 1. Repository & Remote Topology

- **Repository Name:** `ToothCare-Hub`
- **Configured Remote (`origin`):** `git@github.com:Palinje/ToothCare-Hub.git`
- **Existing Branches Inspected:**
  - `main` — Stable, reviewed, releasable branch.
  - `development` / `develop` — Team integration branch.

---

## 2. Branching Strategy

ToothCare Hub follows a structured, short-lived topic-branch workflow:

| Branch Pattern | Purpose | Base Branch | Merge Target |
|---|---|---|---|
| `main` | Production-ready, reviewed, releasable code. Never commit directly to `main`. | — | — |
| `development` *(or `develop`)* | Optional team integration branch for combining phase deliverables before release to `main`. | `main` | `main` |
| `feature/<short-description>` | New vertical-slice functionality or phase implementation (e.g., `feature/appointment-booking`, `feature/landing-page`). | `main` / `development` | `development` / `main` |
| `fix/<short-description>` | Focused bug or security fixes (e.g., `fix/slot-overlap-lock`, `fix/expired-auth-token`). | `main` / `development` | `development` / `main` |
| `docs/<short-description>` | Documentation, OpenAPI spec updates, or runbook refinements (e.g., `docs/phase-1-workflow`). | `main` / `development` | `development` / `main` |
| `chore/<short-description>` | Tooling, Docker, CI, or dependency maintenance (e.g., `chore/docker-context-ignores`). | `main` / `development` | `development` / `main` |

### Branch Naming Rules
- Use lowercase `kebab-case` after the `<type>/` prefix.
- Keep branches focused on a single requirement or roadmap phase so pull requests remain small and reviewable.

---

## 3. Commit Message Conventions

All commits must follow the **Conventional Commits** format in the imperative mood with a subject line under ~70 characters:

```text
<type>(<scope>): <imperative summary under 70 characters>

[Optional body explaining "why" and key implementation details]
[Optional footer referencing issue/requirement IDs, e.g., Refs: FR-BOOK-001]
```

### Permitted Commit Types
- `feat`: A new user-facing or API feature
- `fix`: A bug fix or security remediation
- `test`: Adding or updating PHPUnit, Vitest, or realtime tests
- `docs`: Documentation-only changes (`docs/`, `README.md`, OpenAPI docs)
- `refactor`: Code restructuring that neither fixes a bug nor adds a feature
- `chore`: Build scripts, Docker/Compose config, `.gitignore`, or dependency updates
- `ci`: GitHub Actions workflow changes (`.github/workflows/`)

### Recommended Scopes
`auth`, `patients`, `dentists`, `services`, `schedules`, `availability`, `appointments`, `booking`, `treatments`, `notifications`, `mail`, `realtime`, `reports`, `landing`, `ui`, `db`, `docker`, `nginx`, `monitoring`, `ci`, `phase-0`, `phase-1`, `setup`.

### Approved Examples
```text
feat(appointments): validate slot conflicts with row-level lock
fix(auth): reject invalid session and regenerate session id
test(booking): cover overlapping concurrent appointment requests
docs(setup): document local startup and environment templates
chore(docker): add service-specific build context exclusions
```

---

## 4. Pull Request Rules & Review Workflow

Every Pull Request must use [`.github/pull_request_template.md`](../../.github/pull_request_template.md) and satisfy these 10 mandatory rules before merge:

1. **Explain the Purpose:** Clearly state what requirement (`FR-*` / `NFR-*`) or roadmap phase the PR addresses.
2. **Link Related Issues:** Reference the GitHub Issue ID (`Closes #<id>` or `Refs #<id>`).
3. **Describe Behavior Changes:** Summarize architectural, state-transition, or API/UI changes.
4. **Include Test Evidence:** Attach PHPUnit/Vitest output when applicable, or explicitly state why tests are not applicable to a documentation/config PR.
5. **Document Database Migrations:** List any new SQL migration scripts in `database/migrations/` and verify they run cleanly from an empty database (or mark N/A).
6. **Keep OpenAPI Aligned:** Update `backend/docs/openapi.yaml` whenever `/api/v1` endpoints, parameters, or response schemas change (or mark N/A).
7. **Attach UI Screenshots:** Provide desktop and mobile (`375px`) screenshots for any React UI or landing page change.
8. **Assess Security & Privacy Impact:** Verify server-side RBAC, ownership checks (`IDOR` protection), prepared statements, and CSRF protection.
9. **Zero Secrets or Patient PII:** Confirm via `git status` and `git diff --cached` that no `.env` files, credentials, tokens, or real patient data are staged.
10. **Document Environment/Deployment Changes:** Note any new variables added to `.env.example` files or changes to `docker-compose.yml` / Nginx routing.

---

## 5. Merge Strategy, Conflict Resolution, and Branch Cleanup

1. **Pre-Merge Gate:** All required GitHub Actions CI checks (`.github/workflows/ci.yml`) must pass and at least one review approval must be recorded when working in a team.
2. **Merge Strategy:** Prefer **Squash and merge** (for multi-commit feature branches to keep `main`/`development` history linear and readable) or **Merge commit** for milestone phase merges.
3. **Conflict Resolution:**
   - Sync your feature branch regularly against the target branch (`git fetch origin` followed by `git merge origin/development` or `git rebase origin/development` on local unshared branches).
   - Never use `git push --force` on shared branches (`main`, `development`).
   - Re-run all test suites after resolving merge conflicts.
4. **Branch Cleanup:** Delete merged `feature/*`, `fix/*`, and `docs/*` branches after merge to keep the repository branch list clean.

