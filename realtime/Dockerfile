# ToothCare Hub Real-Time Notification Service (Node.js + TypeScript + Socket.IO)
# Phase 20 Hardened Multi-Stage Build: deterministic npm ci, non-root runtime, graceful shutdown
FROM node:26-alpine AS builder

WORKDIR /app
ENV NODE_OPTIONS="--dns-result-order=ipv4first"
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --maxsockets=5
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:26-alpine AS runtime

WORKDIR /app
ENV NODE_OPTIONS="--dns-result-order=ipv4first"
RUN set -eu; \
    for attempt in 1 2 3 4 5; do \
        apk upgrade --no-cache --timeout 30 && break; \
        if [ "$attempt" -eq 5 ]; then exit 1; fi; \
        echo "apk upgrade transient failure (attempt $attempt/5), retrying..." >&2; \
        sleep 3; \
    done \
    && chown -R node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

CMD ["node", "dist/src/server.js"]
