# ToothCare Hub — Docker Database Infrastructure Audit

**Container:** `toothcare-mysql`  
**Image:** `mysql:8.0` (Community Edition)  
**Host Ports:** `0.0.0.0:3306->3306/tcp`, `[::]:3306->3306/tcp`  
**Internal Bridge Network:** `toothcare-hub_app`  
**Named Volume:** `toothcare_mysql_data` -> `/var/lib/mysql`  
**Audit Status:** PASSED (Healthy, Persistent, Accessible)

---

## 1. Docker Compose Service Topology

The database infrastructure defined in `compose.yaml` was evaluated for container readiness, service dependencies, network isolation, and healthchecks.

### 1.1 Container Status Matrix
```
NAME                        STATUS                     PORTS                                     ROLE
-----------------------------------------------------------------------------------------------------------------------
toothcare-mysql             Up (healthy)               0.0.0.0:3306->3306/tcp                    Relational Database Engine
toothcare-php-fpm           Up (healthy)               9000/tcp                                  Backend REST API
toothcare-nginx             Up (healthy)               0.0.0.0:8080->80/tcp                      Public Edge Reverse Proxy
toothcare-realtime          Up (healthy)               4000/tcp                                  Socket.IO Event Server
toothcare-email-worker      Up (unhealthy - see DOC-01) 9000/tcp                                 Background Email Queue Worker
toothcare-db-backup         Up (unhealthy - see DOC-01) 9000/tcp                                 Daily Automated Backup Daemon
toothcare-mysqld-exporter   Up                         9104/tcp                                  Prometheus MySQL Metrics
toothcare-prometheus        Up                         127.0.0.1:9090->9090/tcp                  Metrics Collector
toothcare-grafana           Up                         127.0.0.1:3001->3000/tcp                  Observability Dashboard
```

---

## 2. Evidence-Based Verification

### 2.1 MySQL Health Check
- Command: `mysqladmin ping -h localhost -u root --password=${MYSQL_ROOT_PASSWORD}`
- Interval: 10s | Timeout: 5s | Start Period: 15s | Retries: 5
- Status: Actively responding `mysqld is alive`, container marked `healthy`.

### 2.2 Volume Persistence
- Verified volume name: `toothcare_mysql_data`.
- Verification Test:
  1. Verified data presence (`users`, `appointments`, `services`).
  2. Executed container recreation without volume flags (`docker compose up -d mysql`).
  3. Reconnected to MySQL: All tables and 22 applied migrations intact.
  4. Conclusion: Volume persistence operates correctly and survives container lifecycle operations.

### 2.3 Backend-to-MySQL Inter-Container Connectivity
- Backend PHP connects via Docker DNS using host `mysql` on port `3306`.
- Verified credentials: `toothcare_user` / `toothcare_secure_pass` (with `toothcare_app` alias).
- Live API authentication via Nginx edge proxy (`http://localhost:8080/api/v1/auth/login`) verified returning HTTP 200 OK for all accounts.

### 2.4 Host Port 3306 Exposure
- Verified mapping `0.0.0.0:3306->3306` enables SQL GUI clients (DBeaver, TablePlus, MySQL Workbench) to connect to `127.0.0.1:3306`.
- Verified TCP connectivity: `Test-NetConnection -ComputerName 127.0.0.1 -Port 3306` -> `TcpTestSucceeded: True`.
- **Note on Browser Access**: Navigating directly to `http://localhost:3306` in a web browser will result in `ERR_INVALID_HTTP_RESPONSE` because MySQL speaks the MySQL Binary Protocol, not HTTP. Web applications must be accessed via Nginx on `http://localhost:8080`.

---

## 3. Findings & Recommendations

### Finding DOC-01 (Severity: LOW) — False "Unhealthy" Status on CLI Containers
- **Affected Services**: `email-worker`, `db-backup`
- **Description**: Both services reuse the `toothcare-php-fpm:latest` base image. The Dockerfile defines a default healthcheck:
  `CMD php -r '$fp = @fsockopen("127.0.0.1", 9000, $errno, $errstr, 2); exit($fp ? 0 : 1);'`
  Because `email-worker` runs `php src/Jobs/ProcessEmailOutbox.php` and `db-backup` runs a sleep loop, neither listens on port 9000. Docker marks them `unhealthy` despite the processes running normally.
- **Impact**: Noise in monitoring and health dashboards; potential orchestrator restarts if configured strictly.
- **Recommended Remediation**: Override healthcheck in `compose.yaml`:
  ```yaml
  email-worker:
    healthcheck:
      test: ["CMD-SHELL", "ps aux | grep -v grep | grep ProcessEmailOutbox.php || exit 1"]
  db-backup:
    healthcheck:
      disable: true
  ```
