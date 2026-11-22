# =============================================================================
# ToothCare Hub — Multi-Stage Production Frontend & Nginx Edge Image (Phase 20)
# Build context: repository root (.)
# =============================================================================

# Stage 1: Deterministic React + Vite production build (no secrets in build args)
FROM node:24-alpine AS frontend-builder
WORKDIR /app
ENV NODE_OPTIONS="--dns-result-order=ipv4first"
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --maxsockets=5
COPY frontend/ ./
RUN npm run build && test -f /app/dist/index.html

# Stage 2: Minimal pinned Nginx Stable Alpine 3.24 runtime (no Node.js, no node_modules)
FROM nginx:stable-alpine3.24 AS runtime

RUN apk upgrade --no-cache

COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/snippets/ /etc/nginx/snippets/
COPY docker/nginx/production.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/dist /var/www/frontend/dist

RUN rm -f /etc/nginx/conf.d/toothcare.conf \
    && chmod -R a+rX /var/www/frontend/dist

EXPOSE 80 443
STOPSIGNAL SIGQUIT

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
