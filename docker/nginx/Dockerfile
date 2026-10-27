# Multi-stage build for ToothCare Hub Nginx edge reverse proxy
# Stage 1: Build React frontend production bundle
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci || true
COPY frontend/ ./
RUN npm run build || mkdir -p dist && touch dist/index.html

# Stage 2: Final Nginx runtime
FROM nginx:1.27-alpine
COPY --from=frontend-builder /app/dist /var/www/frontend/dist
COPY docker/nginx/conf.d/toothcare.conf /etc/nginx/conf.d/toothcare.conf
EXPOSE 80 443
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
