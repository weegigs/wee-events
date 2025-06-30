# Wee Events

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/518416c1092549ab858b18800ccef0e1)](https://www.codacy.com/gh/weegigs/wee-events/dashboard?utm_source=github.com&utm_medium=referral&utm_content=weegigs/wee-events&utm_campaign=Badge_Grade)

A TypeScript event sourcing framework with DynamoDB storage, Effect-TS integration, and comprehensive tooling.

## Getting Started

**Prerequisites:** [mise](https://mise.jdx.dev/) is recommended for automatic tool setup.

1.  **Install Tools & Dependencies**: `mise install` will set up the correct versions of Node.js, pnpm, and other tools.
2.  **Run Commands**: Use `just` to see and run all common tasks.

```sh
just                    # Show all available commands
just build              # Build all packages (with Turbo caching)
just test               # Run all tests
just lint               # Run linting
just release            # Start an interactive release
```

*For manual setup without mise, see [Development Tooling](docs/tooling.md).*

## Key Features

- **Type Safety**: Strict TypeScript with composite builds.
- **Intelligent Caching**: Turbo only rebuilds what has changed.
- **Real Dependency Testing**: Uses Testcontainers instead of mocks.
- **Automated Releases**: Conventional commits drive versioning.
- **Synchronized Versioning**: All packages share the same version.
- **Comprehensive Tooling**: `mise` + `just` for a streamlined workflow.

## Package Structure

- `packages/core`: Core event system and domain types.
- `packages/dynamo-event-store`: DynamoDB event storage implementation.
- `packages/effects`: Effect-TS integrations for AWS services.
- `packages/fastify`: Web server with OpenAPI support.
- `packages/nats`: NATS messaging implementation.
- `packages/common`: Shared utilities (e.g., retry, sleep).
- `packages/cypher`: Encryption and decryption utilities.
- `samples/receipts`: An example application demonstrating usage.
- `tools/events`: Internal CLI tools.

## Release Process

This project uses conventional commits to automate versioning and releases.

- `fix:` triggers a patch release.
- `feat:` triggers a minor release.
- `feat!:` or a `BREAKING CHANGE:` footer triggers a major release.

To release, run `just release` for an interactive, guided process. For more details, see the [Release Process Documentation](docs/release-process.md).

## Contributing

1.  Run `mise install` to set up the development environment.
2.  Use conventional commits for all changes (enforced by git hooks).
3.  Run `just build` before submitting a pull request.

## Documentation

- **[Coding Practices](docs/coding-practices.md)**: Standards and patterns for development.
- **[Release Process](docs/release-process.md)**: Detailed release workflow.
- **[Development Tooling](docs/tooling.md)**: Guide to tools and setup.
