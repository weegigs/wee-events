# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tool Management

This project uses **mise** for tool version management. The `.mise.toml` file defines:
- **Node.js**: v22.15.1 (automatically activated when entering project directory)
- **pnpm**: Latest version for package management
- **Claude Code**: Latest version for AI assistance
- **Lerna**: Latest version for monorepo management

### mise Commands
- `mise install` - Install all tools defined in .mise.toml
- `mise current` - Show currently activated tool versions
- `mise use node@22.15.1` - Update Node.js version
- `mise use npm:pnpm@latest` - Update pnpm version

## Development Commands

### Build and Test
- `pnpm install` - Install dependencies (uses frozen lockfile)
- `pnpm build` - Build all packages using Lerna
- `pnpm test` - Compile and run Jest tests with coverage
- `pnpm lint` - Run ESLint across all packages
- `pnpm compile` - Compile TypeScript without running tests

### Cleaning and Maintenance
- `pnpm clean` - Clean all packages recursively
- `pnpm fix:typescript-references` - Fix TypeScript project references
- `pnpm prepublish` - Clean and build (runs before publish)

### Individual Package Commands
Each package supports these scripts:
- `pnpm exec --filter <package-name> build` - Build specific package
- `pnpm exec --filter <package-name> test` - Test specific package
- `pnpm exec --filter <package-name> lint` - Lint specific package

## Architecture

This is a **Lerna monorepo** using **pnpm workspaces** for dependency management and **Nx** for task caching.

### Package Structure
- `packages/core` - Core event system and domain types
- `packages/common` - Shared utilities (retry, sleep, encoders)
- `packages/dynamo-event-store` - DynamoDB event store implementation
- `packages/cypher` - Encryption/decryption utilities (AES, RSA)
- `packages/effects` - Effect-based AWS service integrations
- `packages/fastify` - Web server implementation
- `tools/events` - CLI tools and utilities

### Key Technologies
- **TypeScript** with strict configuration
- **Effect-TS** for functional programming patterns (mentioned in README as potential alternative)
- **Lerna** for monorepo management
- **Jest** for testing with ts-jest preset
- **ESLint** with TypeScript and Prettier configurations
- **DynamoDB** for event storage
- **AWS services** integration through Effects package

### Build Dependencies
- Packages have `^build` dependencies ensuring proper build order
- Tests depend on `^compile` to ensure compilation before testing
- Nx caches `compile`, `test`, and `lint` operations

### Testing
- Tests use `.spec.ts` or `.test.ts` extensions
- Jest configuration excludes `lib/`, `node_modules/`, and `tools/` from coverage
- Some packages generate coverage reports in HTML format