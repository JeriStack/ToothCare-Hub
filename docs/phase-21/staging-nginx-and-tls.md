# Staging Nginx Routing & TLS Configuration

Staging runs the identical immutable `toothcare-frontend:<tag>` Nginx image (`docker/nginx/production.conf`) used in production:

- **Frontend SPA:** `/` serves compiled React assets with history fallback (`try_files $uri $uri/ /index.html;`) and 1-year immutable caching on `/assets/`.
- **PHP API:** `/api/` proxies strictly to `php-fpm:9000` front controller (`/var/www/backend/public/index.php`), preserving session cookies and `X-CSRF-Token`.
- **Socket.IO:** `/socket.io/` proxies HTTP/1.1 WebSocket upgrades to `realtime:4000` with `86400s` read/send timeouts and `WSS` under TLS.
- **Security Edge:** `/api/v1/internal/*`, `/api/v1/metrics`, and `/stub_status` return `403` publicly and are served only on internal port `8081`.
- **TLS Termination:** Mount Let's Encrypt staging/production certs read-only at `./docker/nginx/ssl/` and activate `docker/nginx/production-tls.conf.example`. (If staging runs behind a cloud reverse proxy/Cloudflare Tunnel, document TLS termination boundary and set `SESSION_COOKIE_SECURE=true`.)
