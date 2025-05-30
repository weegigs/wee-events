# Release Workflow Guide

This document outlines the new release process using Changesets and Turborepo.

## Overview

The project now uses:
- **Turborepo** for fast, cached builds
- **Changesets** for version management and publishing
- **pnpm workspaces** for dependency management

## Development Workflow

### 1. Making Changes

When you make changes that should be released:

```bash
# After making your changes, create a changeset
pnpm changeset
```

This will:
- Prompt you to select which packages have changed
- Ask for the type of change (major, minor, patch)
- Let you write a summary of the changes

### 2. Building and Testing

```bash
# Run all builds with caching
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint

# Clean all packages
pnpm clean
```

### 3. Committing Changes

```bash
git add .
git commit -m "feat: your change description"

# The changeset files should be committed with your changes
git push
```

## Release Process

### 1. Version Bumping

When ready to release:

```bash
# This will bump versions according to changesets and update CHANGELOGs
pnpm version-packages
```

This command:
- Reads all changeset files
- Bumps package versions appropriately
- Updates CHANGELOG.md files
- Removes consumed changeset files

### 2. Publishing

```bash
# Build and publish all packages
pnpm release
```

This command:
- Runs `turbo run build` to ensure all packages are built
- Publishes changed packages to npm

## Turborepo Benefits

### Caching
- **Cache hits**: Subsequent builds of unchanged packages take ~37ms
- **Parallel execution**: Packages build in parallel based on dependency graph
- **Smart rebuilding**: Only rebuilds packages that have changed

### Performance Comparison
- **Before (Lerna)**: ~3-5 minutes for full build
- **After (Turborepo)**: ~2.5 seconds for full build (with caching: ~37ms)

## Commands Reference

| Command | Description |
|---------|-------------|
| `pnpm changeset` | Create a changeset for your changes |
| `pnpm version-packages` | Bump versions based on changesets |
| `pnpm release` | Build and publish packages |
| `pnpm build` | Build all packages |
| `pnpm compile` | Compile TypeScript |
| `pnpm test` | Run all tests |
| `pnpm lint` | Run ESLint on all packages |
| `pnpm clean` | Clean all build artifacts |

## Changeset Types

- **patch**: Bug fixes, small changes (0.0.X)
- **minor**: New features, backwards compatible (0.X.0)
- **major**: Breaking changes (X.0.0)

## Best Practices

1. **Always create changesets** for user-facing changes
2. **Write descriptive changeset summaries** - they become CHANGELOG entries
3. **Use semantic versioning** appropriately
4. **Test locally** before publishing
5. **Review version bumps** before releasing

## Troubleshooting

### Build Failures
If builds fail, check:
1. TypeScript compilation errors
2. Lint errors
3. Test failures

### Cache Issues
To clear Turborepo cache:
```bash
pnpm exec turbo run build --force
```

### Publishing Issues
If publishing fails:
1. Check npm authentication
2. Verify package names don't conflict
3. Ensure versions haven't been published before