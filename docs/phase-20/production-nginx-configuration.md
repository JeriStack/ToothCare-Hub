# Production Nginx Configuration Guide

Canonical production config: [`docker/nginx/production.conf`](../../docker/nginx/production.conf)  
Global HTTP & log format: [`nginx/nginx.conf`](../../nginx/nginx.conf)  
Security headers snippet: [`nginx/snippets/security-headers.conf`](../../nginx/snippets/security-headers.conf)

## Key Hardening Controls

1. **Static SPA & Caching:** `autoindex off`, `server_tokens off`, `try_files $uri $uri/ /index.html;`, 1-year `immutable` caching on fingerprinted `/assets/`, and `no-cache, no-store, must-revalidate` on `/index.html`.
2. **Strict PHP Front-Controller Routing:** `/api/` routes exclusively to `php-fpm:9000` with `SCRIPT_FILENAME /var/www/backend/public/index.php`; arbitrary `.php` files are denied (`403`).
3. **WebSocket Proxy (`/socket.io/`):** HTTP/1.1 `Upgrade` + `Connection "upgrade"`, `proxy_buffering off`, `86400s` read/send timeouts, and `X-Forwarded-Proto`.
4. **Public Edge Restrictions:** Blocks `/api/v1/internal/*`, `/api/v1/metrics`, `/stub_status`, hidden dotfiles (except `/.well-known/`), and sensitive directories/extensions.
5. **Internal Listener (`8081`):** Never published to the host; serves `/api/v1/internal/`, `/api/v1/metrics`, and `/stub_status` exclusively over internal Docker networks.
6. **Privacy-Safe Access Logging:** `nginx/nginx.conf` logs `$request_method $uri` (omitting query strings so tokens are never logged) with `$http_x_request_id` correlation.
