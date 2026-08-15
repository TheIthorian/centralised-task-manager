FROM node:26.7.0-alpine3.23 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"
RUN apk upgrade --no-cache && corepack enable

# ---- prune: extract only what apps/main needs ----
FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.10.6 prune @ctm/main --docker

# ---- install: install pruned deps ----
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# ---- build: compile TypeScript ----
FROM installer AS builder
COPY --from=pruner /app/out/full/ .
RUN pnpm build --filter=@ctm/main...

# ---- runner: lean production image ----
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
# Copy the whole workspace: pnpm links the @ctm/* deps from apps/main/node_modules
# into packages/*, so they cannot be resolved from the root node_modules alone.
COPY --from=builder /app ./
# Runs as root: EXPORT_DIR points at a Railway volume, whose mount point is
# root-owned, so an unprivileged user cannot create the export directory in it.
EXPOSE 3000
CMD ["node", "apps/main/dist/main.js"]
