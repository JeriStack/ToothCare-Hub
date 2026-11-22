# Production HTTPS & WSS TLS Configuration

Template: [`docker/nginx/production-tls.conf.example`](../../docker/nginx/production-tls.conf.example)

## 1. Certificate Provisioning & Mounting

- Never commit TLS private keys (`*.key`, `*.pem`) or copy certificates into Docker images (enforced by `.dockerignore`).
- Provision certificates via the deployment host's approved CA (e.g., Let's Encrypt/Certbot or institutional PKI) and mount read-only at `./docker/nginx/ssl:/etc/nginx/ssl:ro` (`fullchain.pem` and `privkey.pem`).
- Mount the TLS Nginx config in production once valid certificates exist, verify with `docker exec toothcare-nginx nginx -t`, and reload gracefully with `docker exec toothcare-nginx nginx -s reload`.

## 2. Protocol & Header Standards

- `ssl_protocols TLSv1.2 TLSv1.3;` with modern AEAD ciphers (`ECDHE-*-AES*-GCM-SHA*`) and `ssl_session_tickets off;`.
- Port `80` serves `/.well-known/acme-challenge/` and `/health`, redirecting all other traffic `301 https://$host$request_uri`.
- `Strict-Transport-Security "max-age=31536000; includeSubDomains"` is enabled **only** after verifying HTTPS on the target domain.
- Socket.IO automatically upgrades to `wss://` over port `443` with `X-Forwarded-Proto https`.

## 3. Certificate Renewal & Monitoring

- Automate renewal via host Certbot timer or ingress controller; run `certbot renew --dry-run` after initial setup.
- Monitor certificate expiration (alert at <= 30 days and critical at <= 7 days).
- **Verification Status:** Live domain TLS/WSS handshake and renewal are **NOT VERIFIED** in this local sandbox and must be verified during staging/production cutover.
