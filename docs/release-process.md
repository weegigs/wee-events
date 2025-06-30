# Release Process

This document describes the release process for the wee-events monorepo using release-it with conventional commits and mise automation.

## Quick Start

**Default release process:**
```bash
just release
# or: mise run release
```

This interactive command handles the complete release workflow with validation, confirmation prompts, and verification.

## Overview

The release process automatically determines version bumps from conventional commit messages and includes comprehensive validation to ensure reliable, safe releases. 

### Key Features
- 🤖 **Automatic version detection** from conventional commits
- 🔒 **Security validation** (fails only on high/critical vulnerabilities)  
- ✅ **Comprehensive testing** and validation before release
- 👤 **Interactive confirmation** of version and changes
- 📦 **Synchronized versioning** across all packages
- 🔍 **Post-release verification** of published packages

## Release Commands

### `mise run release` ⭐ **Recommended**
**Purpose**: Interactive release process with validation and verification

**What it does**:
- ✅ Runs preflight validation (git state, security, build, tests)
- 🧪 Shows dry run simulation with proposed version bumps
- 👤 **Prompts you to review and confirm** changes before proceeding
- 📦 Executes release (version bump, changelog, commit, tag, publish)
- ✅ Verifies packages are available on npm registry

**When to use**: Default choice for local releases

**Safe to run**: ⚠️ **NO** - makes real changes after confirmation

---

### `mise run release-ci`
**Purpose**: Automated release process (non-interactive)

**What it does**:
- Same as `mise run release` but **no interactive prompts**
- Automatically proceeds based on conventional commit analysis
- Uses `release-it --ci` for full automation

**When to use**: CI/CD pipelines or when you're confident about the release

**Safe to run**: ⚠️ **NO** - fully automated release

---

### `just preview`
**Purpose**: Preview what would be released without making any changes

**What it does**:
- 📦 Shows current version and packages
- 📋 Lists commits since last release
- 🏷️ Highlights conventional commits that will trigger version bumps
- 📋 Shows which packages would be published

**When to use**: To preview what a release would do

**Safe to run**: ✅ **YES** - preview only, no changes

---

### `mise run release-verify`
**Purpose**: Verify published packages after release

**What it does**:
- 🔍 Checks that packages are available on npm registry
- 📊 Shows release summary and git tags
- ✅ Confirms successful publication

**When to use**: After a release to confirm everything worked

**Safe to run**: ✅ **YES** - verification only

---

### `mise run release-rollback`
**Purpose**: Emergency rollback guidance

**What it does**:
- 🚨 Provides rollback instructions and commands
- 📝 Shows manual steps required for rollback
- ❌ **Manual intervention required**

**When to use**: Only in emergency situations

**Safe to run**: ✅ **YES** - guidance only

## Recommended Workflow

### Standard Release Process

1. **Preparation**:
   ```bash
   # Ensure you're on main branch with clean working directory
   git checkout main
   git pull origin main
   git status  # Should be clean
   ```

2. **Ensure conventional commits**:
   ```bash
   # Your recent commits should follow conventional format:
   # feat: add new feature        → minor version bump
   # fix: resolve bug            → patch version bump  
   # feat!: breaking change      → major version bump
   
   # Check recent commits
   git log --oneline --grep='feat\|fix\|BREAKING CHANGE' -10
   ```

3. **Run the release**:
   ```bash
   just release
   # This will:
   # 1. Validate everything is ready
   # 2. Show you what version will be released
   # 3. Ask for your confirmation
   # 4. Execute the release
   # 5. Verify publication
   ```

### Alternative Workflows

**Just preview the release**:
```bash
just preview
# See what would happen without making changes
```

**Automated release** (for CI or confident releases):
```bash
just release-ci
# No prompts, fully automated
```



## Conventional Commit Format

The release process uses conventional commit messages to automatically determine version bumps:

| Commit Type | Version Bump | Example |
|-------------|--------------|---------|
| `fix:` | Patch (0.18.4 → 0.18.5) | `fix: resolve memory leak in event processing` |
| `feat:` | Minor (0.18.4 → 0.19.0) | `feat: add support for batch event processing` |
| `feat!:` or `BREAKING CHANGE:` | Major (0.18.4 → 1.0.0) | `feat!: change event schema format` |

**Examples**:
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

To manually validate commits:
```bash
pnpx commitlint --edit
```

## Safety Features

- **Multi-stage validation**: Git state, security, build, tests, and linting
- **Interactive confirmation**: Review version bumps before proceeding
- **Conventional commit automation**: No manual changeset creation needed
- **Synchronized versioning**: All packages maintain same version number
- **Security auditing**: Only fails on high/critical vulnerabilities (allows moderate)
- **Post-release verification**: Confirms packages are available on npm
- **Rollback guidance**: Emergency procedures documented

## Error Handling

If any step fails:

1. **Read the error message carefully**
2. **Fix the underlying issue** (tests, linting, security, etc.)
3. **Re-run the release process**
4. **Do not skip validation steps**

**Common issues**:

| Problem | Solution |
|---------|----------|
| Dirty git working directory | `git add . && git commit` or `git stash` |
| Failed tests | Fix failing tests and re-run |
| npm authentication | `npm login` then `npm whoami` to verify |
| High/critical security vulnerabilities | `pnpm audit --fix` or update dependencies |
| Missing conventional commits | Ensure recent commits follow conventional format |

## Emergency Rollback

If a release needs to be rolled back:

1. **Run**: `mise run release-rollback` for detailed guidance
2. **Manual steps required**:
   ```bash
   # Unpublish packages (within 72 hours of publish)
   npm unpublish <package>@<version>
   
   # Revert commits
   git revert HEAD
   
   # Delete git tags
   git tag -d <tag>
   git push origin :refs/tags/<tag>
   
   # Notify stakeholders
   ```

## Best Practices

- ✅ **Use the default `mise run release`** for interactive releases
- ✅ **Write good conventional commits** - they determine version bumps
- ✅ **Test packages after installation** - verify they work in development
- ✅ **Communicate releases** - notify team of new versions
- ✅ **Monitor after release** - watch for issues in production
- ❌ **Don't skip the validation** - let the process catch issues early

## Troubleshooting

### "No conventional commits found"
```bash
# Ensure recent commits follow conventional format
git commit -m "feat: add new feature"
git commit -m "fix: resolve issue"
```

### "Working directory not clean"
```bash
git status                    # Check what's uncommitted
git add . && git commit -m "prepare for release"
```

### "npm authentication failed"
```bash
npm login                     # Login to npm
npm whoami                    # Verify authentication
```

### "Security vulnerabilities found"
```bash
pnpm audit                    # Review vulnerabilities
pnpm audit --fix              # Fix auto-fixable issues
```

### "release-it version conflicts"
```bash
# Check if version is already published
npm view @weegigs/events-core versions --json
```

## Summary

The release process is designed to be simple and safe:

1. **Most of the time**: Just run `just release`
2. **To preview**: Use `just preview`  
3. **For automation**: Use `just release-ci`

The process handles version detection, validation, publishing, and verification automatically while giving you control over when changes are actually made.