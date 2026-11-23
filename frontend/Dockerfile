# syntax=docker/dockerfile:1

# ---- Build stage ------------------------------------------------------------
# Runs on the build machine's own platform, also when building for another one:
# the output is plain JavaScript (no native modules), so it is the same for
# amd64 and arm64, and the build doesn't have to run under emulation.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

# Install dependencies first (cached layer). Scripts are skipped because the
# "postinstall" step (nuxt prepare) needs the source files, which come next.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
RUN pnpm build

# ---- Runtime stage ----------------------------------------------------------
# Only the compiled server output is copied: no node_modules, no source, no .env.
# All configuration (Keycloak values, secrets, URLs) is read from environment
# variables at start-up. Nothing environment-specific is baked into this image.
FROM node:22-alpine AS runtime
# Shown on the protected page. Set by the CI, e.g.
#   docker build --build-arg APP_VERSION=1.2.0 --build-arg APP_BUILD_TIME=$(date -u +%FT%TZ) .
ARG APP_VERSION=dev
ARG APP_BUILD_TIME=
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    APP_VERSION=$APP_VERSION \
    APP_BUILD_TIME=$APP_BUILD_TIME
WORKDIR /app
COPY --from=build --chown=1000:1000 /app/.output ./.output

# Numeric user (the "node" user of the base image).
USER 1000:1000
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
