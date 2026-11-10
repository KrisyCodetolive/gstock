# Image de production du frontend : la PWA construite, servie par Caddy, qui transmet
# /api, /sanctum et /storage à l'API Laravel (même origine : cookies Sanctum, ADR-008).
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Domaine principal (ex. gstock.app) : distingue la connexion centrale d'un espace.
ARG VITE_CENTRAL_DOMAIN=""
ENV VITE_CENTRAL_DOMAIN=$VITE_CENTRAL_DOMAIN
RUN npm run build

FROM caddy:2-alpine
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1/healthz || exit 1
