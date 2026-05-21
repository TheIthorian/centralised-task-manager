FROM node:24.15.0-alpine3.23 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"
RUN apk upgrade --no-cache && corepack enable

# ---- prune: extract only what apps/mcp needs ----
FROM base AS pruner
RUN pnpm add -g turbo
WORKDIR /app
COPY . .
RUN turbo prune @ctm/mcp --docker

# ---- install: install pruned deps ----
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# ---- build: compile TypeScript ----
FROM installer AS builder
COPY --from=pruner /app/out/full/ .
RUN pnpm build --filter=@ctm/mcp...

# ---- runner: lean production image ----
FROM node:24.15.0-alpine3.23 AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable
COPY --from=builder /app/apps/mcp/dist ./dist
COPY --from=builder /app/apps/mcp/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3002
CMD ["node", "dist/main.js"]
