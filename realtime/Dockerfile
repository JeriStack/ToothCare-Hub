# ToothCare Hub Real-Time Notification Service (Node.js + TypeScript + Socket.IO)
FROM node:26-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* tsconfig.json ./
RUN npm install
COPY src ./src
COPY tests ./tests
RUN npm run build

FROM node:26-alpine AS runtime

WORKDIR /app
RUN chown -R node:node /app
USER node

COPY --chown=node:node package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=builder --chown=node:node /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

CMD ["node", "dist/src/server.js"]
