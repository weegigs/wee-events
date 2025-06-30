# Development Tooling

This document describes the development tools and their configuration used in the wee-events monorepo.

## Tool Management

### mise
**Purpose**: Tool version management and task automation

**Configuration**: `.mise.toml`

**Managed Tools**:
- **Node.js**: v22.15.1 - JavaScript runtime
- **pnpm**: v10.2.1 - Package manager and workspace orchestration
- **lefthook**: latest - Git hooks management
- **just**: latest - Command runner and build dependency management

**Key Features**:
- Automatic tool installation when entering project directory
- Version consistency across development environments
- Task automation via `mise run <task>`

**Usage**:
```bash
mise install          # Install all tools
mise current          # Show active tool versions
mise use node@22.15.1 # Update Node.js version
```

---

## Package Management

### pnpm
**Purpose**: Fast, disk space efficient package manager with workspace support

**Configuration**: `pnpm-workspace.yaml`, `package.json`

**Key Features**:
- Workspace dependency management
- Content-addressable storage (saves disk space)
- Strict dependency resolution
- Built-in monorepo support

**Workspace Structure**:
```
packages/
├── common/           # Shared utilities
├── core/            # Core event system
├── cypher/          # Encryption utilities
├── dynamo-event-store/ # DynamoDB implementation
├── effects/         # Effect-based AWS integrations
├── fastify/         # Web server implementation
└── nats/            # NATS messaging implementation

samples/
└── receipts/        # Example application

tools/
└── events/          # CLI tools (private package)
```

**Commands**:
```bash
just install                              # Install all dependencies
just build                           # Build all packages
just test         # Test all packages
```

---

## Build System

### Turbo
**Purpose**: Monorepo build system with caching and dependency orchestration

**Configuration**: `turbo.json`

**Key Features**:
- Incremental builds based on file changes
- Dependency-aware task execution
- Local and remote caching
- Parallel execution where possible

**Task Pipeline**:
- `compile` → TypeScript compilation
- `build` → Lint + compile + test (depends on `^build`)
- `test` → Run tests (depends on `^compile`)
- `lint` → ESLint validation

---

## Command Runner

### just
**Purpose**: Simple command runner with dependency tracking

**Configuration**: `justfile`

**Key Features**:
- Dependency-based execution (like make)
- Prevents unnecessary rebuilds
- Clean, readable syntax
- Integrates with existing pnpm/turbo workflow

**Usage**:
```bash
just build           # Build only if needed
just test            # Test (builds first if needed)
just release         # Full release process
just --list          # Show all available commands
```

---

## Version Control

### Git with lefthook
**Purpose**: Version control with automated quality checks

**Configuration**: `lefthook.yml`

**Git Hooks**:
- **pre-commit**: Lint staged files, validate commit messages
- **commit-msg**: Enforce conventional commit format

**Conventional Commits**:
- `feat:` → Minor version bump (new features)
- `fix:` → Patch version bump (bug fixes)
- `feat!:` or `BREAKING CHANGE:` → Major version bump

---

## Code Quality

### TypeScript
**Purpose**: Type-safe JavaScript with strict configuration

**Configuration**: `tsconfig.json` (per package)

**Features**:
- Strict type checking enabled
- Project references for monorepo support
- Incremental compilation

### ESLint
**Purpose**: Code linting and style enforcement

**Configuration**: Root eslint config

**Rules**:
- TypeScript-aware linting
- Prettier integration for formatting
- Consistent code style across packages

### Prettier
**Purpose**: Code formatting

**Configuration**: `package.json` prettier section

**Settings**:
- 120 character line width
- ES5 trailing commas
- Consistent formatting across all files

---

## Testing

### Vitest
**Purpose**: Fast unit testing framework

**Configuration**: Per-package `vitest.config.ts`

**Features**:
- TypeScript support out of the box
- Fast test execution
- Coverage reporting
- Testcontainers integration for integration tests

**Test Patterns**:
- Unit tests: `*.test.ts` or `*.spec.ts`
- Co-located with source files (not separate test directories)
- Integration tests use real dependencies via testcontainers

---

## Release Management

### release-it
**Purpose**: Automated release management

**Configuration**: `.release-it.json`

**Features**:
- Conventional commit analysis for version bumping
- Synchronized versioning across all packages
- Changelog generation
- npm publishing
- GitHub releases

**Workflow**:
- Analyzes conventional commits
- Determines version bump (patch/minor/major)
- Updates package.json files
- Generates CHANGELOG.md
- Creates git tags
- Publishes to npm

---

## Development Workflow

### Local Development Setup
```bash
# Clone and setup
git clone <repo>
cd wee-events
# mise automatically installs tools and runs lefthook install

# Install dependencies
just install

# Build everything
just build

# Run tests
just test

# Release
just release
```

### IDE Configuration

**Recommended VS Code Extensions**:
- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- GitLens

**Workspace Settings**:
- TypeScript strict mode enabled
- ESLint auto-fix on save
- Prettier format on save

---

## Environment Variables

**Required for development**:
- None (all development dependencies self-contained)

**Required for releases**:
- `GITHUB_TOKEN` - For automated GitHub releases
- `NPM_TOKEN` - For npm publishing (or use `npm login`)

**Optional**:
- Testcontainers may require Docker environment variables

---

## Troubleshooting

### Tool Installation Issues
```bash
mise doctor                    # Check mise configuration
mise install                  # Reinstall all tools
```

### Build Issues
```bash
just clean                    # Clean all build artifacts
just install # Reinstall dependencies
just build                    # Rebuild everything
```

### Git Hook Issues
```bash
lefthook install              # Reinstall git hooks
lefthook run pre-commit       # Test hooks manually
```

### Package Issues
```bash
pnpm run fix:typescript-references  # Fix TypeScript project references
pnpm audit --fix                    # Fix security issues
```

---

## Best Practices

1. **Always use the managed tool versions** - Don't install Node.js/pnpm globally
2. **Let just handle build dependencies** - Don't run pnpm build directly
3. **Use workspace dependencies** - Reference packages via `workspace:^`
4. **Follow conventional commits** - They drive automatic versioning
5. **Test with real dependencies** - Use testcontainers over mocks
6. **Keep packages focused** - Each package should have a single responsibility