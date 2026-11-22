# ToothCare Hub Real-Time Notification Service (Node.js + TypeScript + Socket.IO)
# Phase 20 Hardened Multi-Stage Build: deterministic npm ci, non-root runtime, graceful shutdown
FROM node:24-alpine AS builder

WORKDIR /app
ENV NODE_OPTIONS="--dns-result-order=ipv4first"
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --maxsockets=5
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_OPTIONS="--dns-result-order=ipv4first"
RUN apk upgrade --no-cache && chown -R node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --maxsockets=5 && npm cache clean --force
COPY --from=builder --chown=node:node /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

CMD ["node", "dist/src/server.js"]
