FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ---- prune: extract only what apps/sync needs ----
FROM base AS pruner
RUN pnpm add -g turbo
WORKDIR /app
COPY . .
RUN turbo prune @ctm/sync --docker

# ---- install: install pruned deps ----
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# ---- build: compile TypeScript ----
FROM installer AS builder
COPY --from=pruner /app/out/full/ .
RUN pnpm build --filter=@ctm/sync...

# ---- runner: lean production image ----
FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable
COPY --from=builder /app/apps/sync/dist ./dist
COPY --from=builder /app/apps/sync/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/main.js"]
