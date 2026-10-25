# syntax=docker/dockerfile:1

# Multi-stage build so the image we actually deploy is small: Next.js traces
# only the files the app needs at runtime into .next/standalone, and we copy
# just those (plus the Prisma CLI for the migrate step) into a slim runner.
# The old setup shipped the entire node_modules (~431 MB image); this is a
# fraction of that, so pushing, pulling and starting on Railway are faster.

# ---- deps: install all dependencies (dev ones are needed to build) ----
FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: generate the Prisma client and build the standalone server ----
FROM node:22-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ---- runner: slim image with only what's needed to run in production ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# The self-contained server Next traced, plus the static assets server.js
# serves (standalone doesn't copy .next/static itself). This project has no
# public/ directory, so there's nothing to copy there.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# The Prisma CLI, its engines and the schema + migrations, so the pre-deploy
# `prisma migrate deploy` runs here without having to fetch anything.
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "server.js"]
