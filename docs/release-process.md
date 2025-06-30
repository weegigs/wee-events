# Release Process

This document describes the comprehensive release process for the wee-events monorepo using release-it with conventional commits and mise automation.

## Overview

The release process is designed with multiple safety checkpoints and validation steps to ensure reliable, safe releases. It leverages conventional commit messages to automatically determine version bumps and generate changelogs. The process consists of 6 main phases:

1. **Preflight** - Comprehensive validation before any changes
2. **Dry Run** - Full simulation without modifications  
3. **Version** - Automated version bumping, changelog generation, and publishing
4. **Verify** - Post-release validation
5. **Rollback** - Emergency rollback procedures

## Release Tasks

### `mise run release-preflight`
**Purpose**: Comprehensive pre-release validation and safety checks

**What it does**:
- ✅ Validates git repository state (clean, on main, up-to-date)
- 🔒 Runs security audit for high/critical vulnerabilities  
- 📦 Uses conventional commits for versioning (no manual changesets needed)
- 🏗️ Validates build system with frozen lockfile
- 🧪 Runs full test suite, build, and linting
- 📊 Shows recent conventional commits

**When to use**: Always run this first before any release

**Safe to run**: ✅ Yes - no modifications made

---

### `mise run release-dry-run`
**Purpose**: Full release simulation without any changes

**What it does**:
- 📋 Analyzes conventional commits to determine version bumps
- 📝 Simulates version updates using `release-it --dry-run`
- 🏗️ Tests clean build from scratch
- 🧪 Runs full test suite
- 🔍 Validates code quality

**When to use**: After preflight passes, to validate the release

**Safe to run**: ✅ Yes - simulation only

---

### `mise run release-version`
**Purpose**: Complete automated release with version bumping, changelog generation, and publishing

**What it does**:
- 🔄 Runs `release-it` which automatically:
  - Analyzes conventional commits to determine version bumps
  - Updates all package.json versions (synchronized across workspace)
  - Generates/updates CHANGELOG.md files
  - Creates git commit and tags
  - Publishes packages to npm registry
  - Creates GitHub releases

**When to use**: After dry-run succeeds and you're ready to release

**Safe to run**: ⚠️ **NO** - modifies files, creates commits, publishes packages

**Next step**: Run release-verify to confirm publication

---

### `mise run release-publish`
**Purpose**: Information about the new integrated workflow

**What it does**:
- 📝 Explains that publishing is now integrated into `release-version`
- 📋 Shows available release commands
- ✅ No separate publish step needed

**When to use**: For information only

**Safe to run**: ✅ Yes - informational only

---

### `mise run release-verify`
**Purpose**: Post-release verification and validation

**What it does**:
- 🔍 Verifies packages are available on npm registry
- 📊 Shows release summary and git tags
- ✅ Confirms successful publication

**When to use**: After release-version completes

**Safe to run**: ✅ Yes - verification only

---

### `mise run release-rollback`
**Purpose**: Emergency rollback procedures

**What it does**:
- 🚨 Provides rollback guidance and commands
- 📝 Shows manual steps required for rollback
- ❌ **Manual intervention required**

**When to use**: Only in emergency situations

**Safe to run**: ✅ Yes - guidance only, no automatic actions

---

### `mise run release-full`
**Purpose**: Complete automated release pipeline

**What it does**:
- 🚀 Runs entire release pipeline automatically
- ⚠️ Includes 10-second countdown to cancel
- 🔄 Uses `release-it --ci` for full automation
- 🎉 Completes full release process

**When to use**: When you want fully automated release

**Safe to run**: ⚠️ **NO** - full release automation

## Recommended Workflow

### Standard Release Process

1. **Preparation**:
   ```bash
   # Ensure you're on main branch with clean working directory
   git checkout main
   git pull origin main
   git status  # Should be clean
   ```

2. **Ensure conventional commits** (no manual changesets needed):
   ```bash
   # Your commits should follow conventional format:
   # feat: add new feature
   # fix: resolve bug
   # BREAKING CHANGE: major change
   
   # Check recent commits
   git log --oneline --grep='feat\|fix\|BREAKING CHANGE' -10
   ```

