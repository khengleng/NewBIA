# BIA Blockchain Service - Dockerfile
FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl wget netcat-openbsd && rm -rf /var/lib/apt/lists/*

# Dependencies stage
FROM node:20-bookworm AS deps
WORKDIR /app

# Copy package files
COPY boutique-advisory-platform/blockchain-service/package*.json ./
# Remove existing lockfile to ensure fresh binary downloads for the target architecture
RUN rm -f package-lock.json

# Install dependencies
RUN npm install --no-audit --no-fund

# Builder stage
FROM node:20-bookworm AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY boutique-advisory-platform/blockchain-service/ .
RUN npm run build
RUN if [ ! -f start.sh ]; then printf "#!/bin/sh\nnpm run start:prod\n" > start.sh; fi && chmod +x start.sh

# Runner stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=9100
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 expressjs

COPY --from=builder --chown=expressjs:nodejs /app/dist ./dist
COPY --from=builder --chown=expressjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=expressjs:nodejs /app/package*.json ./
COPY --from=builder --chown=expressjs:nodejs /app/start.sh ./start.sh

USER expressjs
EXPOSE 9100
CMD ["./start.sh"]
