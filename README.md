# Wee Events

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/518416c1092549ab858b18800ccef0e1)](https://www.codacy.com/gh/weegigs/wee-events/dashboard?utm_source=github.com&utm_medium=referral&utm_content=weegigs/wee-events&utm_campaign=Badge_Grade)

A TypeScript event sourcing framework with DynamoDB storage, Effect-TS integration, and comprehensive tooling.

## Quick Start

**Prerequisites:** [mise](https://mise.jdx.dev/) or Node.js 22.15.1+ and pnpm 10.11.0+

```sh
# Setup (with mise)
mise install

# Install and build
pnpm install
pnpm build

# Test and lint
pnpm test
pnpm lint
```

## Package Structure

**Core Packages:**
- `packages/core` - Event system and domain types
- `packages/dynamo-event-store` - DynamoDB event storage
- `packages/effects` - Effect-TS AWS integrations
- `packages/fastify` - Web server with OpenAPI support

**Utilities:**
- `packages/common` - Shared utilities (retry, sleep, encoders)
- `packages/cypher` - Encryption/decryption (AES, RSA)
- `tools/events` - CLI tools

## Dependency Management

Uses **pnpm catalog** for centralized version management:

```sh
pnpm deps:check     # Check outdated dependencies
pnpm deps:sync      # Update catalog to latest versions
pnpm deps:verify    # Verify catalog consistency
```

## Technology Stack

- **TypeScript** with strict configuration and composite builds
- **Effect-TS** for functional programming and dependency management
- **Turbo** for monorepo task orchestration and caching
- **pnpm workspaces** with catalog dependency management
- **DynamoDB** for event storage with AWS integrations
- **Fastify** with OpenAPI 3.1 schema generation
- **Jest** with swc for fast testing

## Docker Support

Multi-stage Dockerfile for containerized deployments:

```sh
# Build and run fastify sample service
docker build --target fastify-sample -t wee-events-fastify-sample .
docker run -p 3000:3000 wee-events-fastify-sample
```

## Development

**Individual package commands:**
```sh
pnpm --filter @weegigs/events-core build
pnpm --filter @weegigs/events-fastify test
pnpm --filter @weegigs/events-effects lint
```

**Features:**
- Turbo caching for fast rebuilds
- TypeScript composite builds with proper dependency order
- Jest testing with swc compilation and HTML coverage reports
- ESLint with TypeScript and Prettier configurations
