# ToothCare Hub — Phase 1 Environment Assessment

**Document ID:** `TCH-P1-ENV-001`  
**Version:** `1.0`  
**Phase:** `Phase 1 — Repository, Local Environment, and Team Workflow`  
**Assessment Date:** `2026-10-27`  
**Workstation OS:** `Windows (win32, x64)`  
**Workspace Path:** `c:\xampp\htdocs\GitHub_Clone_File_Projects\ToothCare-Hub`

---

## 1. Executive Summary

A direct inspection of the developer workstation and repository was performed on `2026-10-27`. All core development prerequisites—**Git (`2.56.0.windows.2`)**, **GitHub CLI (`2.100.0`)**, **VS Code (`1.143.1`)**, **Node.js (`v24.19.0`)**, **npm (`12.0.2`)**, **PHP (`8.5.12` CLI & `8.5.9` XAMPP)**, **Composer (`2.10.2`)**, **Docker CLI (`29.9.2`)**, **Docker Compose (`v5.6.1`)**, **XAMPP MariaDB (`10.4.32-MariaDB`)**, and **phpMyAdmin**—are installed and available on the host.

All required PHP extensions (`PDO`, `pdo_mysql`, `openssl`, `mbstring`, `json`, `curl`, `fileinfo`) are verified loaded in both PHP CLI environments.

---

## 2. Development Tool Availability Matrix

| Tool / Component | Status (`PATH` / Installed / Service) | Detected Version & Binary Path | Verification Command Executed | Compatibility Assessment | Action / Notes |
|---|---|---|---|---|---|
| **Git** | Installed & on `PATH` | `git version 2.56.0.windows.2` | `git --version` | Compatible | Remote `origin` configured (`git@github.com:Palinje/ToothCare-Hub.git`); active branch `development`. |
| **GitHub CLI (`gh`)** | Installed & on `PATH` | `gh version 2.100.0 (2026-09-03)` | `gh --version` | Compatible | Optional helper for PR/issue management. |
| **VS Code** | Installed & on `PATH` | `1.143.1` (`e646868227c3e3a9e3f24277c8c7220be42c0be7`, `x64`) | `code --version` | Compatible | Active IDE workspace. |
| **Docker Engine / Desktop CLI** | Installed & on `PATH` | `Docker version 29.9.2, build a82e528` (`C:\Users\jeril\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe`) | `docker --version` | Compatible | Start Docker Desktop daemon prior to running container builds in Phase 2. |
| **Docker Compose** | Installed & on `PATH` (via `docker-compose.exe`) | `Docker Compose version v5.6.1` (`C:\Users\jeril\AppData\Local\Programs\DockerDesktop\resources\bin\docker-compose.exe`) | `docker-compose --version` | Compatible | **Note:** On this Windows host, invoke `docker-compose` (with hyphen) or enable the Compose v2 CLI subcommand in Docker Desktop settings. Both `docker-compose.yml` and `docker-compose.prod.yml` passed `docker-compose config -q` with exit code `0`. |
| **Node.js** | Installed & on `PATH` | `v24.19.0` | `node --version` | Compatible | Supports Vite, React, Vitest, and Socket.IO v4. Container builds pin `node:20-alpine` (or `22-alpine`). |
| **npm** | Installed & on `PATH` | `12.0.2` | `npm --version` | Compatible | Supports `package-lock.json` v3 and `npm ci`. |
| **PHP CLI (Primary `PATH`)** | Installed & on `PATH` | `PHP 8.5.12 (cli) (built: Oct 20 2026) (ZTS Visual C++ 2022 x64)` (`C:\php-8.5.12\php.exe`, `C:\php-8.5.12\php.ini`) | `php --version`, `php --ini` | **Verified Match** | Matches `FROM php:8.5.12-fpm-alpine3.24` in `docker/php/Dockerfile` and `"php": "^8.5"` in `backend/composer.json`. Includes security fixes for `CVE-2026-109618` and `CVE-2026-109619`. |
| **PHP CLI (XAMPP Secondary)** | Installed (`C:\xampp\php\php.exe`) | `PHP 8.5.9 (cli)` (`C:\xampp\php\php.ini`) | `C:\xampp\php\php.exe --version` | Compatible (Fallback) | Prefer primary `C:\php-8.5.12\php.exe` (default on `PATH`) or Docker container (`8.5.12`) so security patch levels match. |
| **Composer** | Installed & on `PATH` | `Composer version 2.10.2` (running on `PHP 8.5.12`) | `composer --version` | Compatible | Validated `backend/composer.json`. |
| **MySQL / MariaDB Client & Server** | Installed (`C:\xampp\mysql\bin\mysql.exe`); Docker `mysql:8.0` configured | `Ver 15.1 Distrib 10.4.32-MariaDB, for Win64 (AMD64)` | `C:\xampp\mysql\bin\mysql.exe --version` | Compatible with SQL portability rule | **Service Status:** Port `3306` was checked via `Get-NetTCPConnection` and no local listener was active during inspection, meaning Docker MySQL (`3306:3306`) will not collide unless XAMPP MySQL is started simultaneously. |
| **Database GUI Tool (`phpMyAdmin`)** | Installed locally | Found at `C:\xampp\phpMyAdmin` | `Test-Path "C:\xampp\phpMyAdmin"` | Optional convenience | Available for local inspection when XAMPP is used. |
| **API Client (`Postman` / Swagger UI)** | Optional convenience | Standalone Postman app not detected in `%LOCALAPPDATA%\Postman`; Swagger UI (`backend/docs/swagger-ui.html`) scaffolded in repo | `Test-Path "$env:LOCALAPPDATA\Postman"` | Non-blocking | Developers may use Swagger UI, VS Code REST/Thunder Client extensions, `curl`, or Postman Desktop. |

