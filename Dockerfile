# Multi-stage Dockerfile for wee-events monorepo
# Builds everything from source and creates targeted runtime images

# Base stage - sets up the build environment
FROM node:22-alpine AS base

# Install system dependencies
RUN apk add --no-cache curl git

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json nx.json tsconfig.json ./

# Copy all package.json files to establish workspace structure
COPY packages/common/package.json ./packages/common/
COPY packages/core/package.json ./packages/core/
COPY packages/cypher/package.json ./packages/cypher/
COPY packages/dynamo-event-store/package.json ./packages/dynamo-event-store/
COPY packages/effects/package.json ./packages/effects/
COPY packages/fastify/package.json ./packages/fastify/
COPY packages/nats/package.json ./packages/nats/
COPY tools/events/package.json ./tools/events/
COPY samples/receipts/package.json ./samples/receipts/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy all source code
COPY packages/ ./packages/
COPY tools/ ./tools/
COPY samples/ ./samples/

# Build stage - compiles everything
FROM base AS builder

# Just compile without linting for Docker build
RUN pnpm exec turbo compile

# Receipt HTTP sample runtime stage
FROM node:22-alpine AS receipt-http-sample

# Install curl for health checks
RUN apk add --no-cache curl

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json nx.json tsconfig.json ./

# Copy package.json files for workspace structure
COPY packages/common/package.json ./packages/common/
COPY packages/core/package.json ./packages/core/
COPY packages/cypher/package.json ./packages/cypher/
COPY packages/dynamo-event-store/package.json ./packages/dynamo-event-store/
COPY packages/effects/package.json ./packages/effects/
COPY packages/fastify/package.json ./packages/fastify/
COPY packages/nats/package.json ./packages/nats/
COPY tools/events/package.json ./tools/events/
COPY samples/receipts/package.json ./samples/receipts/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/core/lib/ ./packages/core/lib/
COPY --from=builder /app/packages/common/lib/ ./packages/common/lib/
COPY --from=builder /app/packages/effects/lib/ ./packages/effects/lib/
COPY --from=builder /app/packages/fastify/lib/ ./packages/fastify/lib/
COPY --from=builder /app/samples/receipts/lib/ ./samples/receipts/lib/

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/healthz || exit 1

# Start the receipt HTTP server
CMD ["node", "samples/receipts/lib/http/server.js"]

# Receipt NATS sample runtime stage
FROM node:22-alpine AS receipt-nats-sample

# Install curl for health checks
RUN apk add --no-cache curl

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json nx.json tsconfig.json ./

# Copy package.json files for workspace structure
COPY packages/common/package.json ./packages/common/
COPY packages/core/package.json ./packages/core/
COPY packages/cypher/package.json ./packages/cypher/
COPY packages/dynamo-event-store/package.json ./packages/dynamo-event-store/
COPY packages/effects/package.json ./packages/effects/
COPY packages/fastify/package.json ./packages/fastify/
COPY packages/nats/package.json ./packages/nats/
COPY tools/events/package.json ./tools/events/
COPY samples/receipts/package.json ./samples/receipts/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/core/lib/ ./packages/core/lib/
COPY --from=builder /app/packages/common/lib/ ./packages/common/lib/
COPY --from=builder /app/packages/effects/lib/ ./packages/effects/lib/
COPY --from=builder /app/packages/fastify/lib/ ./packages/fastify/lib/
COPY --from=builder /app/packages/nats/lib/ ./packages/nats/lib/
COPY --from=builder /app/samples/receipts/lib/ ./samples/receipts/lib/

# Expose port for NATS communication (if needed)
EXPOSE 4222

# Start the receipt NATS server
CMD ["node", "samples/receipts/lib/nats/server.js"]