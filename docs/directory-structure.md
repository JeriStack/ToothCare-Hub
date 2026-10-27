# ToothCare Hub - Directory Structure

This document is the maintained copy of the repository layout. It mirrors the technical reference (*ToothCare Hub Directory Structure v1.1*) and is updated during meaningful refactors.

## Top-Level Master Layout

```
ToothCare-Hub/
|-- .github/                  # CI/CD workflows, issue templates & PR template
|   |-- workflows/
|   |   |-- ci.yml
|   |   `-- deploy-production.yml
|   |-- ISSUE_TEMPLATE/
|   |   |-- bug_report.md
|   |   `-- feature_request.md
|   `-- pull_request_template.md
|-- backend/                  # Native PHP REST API (/api/v1)
|   |-- config/               # app, database, mail, realtime
|   |-- public/               # index.php (single API entry point)
|   |-- src/
|   |   |-- Core/             # Request, Response, Router, HttpException
|   |   |-- Controllers/      # Auth, Patient, Dentist, Service, Appointment, TreatmentRecord, Notification, Report, Health, Metrics
|   |   |-- Middleware/       # Auth, Role/Ownership, CSRF, RateLimit
|   |   |-- Repositories/     # Parameterized SQL & PDO persistence
|   |   |-- Services/         # Business logic, availability, transitions, notifications
|   |   |-- Validators/       # Server-side schema & business validators
|   |   |-- Jobs/             # CLI outbox & reminder jobs
|   |   |-- Routes/           # api.php route registry
|   |   |-- OpenApi/          # OpenAPI specifications
|   |   |-- Observability/    # Optional counters, histograms, safe labels
|   |   `-- Support/          # ApiResponse, Logger, Environment
|   |-- templates/emails/     # PHPMailer email templates
|   |-- docs/                 # openapi.yaml, swagger-ui.html
|   |-- tests/                # Unit, Integration, Fixtures
|   |-- storage/              # Runtime writable (logs, cache)
|   |-- composer.json
|   |-- composer.lock
|   |-- phpunit.xml
|   `-- .env.example
|-- frontend/                 # React + Vite + Tailwind CSS Single-Page Application
|   |-- public/               # Static icons, favicon, manifest
|   |-- src/
|   |   |-- app/              # App root, router, global providers
|   |   |-- assets/           # Client images, static media
|   |   |-- components/ui/    # Reusable UI controls (Button, Input, Modal, StatusBadge, etc.)
|   |   |-- features/         # Feature modules (auth, appointments, patients, dentists, services, notifications, dashboard)
|   |   |-- layouts/          # PublicLayout, AdminLayout, PatientLayout, DentistLayout
|   |   |-- lib/              # apiClient.js, socketClient.js
|   |   |-- styles/           # global.css
|   |   |-- utils/            # dateTime.js, formatCurrency.js, permissions.js
|   |   |-- tests/            # Component and unit tests
|   |   `-- main.jsx          # React DOM entry point
|   |-- index.html
|   |-- package.json
|   |-- vite.config.js
|   |-- vitest.config.js
|   `-- .env.example
|-- realtime/                 # Node.js + Socket.IO real-time notification engine
|   |-- src/
|   |   |-- server.js         # HTTP server and Socket.IO initialization
|   |   |-- config.js         # Port, allowed origins, service secrets
|   |   |-- authentication.js # Signed ticket / token verification
|   |   |-- rooms.js          # Server-assigned rooms (user:<id>, role:admin, dentist:<id>)
|   |   |-- internalPublisher.js # Authenticated internal event ingest
|   |   |-- events.js         # Allowlisted broadcast event catalog
|   |   `-- metrics.js        # Optional prom-client metrics endpoint
|   |-- tests/                # Real-time event tests
|   |-- Dockerfile
|   |-- package.json
|   `-- .env.example
|-- database/                 # Relational database schema & migrations
|   |-- migrations/
|   |   |-- 001_create_users.sql
|   |   |-- 002_create_patients.sql
|   |   |-- 003_create_dentists.sql
|   |   |-- 004_create_services.sql
|   |   |-- 005_create_dentist_schedules.sql
|   |   |-- 006_create_appointments.sql
|   |   |-- 007_create_treatment_records.sql
|   |   |-- 008_create_notifications.sql
|   |   |-- 009_create_email_outbox.sql
|   |   |-- 010_create_auth_tokens.sql
|   |   `-- 011_create_audit_logs.sql
|   |-- seeds/                # Synthetic development & demo seeds
|   |   |-- development-users.sql
|   |   |-- sample-services.sql
|   |   `-- sample-clinic-data.sql
|   `-- schema.sql            # Full reference snapshot
|-- docker/                   # Container definitions & service images
|   |-- php/
|   |   |-- Dockerfile        # Hardened PHP 8.5.12-FPM runtime
|   |   `-- php.ini           # Production-safe PHP settings
|   |-- nginx/
|   |   `-- Dockerfile        # Multi-stage frontend build + Nginx runtime
|   `-- README.md             # Container conventions & build notes
|-- nginx/                    # Edge reverse proxy configuration & snippets
|   |-- nginx.conf            # Global worker, event, and MIME configuration
|   |-- conf.d/toothcare.conf # SPA, API FastCGI proxy, WebSocket upgrades, health
|   |-- snippets/
|   |   |-- security-headers.conf
|   |   `-- fastcgi-params.conf
|   `-- README.md
|-- monitoring/               # Observability stack (Prometheus & Grafana)
|   |-- prometheus/
|   |   |-- prometheus.yml    # Scrape targets & intervals
|   |   |-- rules/toothcare-alerts.yml # Alert thresholds (TargetDown, 5xx rate, latency)
|   |   `-- README.md
|   |-- grafana/
|   |   |-- provisioning/
|   |   |   |-- datasources/prometheus.yml
|   |   |   `-- dashboards/dashboards.yml
|   |   |-- dashboards/
|   |   |   |-- toothcare-overview.json
|   |   |   `-- infrastructure.json
|   |   `-- README.md
|   `-- README.md             # Observability architecture & port policy
|-- deployment/               # Release, rollback, health checks & fallback configs
|   |-- scripts/
|   |   |-- deploy.sh
|   |   |-- rollback.sh
|   |   `-- health-check.sh
|   |-- apache/               # XAMPP Apache VirtualHost fallback config
|   `-- README.md
|-- scripts/                  # Development & verification PowerShell helpers
|   |-- dev-setup.ps1
|   |-- run-tests.ps1
|   |-- generate-openapi.ps1
|   `-- check-project.ps1
|-- docs/                     # Architecture, security, runbooks, and phase registers
|   |-- phase-0/              # Phase 0 scope freeze and project brief
|   |-- phase-1/              # Phase 1 environment assessment & local setup
|   |-- architecture.md
|   |-- database-design.md
|   |-- directory-structure.md
|   |-- development-workflow.md
|   |-- api-guidelines.md
|   |-- testing-strategy.md
|   |-- deployment-runbook.md
|   |-- observability-runbook.md
|   `-- security-checklist.md
|-- compose.yaml              # Canonical Compose v2 base configuration
|-- compose.dev.yaml          # Local development overrides (ports, bind mounts)
|-- compose.prod.yaml         # Production overrides (locked ports, restarts)
|-- docker-compose.yml        # Backward-compatible alias
|-- docker-compose.prod.yml   # Backward-compatible production alias
|-- .dockerignore
|-- .editorconfig
|-- .env.example
|-- .gitignore
|-- README.md
`-- CONTRIBUTING.md
```
