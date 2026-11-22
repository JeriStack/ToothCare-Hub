# Phase 16 — Test Data & Isolated Environments

## Configuration Template

Copy [`.env.testing.example`](../../.env.testing.example) to `.env.testing` when running local MySQL integration checks. Never point automated tests at production databases or live SMTP servers.

## Hygiene Rules

1. **Synthetic Data Only**: All PHPUnit, Vitest, Node, and Playwright tests create synthetic users (`@example.com` / `@toothcare.local`) and never reference real patient PII.
2. **Zero External Email**: `MAIL_ENABLED=false` and `FakeMailTransport` guarantee no SMTP connection is ever opened during automated tests.
3. **Database Isolation**:
   - Fast local/CI PHPUnit runs use an isolated per-test in-memory SQLite database (`TestDb::create()`) with full schema parity.
   - CI's `migrations` job runs against a clean ephemeral **MySQL 8.0** service container, applying all migrations (`001`–`032`) from an empty schema and re-running `database/migrate.php` to prove idempotency.
4. **Docker Volume Safety**: Automated tests never delete or reset development/production Docker volumes (`toothcare_mysql_data`).
