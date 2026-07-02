# --- 1) Bağımlılıklar ---
FROM node:22-slim AS deps
WORKDIR /app
# better-sqlite3 (yalnızca DATABASE_URL tanımlı değilse fallback olarak kullanılır)
# native modül olduğu için derleme araçları gerekiyor.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci

# --- 2) Build ---
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build sırasında DB'ye bağlanılmaya çalışılmasın diye dummy bir DATABASE_URL yeterli
# (API route'ları build-time'da çalıştırılmıyor, sadece statik sayfalar derleniyor).
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- 3) Çalışma zamanı ---
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

# `output: 'standalone'` sayesinde çalışma zamanı için gereken minimum dosya seti
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
