# =============================================================================
# ToothCare Hub — GNU Makefile
# Cross-platform project automation (Windows GNU Make, Linux, macOS)
# Run `make` or `make help` to list available commands.
# =============================================================================

.DEFAULT_GOAL := help

COMPOSE_DEV        := docker compose -f compose.yaml -f compose.dev.yaml
COMPOSE_MONITORING := docker compose --profile monitoring -f compose.yaml -f compose.dev.yaml
COMPOSE_ALL        := docker compose --profile monitoring --profile mail --profile tools -f compose.yaml -f compose.dev.yaml
COMPOSE_ANY        := docker compose --profile "*" -f compose.yaml -f compose.dev.yaml
COMPOSE_PROD       := docker compose -f compose.yaml -f compose.prod.yaml

PHP      ?= php
COMPOSER ?= composer
NPM      ?= npm
SERVICE  ?= php-fpm

.PHONY: help \
	up up-all up-monitoring up-docs build rebuild start stop down restart ps logs validate-compose \
	frontend-install frontend-dev frontend-build frontend-test frontend-audit \
	backend-install backend-test backend-test-unit backend-test-integration backend-audit \
	openapi-generate openapi-check docs \
	realtime-install realtime-typecheck realtime-build realtime-test realtime-audit \
	migrate seed test ci e2e

# -----------------------------------------------------------------------------
# Help (uses Make's built-in $(info ...) for 100% Windows/Linux/macOS portability)
# -----------------------------------------------------------------------------
help:
	$(info ToothCare Hub - Available Make Targets)
	$(info )
	$(info Docker Stack:)
	$(info   make up                  Start core dev stack (Nginx :8080, PHP-FPM, MySQL :3306, Realtime :4000))
	$(info   make up-all              Start full stack (core + Monitoring + Mailpit + phpMyAdmin))
	$(info   make up-monitoring       Start core dev stack + Prometheus (:9090) and Grafana (:3001))
	$(info   make up-docs             Start optional offline standalone Swagger UI container (:8082))
	$(info   make build               Rebuild images and start full stack)
	$(info   make rebuild             Force-recreate full stack and renew anonymous volumes (e.g. realtime dist))
	$(info   make start               Resume stopped containers across all profiles)
	$(info   make stop                Stop all containers across every profile (keeps containers and volumes))
	$(info   make down                Stop and remove all containers and networks (preserves all data volumes))
	$(info   make restart             Restart running containers across all profiles)
	$(info   make ps                  List status of all ToothCare containers across every profile)
	$(info   make logs SERVICE=name   Follow logs for a service (default: php-fpm))
	$(info   make validate-compose    Validate dev, prod, and monitoring Compose files)
	$(info )
	$(info Frontend (React + Vite):)
	$(info   make frontend-install    Install frontend dependencies cleanly (npm ci))
	$(info   make frontend-dev        Run Vite HMR dev server (:5173))
	$(info   make frontend-build      Build production frontend bundle (frontend/dist))
	$(info   make frontend-test       Run full frontend Vitest test suite)
	$(info   make frontend-audit      Run npm high-severity security audit)
	$(info )
	$(info Backend (PHP 8.5 + Composer):)
	$(info   make backend-install     Install backend Composer dependencies)
	$(info   make backend-test        Run full backend PHPUnit suite)
	$(info   make backend-test-unit   Run backend PHPUnit unit tests)
	$(info   make backend-test-integration  Run backend PHPUnit integration tests)
	$(info   make backend-audit       Validate composer.json and run composer security audit)
	$(info   make openapi-generate    Regenerate docs/openapi.yaml and backend/openapi/openapi.yaml)
	$(info   make openapi-check       Verify OpenAPI spec drift and route contract coverage)
	$(info   make docs                Verify OpenAPI spec and print Swagger UI URLs)
	$(info )
	$(info Realtime (Node.js + TypeScript + Socket.IO):)
	$(info   make realtime-install    Install realtime dependencies cleanly (npm ci))
	$(info   make realtime-typecheck  Run TypeScript strict typecheck)
	$(info   make realtime-build      Compile realtime TypeScript output)
	$(info   make realtime-test       Build and run realtime service tests)
	$(info   make realtime-audit      Run npm high-severity security audit)
	$(info )
	$(info Database and Quality Gates:)
	$(info   make migrate             Apply pending additive SQL migrations (database/migrate.php))
	$(info   make seed                Seed local development database (backend/scripts/seed.php))
	$(info   make test                Run backend unit, frontend Vitest, and realtime tests)
	$(info   make ci                  Run local CI verification gate (Compose, OpenAPI, Realtime, Frontend))
	$(info   make e2e                 Run local Playwright Chromium E2E tests)
	@:

