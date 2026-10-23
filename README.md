# ToothCare Hub

A web-based dental appointment and clinic management system. ToothCare Hub lets patients
book appointments, dentists manage their schedules, and clinic staff administer services,
treatment records, and reporting, with secure role-based access and real-time notifications.

## Stack

- **Frontend:** React + Vite
- **Backend:** Native PHP REST API (`/api/v1`)
- **Database:** MySQL
- **Email:** PHPMailer (SMTP)
- **Real-time:** Node.js + Socket.IO
- **Testing:** PHPUnit (backend), Vitest + React Testing Library (frontend)
- **API docs:** OpenAPI / Swagger UI
- **CI/CD:** GitHub Actions

## Repository layout

| Path         | Purpose                                                         |
| ------------ | --------------------------------------------------------------- |
| `frontend/`  | React + Vite single-page application                            |
| `backend/`   | PHP REST API (controllers, services, repositories, middleware)  |
| `database/`  | Ordered SQL migrations, seeds, and schema snapshot              |
| `realtime/`  | Node.js + Socket.IO notification service                        |
| `deployment/`| Apache config and deploy/rollback/health-check scripts          |
| `docs/`      | Architecture, database design, workflow, and security docs      |
| `scripts/`   | Windows PowerShell helpers for local dev tasks                  |
| `.github/`   | CI/CD workflows and issue / PR templates                        |
| `docker/`    | Container configs: Nginx, PHP-FPM, Prometheus, Grafana          |

See `docs/directory-structure.md` for the full annotated tree.

## Containerized stack (optional)

The app can run as a multi-container stack with an Nginx reverse proxy and a
Prometheus + Grafana observability pair:

```
docker compose up -d
```

| Service    | URL                    |
| ---------- | ---------------------- |
| App (Nginx)| http://localhost:8080  |
| Prometheus | http://localhost:9090  |
| Grafana    | http://localhost:3000  |

For production overrides (TLS, restart policies):

```
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Prerequisites

- PHP 8.x with Composer
- Node.js 18+ and npm
- MySQL 8.x (XAMPP/MariaDB works for local development)

## Local setup

1. Copy the example environment files and fill in local values:
   ```
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   cp realtime/.env.example realtime/.env
   ```
2. Install backend dependencies: `cd backend && composer install`
3. Install frontend dependencies: `cd frontend && npm install`
4. Install realtime service dependencies: `cd realtime && npm install`

## Database setup

Apply the ordered migrations in `database/migrations/` (001 → 008), then optionally load
the synthetic seed data in `database/seeds/`. Never run migrations or seeds against a
production database.

## Running

- Backend API: point Apache's document root at `backend/public/`
- Frontend: `cd frontend && npm run dev`
- Realtime: `cd realtime && npm start`

## Tests

- Backend: `cd backend && ./vendor/bin/phpunit`
- Frontend: `cd frontend && npm test`
- Realtime: `cd realtime && npm test`

## API documentation

OpenAPI spec lives in `backend/docs/openapi.yaml` and is served via Swagger UI from
`backend/docs/swagger-ui.html` in development or a protected environment only.

## License

See [LICENSE](LICENSE).