---

## 3. PHP Extension Verification Matrix

Inspected via `php -m` and `php --ini` across both installed PHP runtimes:

| Required Extension | Purpose in ToothCare Hub | Primary PHP `8.5.12` (`C:\php-8.5.12\php.ini`) | XAMPP PHP `8.5.9` (`C:\xampp\php\php.ini`) | Docker `php:8.5.12-fpm-alpine3.24` (`docker/php/Dockerfile`) |
|---|---|---|---|---|
| `PDO` | Database abstraction layer | **Loaded** | **Loaded** | **Compiled / Loaded** |
| `pdo_mysql` | MySQL / InnoDB driver & prepared statements | **Loaded** | **Loaded** | **Installed (`docker-php-ext-install pdo_mysql`)** |
| `openssl` | TLS SMTP (`PHPMailer`), random token entropy (`random_bytes`) | **Loaded** | **Loaded** | **Compiled / Loaded** |
| `mbstring` | UTF-8 (`utf8mb4`) string validation & sanitization | **Loaded** | **Loaded** | **Compiled / Loaded** |
| `json` | REST API request/response serialization | **Loaded** | **Loaded** | **Compiled / Loaded** |
| `curl` | HTTP client support | **Loaded** | **Loaded** | **Compiled / Loaded** |
| `fileinfo` | MIME validation for future upload checks | **Loaded** | **Loaded** | **Compiled / Loaded** |
| `Zend OPcache` | Bytecode caching | **Loaded (`v8.5.12`)** | **Loaded (`v8.5.9`)** | **Compiled / Loaded** |

### Full Module List (`C:\php-8.5.12\php.exe -m`)
`bcmath`, `calendar`, `Core`, `ctype`, `curl`, `date`, `dom`, `fileinfo`, `filter`, `hash`, `iconv`, `json`, `lexbor`, `libxml`, `mbstring`, `mysqli`, `mysqlnd`, `openssl`, `pcre`, `PDO`, `pdo_mysql`, `Phar`, `random`, `readline`, `Reflection`, `session`, `SimpleXML`, `SPL`, `standard`, `tokenizer`, `uri`, `xml`, `xmlreader`, `xmlwriter`, `Zend OPcache`, `zip`, `zlib`.

---

## 4. Port & Service Conflict Assessment

Checked active TCP listeners on ports `80, 443, 3306, 4000, 5173, 8080, 9090, 3000`:
- **Result:** None of these ports had an active listener during the Phase 1 check.
- **Canonical Environment Rule:** Docker Compose (`docker-compose.yml`) is the canonical environment:
  - Nginx binds to `8080:80` in development so it does not conflict if XAMPP Apache (`:80`) is started for other coursework.
  - Do **not** run XAMPP MySQL (`:3306`) at the same time as the Docker `mysql` container (`3306:3306`). If both are needed simultaneously, map the Docker host port in `.env` (`MYSQL_PORT=33060`) while keeping internal container-to-container port `3306`.

---

## 5. Identified Issues & Resolution Plan

| Issue ID | Observation | Impact | Resolution / Owner |
|---|---|---|---|
| `ENV-ISS-001` | `docker compose` (space-separated subcommand) is not registered on the CLI path, whereas `docker-compose.exe` (`v5.6.1`) **is** on `PATH`. | Running `docker compose ...` fails unless `docker-compose ...` is used or Docker Desktop Compose v2 alias is enabled. | Document both `docker-compose` and `docker compose` in `README.md` and `docs/phase-1/local-development.md`. *(Resolved in docs)* |
| `ENV-ISS-002` | `frontend/package.json` and `realtime/package.json` are currently `0-byte` scaffold files in Phase 1. | Running `docker-compose build` or `npm install` is deferred until Phase 2 / Phase 5 / Phase 14 when package manifests are populated. | Documented clearly in `README.md` and `docs/phase-1/local-development.md` as phase-gated commands. *(Expected for Phase 1)* |

