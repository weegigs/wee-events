# Wee Events

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/518416c1092549ab858b18800ccef0e1)](https://www.codacy.com/gh/weegigs/wee-events/dashboard?utm_source=github.com&utm_medium=referral&utm_content=weegigs/wee-events&utm_campaign=Badge_Grade)

An event sourcing framework for TypeScript with support for multiple storage backends and runtime environments.

## Prerequisites

This project uses [mise](https://mise.jdx.dev/) for tool management. Install mise and run:

```sh
mise install
```

Or manually install the required tools:
- Node.js 22.15.1+
- pnpm 10.11.0+
- tsx (for running TypeScript scripts)
- Docker (for testing with testcontainers)

## Quick Start

```sh
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint
```

## Dependency Management

This monorepo uses **pnpm catalog** for centralized dependency management to ensure version consistency across all packages.

### Available Commands

**Check for outdated dependencies:**
```sh
pnpm deps:check
```

**Verify catalog consistency across packages:**
```sh
pnpm deps:verify
```

**Sync catalog with latest dependency versions:**
```sh
pnpm deps:sync
pnpm install  # Apply the updates
```

**Show outdated dependencies (native pnpm):**
```sh
pnpm deps:outdated
```

**Update all dependencies to latest:**
```sh
pnpm deps:update
```

### How It Works

1. **Centralized Versions**: Shared dependency versions are defined in the `pnpm.catalog` section of the root `package.json`
2. **Catalog References**: Packages use `"catalog:"` to reference centralized versions
3. **Consistency Checking**: The `deps:verify` command ensures all packages use catalog versions
4. **Automated Updates**: The `deps:sync` command automatically updates catalog versions to latest

### Example

```json
// root package.json
{
  "pnpm": {
    "catalog": {
      "typescript": "^5.8.3",
      "zod": "^3.25.42"
    }
  }
}

// packages/*/package.json
{
  "dependencies": {
    "zod": "catalog:"
  },
  "devDependencies": {
    "typescript": "catalog:"
  }
}
```

## Architecture

This is a **pnpm workspace monorepo** using **Turbo** for task caching and build orchestration.

### Package Structure

- **`packages/core`** - Core event system and domain types
- **`packages/common`** - Shared utilities (retry, sleep, encoders)
- **`packages/dynamo-event-store`** - DynamoDB event store implementation
- **`packages/cypher`** - Encryption/decryption utilities (AES, RSA)
- **`packages/effects`** - Effect-based AWS service integrations
- **`packages/fastify`** - Web server implementation with OpenAPI support
- **`tools/events`** - CLI tools and utilities

### Key Technologies

- **TypeScript** with strict configuration and composite builds
- **Turbo** for monorepo task orchestration and caching
- **pnpm workspaces** for dependency management with catalog support
- **Jest** for testing with swc preset for fast compilation
- **ESLint** with TypeScript and Prettier configurations
- **DynamoDB** for event storage
- **AWS services** integration through Effects package
- **Fastify** with OpenAPI 3.1 schema generation

## Docker Support

The project includes a multi-stage Dockerfile for containerized deployments:

```sh
# Build the fastify sample service
docker build --target fastify-sample -t wee-events-fastify-sample .

# Run the container
docker run -p 3000:3000 wee-events-fastify-sample
```

The Docker setup builds everything from source and creates optimized production images.

## Development

### Individual Package Commands

```sh
# Build specific package
pnpm --filter @weegigs/events-core build

# Test specific package  
pnpm --filter @weegigs/events-fastify test

# Lint specific package
pnpm --filter @weegigs/events-effects lint
```

### Build Dependencies

Packages have build dependencies ensuring proper compilation order:
- Tests depend on `^compile` to ensure compilation before testing
- Turbo caches `compile`, `test`, and `lint` operations for fast rebuilds

### Testing

Tests use `.spec.ts` or `.test.ts` extensions with Jest configuration that:
- Excludes `lib/`, `node_modules/`, and `tools/` from coverage
- Uses swc for fast TypeScript compilation
- Generates HTML coverage reports for packages

## Future Work

### Examples

There is a distinct lack of examples in the project, and no tutorial.

### TSEffect Alternative

TSEffect provides a useful model for managing dependencies and errors. Unfortunately it works best in a "turtles all the way down"
environment, especially when it comes to errors. This means that random throws in included code will, if you're not careful, lead
to unexpected results.