# -----------------------------------------------------------------------------
# Docker Stack
# -----------------------------------------------------------------------------
up:
	$(COMPOSE_DEV) up -d

up-all:
	$(COMPOSE_ALL) up -d --remove-orphans

up-monitoring:
	$(COMPOSE_MONITORING) up -d --remove-orphans

up-docs:
	docker compose --profile docs -f compose.yaml -f compose.dev.yaml up -d swagger-ui

build:
	$(COMPOSE_ALL) up -d --build --remove-orphans

rebuild:
	$(COMPOSE_ALL) up -d --build --force-recreate --renew-anon-volumes --remove-orphans

start:
	$(COMPOSE_ALL) start

stop:
	$(COMPOSE_ANY) stop

down:
	$(COMPOSE_ANY) down --remove-orphans

restart:
	$(COMPOSE_ALL) restart

ps:
	$(COMPOSE_ANY) ps

logs:
	$(COMPOSE_ANY) logs -f $(SERVICE)

validate-compose:
	$(COMPOSE_DEV) config -q
	$(COMPOSE_PROD) config -q
	$(COMPOSE_MONITORING) config -q

# -----------------------------------------------------------------------------
# Frontend (React + Vite)
# -----------------------------------------------------------------------------
frontend-install:
	$(NPM) --prefix frontend ci

frontend-dev:
	$(NPM) --prefix frontend run dev

frontend-build:
	$(NPM) --prefix frontend run build

frontend-test:
	$(NPM) --prefix frontend test -- --run

frontend-audit:
	$(NPM) --prefix frontend audit --audit-level=high

# -----------------------------------------------------------------------------
# Backend (PHP 8.5 + Composer)
# -----------------------------------------------------------------------------
backend-install:
	$(COMPOSER) --working-dir=backend install --no-interaction --prefer-dist

backend-test:
	$(COMPOSER) --working-dir=backend test

backend-test-unit:
	$(COMPOSER) --working-dir=backend test:unit

backend-test-integration:
	$(COMPOSER) --working-dir=backend test:integration

backend-audit:
	$(COMPOSER) --working-dir=backend validate --strict
	$(COMPOSER) --working-dir=backend audit --no-interaction

openapi-generate:
	$(PHP) backend/scripts/generate-openapi.php

openapi-check:
	$(PHP) backend/scripts/generate-openapi.php --check
	$(PHP) backend/scripts/validate-openapi.php

docs: openapi-check
	$(info Built-in Swagger UI (auto-CSRF): http://localhost:8080/api-docs)
	$(info Swagger UI (API path):           http://localhost:8080/api/v1/docs)
	$(info Raw OpenAPI 3.0.3 YAML:          http://localhost:8080/api/v1/docs/openapi.yaml)
	$(info Optional standalone container:   make up-docs -> http://127.0.0.1:8082)
	@:

# -----------------------------------------------------------------------------
# Realtime (Node.js + TypeScript + Socket.IO)
# -----------------------------------------------------------------------------
realtime-install:
	$(NPM) --prefix realtime ci

realtime-typecheck:
	$(NPM) --prefix realtime run typecheck

realtime-build:
	$(NPM) --prefix realtime run build

realtime-test:
	$(NPM) --prefix realtime test

realtime-audit:
	$(NPM) --prefix realtime audit --audit-level=high

# -----------------------------------------------------------------------------
# Database (Non-Destructive)
# -----------------------------------------------------------------------------
migrate:
	$(PHP) database/migrate.php --no-backup

seed:
	$(PHP) backend/scripts/seed.php

# -----------------------------------------------------------------------------
# Combined Quality Gates & E2E
# -----------------------------------------------------------------------------
test: backend-test-unit frontend-test realtime-test

ci: validate-compose openapi-check realtime-typecheck realtime-test frontend-test frontend-build

e2e:
	$(NPM) run test:e2e:local
