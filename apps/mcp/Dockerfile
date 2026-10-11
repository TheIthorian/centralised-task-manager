FROM node:26.10.0-alpine3.23 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"
RUN apk upgrade --no-cache && npm i -g pnpm@11.1.3

# ---- prune: extract only what apps/mcp needs ----
FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.10.6 prune @ctm/mcp --docker

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
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
# Copy the whole workspace: pnpm links the @ctm/* deps from apps/mcp/node_modules
# into packages/*, so they cannot be resolved from the root node_modules alone.
COPY --from=builder --chown=node:node /app ./
USER node
EXPOSE 3002
CMD ["node", "apps/mcp/dist/main.js"]
