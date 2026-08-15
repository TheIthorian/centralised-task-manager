FROM node:26.7.0-alpine3.23 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"
RUN apk upgrade --no-cache && npm i -g pnpm@11.1.3

# ---- prune: extract only what apps/admin needs ----
FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.10.6 prune @ctm/admin --docker

# ---- install: install pruned deps ----
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# ---- build: compile TypeScript ----
FROM installer AS builder
COPY --from=pruner /app/out/full/ .
RUN pnpm build --filter=@ctm/admin...

# ---- runner: lean production image ----
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
# Copy the whole workspace: pnpm links the @ctm/* deps from apps/admin/node_modules
# into packages/*, so they cannot be resolved from the root node_modules alone.
COPY --from=builder /app ./
# Unlike apps/main this service writes nothing to disk, so it drops root.
USER node
EXPOSE 3100
CMD ["node", "apps/admin/dist/main.js"]
