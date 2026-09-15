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

RUN chown -R iougurt:iougurt /app

USER iougurt

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma generate && npm run dev"]

# ── Production ────────────────────────────────────────
FROM base AS prod

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate && npm run build

RUN chown -R iougurt:iougurt /app

USER iougurt

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
