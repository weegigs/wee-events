# Wee Events

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/518416c1092549ab858b18800ccef0e1)](https://www.codacy.com/gh/weegigs/wee-events/dashboard?utm_source=github.com&utm_medium=referral&utm_content=weegigs/wee-events&utm_campaign=Badge_Grade)

A TypeScript event sourcing framework with DynamoDB storage, Effect-TS integration, and comprehensive tooling.

## Quick Start

**Prerequisites:** [mise](https://mise.jdx.dev/) (recommended) or Node.js 22.15.1+ and pnpm 10.2.1+

```sh
# Setup with mise (installs Node.js, pnpm, just, and lefthook automatically)
mise install

# Or see available commands
just

# Build everything
just build

# Run tests
just test

# Release (interactive)
just release
```

**Manual setup without mise:**
```sh
# Install dependencies and build
pnpm install
pnpm run build

# Test and lint
pnpm run test
pnpm run lint
```

## Development Workflow

**Primary commands via just:**
```sh
just                    # Show all available commands
just build              # Build all packages (with Turbo caching)
just test               # Run all tests
just lint               # Run linting
just release-dry        # Preview what would be released
just release            # Interactive release process
just clean              # Clean all build artifacts
just status             # Show project status
```


## Package Structure

**Core Packages:**
- `packages/core` - Event system and domain types
- `packages/dynamo-event-store` - DynamoDB event storage
- `packages/effects` - Effect-TS AWS integrations
- `packages/fastify` - Web server with OpenAPI support
- `packages/nats` - NATS messaging implementation

**Utilities:**
- `packages/common` - Shared utilities (retry, sleep, encoders)
- `packages/cypher` - Encryption/decryption (AES, RSA)

**Samples:**
- `samples/receipts` - Example application

**Tools:**
- `tools/events` - CLI tools (private package)

## Technology Stack

- **[mise](https://mise.jdx.dev/)** - Tool version management and task automation
- **[just](https://just.systems/)** - Command runner with dependency tracking
- **TypeScript** with strict configuration and composite builds
- **Turbo** for monorepo task orchestration and intelligent caching
- **pnpm workspaces** with catalog dependency management
- **Vitest** for fast testing with testcontainers integration
- **ESLint + Prettier** for code quality and formatting
- **lefthook** for Git hooks and conventional commit validation
- **release-it** with conventional changelog for automated releases

## Tool Management

All development tools are managed via **mise** for consistent versions:

- **Node.js 22.15.1** - JavaScript runtime
- **pnpm 10.2.1** - Package manager
- **just latest** - Command runner
- **lefthook latest** - Git hooks

```sh
mise current            # Show active tool versions
mise install           # Install all tools
```

## Release Process

**Conventional commits drive automatic versioning:**
```sh
git commit -m "feat: add new feature"     # Minor version bump
git commit -m "fix: resolve bug"          # Patch version bump  
git commit -m "feat!: breaking change"    # Major version bump
```

**Release workflow:**
```sh
just release-dry        # Preview release (safe to run)
just release            # Interactive release with validation
```

See [Release Process Documentation](docs/release-process.md) for details.

## Docker Support

Multi-stage Dockerfile for containerized deployments:

```sh
# Build and run fastify sample service
docker build --target fastify-sample -t wee-events-fastify-sample .
docker run -p 3000:3000 wee-events-fastify-sample
```

## Individual Package Development

**Work with specific packages:**
```sh
pnpm --filter @weegigs/events-core build
pnpm --filter @weegigs/events-fastify test
pnpm --filter @weegigs/events-effects lint
```

## Key Features

- **Intelligent caching** - Turbo only rebuilds what changed
- **Type safety** - Strict TypeScript with composite builds
- **Quality assurance** - Automated testing, linting, and security audits
- **Testcontainers** - Real dependency testing over mocks
- **Synchronized versioning** - All packages maintain same version
- **Conventional releases** - Automated from commit messages
- **Comprehensive tooling** - mise + just for streamlined development

## Documentation

- **[Development Tooling](docs/tooling.md)** - Complete guide to tools and setup
- **[Release Process](docs/release-process.md)** - Release workflow and conventional commits
- **[Coding Practices](docs/coding-practices.md)** - Development standards and patterns

## Contributing

1. Ensure you have [mise](https://mise.jdx.dev/) installed
2. Run `mise install` to set up the development environment
3. Use conventional commits for all changes
4. Run `just test` before submitting PRs
5. Use `just release-dry` to preview version impacts

All development tools and standards are automatically configured via mise and lefthook.