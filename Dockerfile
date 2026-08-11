# syntax=docker/dockerfile:1.7
# Multi-stage Next.js 14 Dockerfile for Railway (and any container host)
# Produces a slim runtime image using Next's standalone output.

# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
# libc6-compat is needed by some Node native modules on Alpine
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --prefer-offline

# ---------- builder ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* env vars are inlined into the client JS bundle at build time.
# Railway passes service variables as Docker build args automatically — we
# just have to declare them here so `npm run build` can read them.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- runner ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for safety
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy the standalone server + assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
