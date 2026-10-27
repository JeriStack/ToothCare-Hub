# Nginx Reverse Proxy Configuration

This directory is part of the approved ToothCare Hub root layout for edge and reverse-proxy configuration and documentation.

## Responsibilities

- **Public Entry Point:** Serves as the sole public HTTP/HTTPS ingress in containerized environments.
- **SPA Routing (`/`):** Serves the compiled React + Vite static bundle and provides an `index.html` history fallback for client-side React Router paths without shadowing `/api/`.
- **PHP REST API Routing (`/api/*`):** Forwards API requests via FastCGI to `backend:9000` (`backend/public/index.php` front controller), keeping `backend/src/`, `backend/config/`, `backend/vendor/`, `backend/storage/`, and `.env` outside the web root.
- **WebSocket Upgrade (`/socket.io/*`):** Proxies persistent Socket.IO connections to `realtime:4000` with HTTP/1.1 `Upgrade` and `Connection` headers.
- **Security Boundary:** Blocks public access to hidden files (`.env`, `.git`), Swagger UI in production, and internal metrics/status paths.

## Active Configuration Files

The active container mount configuration used by `docker-compose.yml` and `docker-compose.prod.yml` resides at:

- [`docker/nginx/conf.d/toothcare.conf`](../docker/nginx/conf.d/toothcare.conf)
- [`docker/nginx/ssl/`](../docker/nginx/ssl/) *(local/production TLS mount target; private keys are ignored by Git)*

