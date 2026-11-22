# Production Rollback & Recovery Procedure

Rollback MUST use a previously tested, known-good immutable image tag or digest — never rebuild an older Git commit during an active incident.

---

## 1. Step-by-Step Image Rollback

1. **Identify Current Release:**
   ```bash
   docker compose -f compose.yaml -f compose.prod.yaml ps
   docker inspect --format='{{.Name}} {{.Config.Image}} {{.Image}}' toothcare-nginx toothcare-php-fpm toothcare-realtime
   ```
2. **Select Previous Known-Good Tag/Digest** from the release ledger (e.g., `IMAGE_TAG=v1.0.0`).
3. **Redeploy Previous Immutable Images (Preserves All Volumes):**
   ```bash
   IMAGE_TAG=<previous-good-tag> docker compose -f compose.yaml -f compose.prod.yaml up -d --no-build
   ```
   > **CRITICAL:** Never run `docker compose down -v` or delete `toothcare_mysql_data` / `toothcare_backend_storage` during rollback.
4. **Verify Health & Core Workflows:**
   - `docker compose -f compose.yaml -f compose.prod.yaml ps` (all services `healthy`)
   - `curl -fsS https://<domain>/health` and `curl -fsS https://<domain>/api/v1/health`
   - Verify login, appointment viewing/booking, notifications, and Socket.IO reconnection.
5. **Inspect Logs & Communicate Recovery:**
   ```bash
   docker compose logs --tail=100 nginx php-fpm realtime email-worker
   ```

---

## 2. Database Migration Compatibility Policy

- Always author **expand-and-contract (backward-compatible)** migrations so the previous application image can safely start against the updated schema.
- Never auto-run destructive down-migrations during an incident.
- For irreversible schema changes, take a verified pre-migration encrypted backup (`php database/scripts/backup.php --type=pre-migration`) before deployment.
