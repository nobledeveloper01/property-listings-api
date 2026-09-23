# Multi-stage so the shipped image carries the built JavaScript and the
# production dependencies, and none of the toolchain that produced them.

FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.5.2 --activate

# Manifests first. They change far less often than source, so an edit to a
# controller reuses the cached install layer instead of refetching the tree.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod


FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# node:alpine ships an unprivileged `node` user. Running as root inside a
# container turns a process compromise into a container compromise.
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node package.json ./

USER node
EXPOSE 3000

# The orchestrator restarts an unhealthy container, which it can only do if the
# container tells the truth about itself. /health checks the database too.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Migrations are deliberately not run here. A container that migrates on start
# races every other replica during a rolling deploy; migrating is a deploy step
# that runs once. See `pnpm migration:run:prod`.
CMD ["node", "dist/main"]
