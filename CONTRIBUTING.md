# Contributing to ToothCare Hub

Thanks for contributing. This guide covers branch naming, commit conventions, and the
pull-request process.

## Branch naming

Use a short, descriptive, kebab-case branch name prefixed by type:

- `feature/<name>` - new functionality
- `fix/<name>` - bug fixes
- `chore/<name>` - tooling, config, non-code changes
- `docs/<name>` - documentation only

## Commit conventions

Write commits in the imperative mood and keep the subject under ~70 characters:

```
feat(appointments): add availability picker
fix(auth): reject expired verification tokens
docs: document api error envelope
```

## Pull-request checklist

Before requesting review, confirm:

- [ ] Tests added or updated and passing (PHPUnit / Vitest)
- [ ] Database migrations included and reversible where applicable
- [ ] API changes reflected in `backend/docs/openapi.yaml`
- [ ] Screenshots attached for UI changes
- [ ] Security reviewed (authz, ownership, validation, secrets)
- [ ] No real `.env` values, credentials, or patient data committed

## Review process

At least one approving review is required before merge. Keep PRs focused and small where
possible. CI must pass (lint, tests, OpenAPI validation, frontend build).

## Coding standards

- **PHP:** PSR-12, 4-space indentation, PDO prepared statements only.
- **JavaScript/React:** ESLint config in `frontend/eslint.config.js`, 2-space indentation.
- Keep the backend authoritative: enforce authentication, roles, and ownership server-side.
