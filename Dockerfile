# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
# Install all deps including native (better-sqlite3 needs python/make)
RUN apk add --no-cache python3 make g++ \
  && npm ci --ignore-scripts=false

# ─── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env stubs so Next.js can validate at build time
# Real values are injected at runtime via docker-compose
ENV CF_API_TOKEN=build_placeholder \
    CF_ACCOUNT_ID=build_placeholder \
    CF_DASHBOARD_USER=build_placeholder \
    CF_DASHBOARD_PASS=build_placeholder \
    SESSION_SECRET=build_placeholder_session_secret_32ch

RUN npm run build

# ─── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy native better-sqlite3 binding built for this arch
COPY --from=deps /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

# Data directory (will be mounted as volume)
RUN mkdir -p /data && chown nextjs:nodejs /data

USER nextjs

EXPOSE 3000

ENV PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DB_PATH=/data/cf_spend.db

CMD ["node", "server.js"]
