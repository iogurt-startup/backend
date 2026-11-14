FROM node:20-alpine AS base

RUN apk add --no-cache openssl libc6-compat
RUN addgroup -g 1001 iougurt && adduser -u 1001 -G iougurt -s /bin/sh -D iougurt

WORKDIR /app

# ── Dependencies ──────────────────────────────────────
FROM base AS deps

COPY package*.json ./
RUN npm ci --legacy-peer-deps

# ── Development ───────────────────────────────────────
FROM base AS dev

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN mkdir -p /app/uploads && chown -R iougurt:iougurt /app

USER iougurt

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma generate && npm run dev"]

# ── Builder (compila bundle ESM e poda devDependencies) ──
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate \
    && npm run build \
    && npm prune --omit=dev --legacy-peer-deps \
    && ./node_modules/.bin/prisma generate

# ── Production ────────────────────────────────────────
FROM base AS prod

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p /app/uploads && chown -R iougurt:iougurt /app

USER iougurt

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/health" || exit 1

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/server.js"]
