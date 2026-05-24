FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY prisma/schema.postgres.prisma prisma/schema.prisma
RUN npx prisma generate
RUN npm run build
RUN npm install -g prisma

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libssl3 openssl
RUN ln -sf /usr/lib/libssl.so.3 /usr/lib/libssl.so.1.1
RUN ln -sf /usr/lib/libcrypto.so.3 /usr/lib/libcrypto.so.1.1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/scripts ./scripts

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npx prisma@5.22.0 db push --skip-generate --accept-data-loss && node scripts/startup-check.mjs && node server.js"]
