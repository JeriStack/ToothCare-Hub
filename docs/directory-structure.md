# ToothCare Hub - Directory Structure

This document is the maintained copy of the repository layout. It mirrors the technical
reference and is updated during meaningful refactors.

## Top-level layout

```
ToothCare-Hub/
|-- .github/              CI/CD workflows, issue & PR templates
|-- backend/              PHP REST API (controllers, services, repositories)
|-- database/             Ordered SQL migrations, seeds, schema snapshot
|-- deployment/           Apache config and deploy/rollback/health-check scripts
|-- docker/               Container service configs (nginx, php, prometheus, grafana)
|-- docs/                 Architecture, design, workflow, and security docs
|-- frontend/             React + Vite single-page application
|-- realtime/             Node.js + Socket.IO notification service
|-- scripts/              Windows PowerShell dev helpers
|-- .dockerignore
|-- .editorconfig
|-- .env.example
|-- .gitignore
|-- docker-compose.yml        Local dev stack (all services + observability)
|-- docker-compose.prod.yml   Production overrides
|-- README.md
`-- CONTRIBUTING.md
```

## Containerization and observability (Docker, Nginx, Prometheus, Grafana)

The project can run as a multi-container stack. `docker-compose.yml` wires the API,
frontend, realtime service, MySQL, an Nginx reverse proxy, and a Prometheus + Grafana
monitoring pair. `docker-compose.prod.yml` layers production-only settings (TLS ports,
restart policies, no bind mounts).

```
docker/
|-- nginx/
|   |-- conf.d/
|   |   `-- toothcare.conf        Reverse proxy: SPA, /api PHP-FPM, /socket.io WS
|   `-- ssl/
|       `-- .gitkeep              Production TLS certs (never commit real keys)
|-- php/
|   `-- Dockerfile                PHP 8.3-FPM image for the backend API
|-- prometheus/
|   `-- prometheus.yml            Scrape config (backend, realtime, nginx)
`-- grafana/
    |-- provisioning/
    |   |-- datasources/
    |   |   `-- datasource.yml    Auto-configures the Prometheus datasource
    |   `-- dashboards/
    |       `-- dashboards.yml    Dashboard provider pointing at /dashboards
    `-- dashboards/
        `-- toothcare-overview.json  Starter overview dashboard
```

Per-service Docker build files:

| Path                 | Responsibility                                            |
| -------------------- | --------------------------------------------------------- |
| `docker/php/Dockerfile` | PHP-FPM image with pdo_mysql + opcache and Composer    |
| `frontend/Dockerfile`   | Multi-stage Vite build served by Nginx                 |
| `realtime/Dockerfile`   | Node.js runtime for the Socket.IO service              |
| `.dockerignore`         | Keeps build context lean (no node_modules, vendor, env)|

### Service ports (local)

| Service     | URL / Port             | Purpose                        |
| ----------- | ---------------------- | ------------------------------ |
| Nginx       | http://localhost:8080  | Reverse proxy / app entry      |
| Realtime    | http://localhost:4000  | Socket.IO                      |
| MySQL       | localhost:3306         | Database                       |
| Prometheus  | http://localhost:9090  | Metrics collection             |
| Grafana     | http://localhost:3000  | Dashboards (default admin/admin)|

### Running the stack

```
# Development
docker compose up -d

# Production (apply overrides)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Security notes

- Never commit real TLS certificates, keys, or Grafana admin credentials. Override
  `GRAFANA_ADMIN_PASSWORD` and the SSL mount contents via the secret store.
- Prometheus and Grafana should not be publicly exposed in production without
  authentication and network restrictions.
- Metrics endpoints must not leak secrets or patient data.

For the full annotated application tree (backend, frontend, database, realtime), see the
ToothCare Hub technical reference document.
