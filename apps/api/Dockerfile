# Production multi-stage Dockerfile for FlowPulse Backend (NestJS)
# Stage 1: Build & Prune
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install OpenSSL / CA certificates for Prisma
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy workspace package manifests
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy root configuration and API source code
COPY tsconfig.base.json ./
COPY apps/api ./apps/api

# Generate Prisma Client
RUN npm run db:generate -w apps/api

# Build NestJS application
RUN npm run build -w apps/api

# Prune devDependencies to keep image minimal
RUN npm prune --omit=dev
RUN mkdir -p /app/apps/api/node_modules

# Stage 2: Production Runner
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Install OpenSSL / CA certificates for Prisma client runtime
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3001

# Copy workspace dependencies and compiled output with node ownership
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --chown=node:node --from=builder /app/apps/api/dist ./apps/api/dist
COPY --chown=node:node --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --chown=node:node --from=builder /app/package.json ./package.json

WORKDIR /app/apps/api

# Non-root user execution
USER node

EXPOSE 3001

# Healthcheck using Node runtime native fetch
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/api/v1/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main.js"]