3. **Validation phase**:
   ```bash
   mise run release-preflight
   # Wait for all checks to pass
   ```

4. **Simulation phase**:
   ```bash
   mise run release-dry-run  
   # Verify version bumps and changes without modifications
   ```

5. **Release phase**:
   ```bash
   mise run release-version
   # This does everything: version, changelog, commit, tag, publish
   ```

6. **Verification phase**:
   ```bash
   mise run release-verify
   # Confirm packages are available on npm
   ```

### Quick Automated Release

For experienced users who want full automation:

```bash
mise run release-full
# Includes all phases with safety pauses
```

### Manual Release Commands

You can also use the underlying release-it commands directly:

```bash
# Interactive release (choose version manually)
pnpm run release

# Dry run to see what would happen
pnpm run release:dry

# Automated release using conventional commits
pnpm run release:ci
```

## Conventional Commit Format

The release process uses conventional commit messages to automatically determine version bumps:

- `fix:` → patch version (0.18.4 → 0.18.5)
- `feat:` → minor version (0.18.4 → 0.19.0)
- `feat!:` or `BREAKING CHANGE:` → major version (0.18.4 → 1.0.0)

Examples:
```bash
git commit -m "fix: resolve memory leak in event processing"
git commit -m "feat: add support for batch event processing"
git commit -m "feat!: change event schema format

BREAKING CHANGE: Event schema now requires 'version' field"
```

## Git Hook Setup

Conventional commit enforcement is automatically set up when you enter the project directory (via mise enter hook). The Git hooks will:

- Validate commit messages follow conventional format
- Run linting on staged files

To manually validate commits when needed:
```bash
# Manual validation
pnpx commitlint --edit
```

## Safety Features

- **Multi-stage validation**: Each phase validates different aspects
- **Conventional commit automation**: No manual changeset creation needed
- **Synchronized versioning**: All packages maintain same version number
- **Clear output**: Emojis and section headers for easy progress tracking
- **Rollback guidance**: Emergency procedures documented
- **Git state validation**: Ensures clean repository state
- **npm connectivity checks**: Validates registry access before publishing
- **Security auditing**: Checks for vulnerabilities before release
- **Test coverage**: Full test suite runs multiple times

## Error Handling

If any step fails:

1. **Read the error message carefully**
2. **Fix the underlying issue** (tests, linting, security, etc.)
3. **Start over from release-preflight**
4. **Do not skip validation steps**

Common issues:
- Dirty git working directory → commit or stash changes
- Failed tests → fix failing tests
- npm authentication → run `npm login`
- Security vulnerabilities → update dependencies
- Missing conventional commits → ensure proper commit message format

## Emergency Rollback

If a release needs to be rolled back:

1. **Run**: `mise run release-rollback` for guidance
2. **Manual steps required**:
   - Unpublish packages: `npm unpublish <package>@<version>`
   - Revert commits: `git revert HEAD`
   - Delete git tags: `git tag -d <tag> && git push origin :refs/tags/<tag>`
   - Notify stakeholders

## Best Practices

- **Always run preflight first** - catches issues early
- **Use dry-run to validate** - safe simulation
- **Write good conventional commits** - they determine version bumps
- **Test in development environment** - verify packages work after installation
- **Communicate releases** - notify team of new versions
- **Monitor after release** - watch for issues in production

## Troubleshooting

### "No conventional commits found"
```bash
# Ensure commits follow conventional format
git commit -m "feat: add new feature"
git commit -m "fix: resolve issue"
```

### "Working directory not clean"  
```bash
# Check what's uncommitted
git status
# Commit or stash changes
git add . && git commit -m "prepare for release"
```

### "npm authentication failed"
```bash
# Login to npm
npm login
# Verify authentication  
npm whoami
```

### "Security vulnerabilities found"
```bash
# Review and fix vulnerabilities
pnpm audit
pnpm audit --fix
```

### "release-it version conflicts"
```bash
# Check if versions are already published
npm view @weegigs/events-core versions --json
# Use --no-increment to skip version bump if needed
```

This process ensures reliable, safe releases with automated version detection from conventional commits and multiple validation checkpoints.