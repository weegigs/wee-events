# Release Process

This document describes the comprehensive release process for the wee-events monorepo using Changesets and mise automation.

## Overview

The release process is designed with multiple safety checkpoints and validation steps to ensure reliable, safe releases. It consists of 6 main phases:

1. **Preflight** - Comprehensive validation before any changes
2. **Dry Run** - Full simulation without modifications  
3. **Version** - Update package versions and generate changelogs
4. **Publish** - Publish packages to npm registry
5. **Verify** - Post-release validation
6. **Rollback** - Emergency rollback procedures

## Release Tasks

### `mise run release-preflight`
**Purpose**: Comprehensive pre-release validation and safety checks

**What it does**:
- ✅ Validates git repository state (clean, on main, up-to-date)
- 🔒 Runs security audit for high/critical vulnerabilities  
- 📦 Ensures changesets are present for release
- 🏗️ Validates build system with frozen lockfile
- 🧪 Runs full test suite, build, and linting
- 📊 Shows changeset status

**When to use**: Always run this first before any release

**Safe to run**: ✅ Yes - no modifications made

---

### `mise run release-dry-run`
**Purpose**: Full release simulation without any changes

**What it does**:
- 📋 Shows what packages would be updated
- 🏗️ Tests clean build from scratch
- 🧪 Runs full test suite
- 🔍 Validates code quality  
- 📦 Simulates package publication (--dry-run)

**When to use**: After preflight passes, to validate the release

**Safe to run**: ✅ Yes - simulation only

---

### `mise run release-version`
**Purpose**: Update package versions and generate changelogs

**What it does**:
- ⚠️ **MODIFIES FILES**: Updates package.json versions
- 📝 Generates/updates CHANGELOG.md files
- 📊 Shows all changes made
- 📋 Displays version changes clearly

**When to use**: After dry-run succeeds and you're ready to version

**Safe to run**: ⚠️ **NO** - modifies package.json and CHANGELOG files

**Next step**: Review changes, commit them, then run release-publish

---

### `mise run release-publish`
**Purpose**: Publish packages to npm registry with full validation

**What it does**:
- 🔍 Validates git state and npm connectivity
- 🔑 Checks npm authentication
- 🧪 Final build and test validation
- 📦 **PUBLISHES** packages to npm registry
- 🏷️ Commits changes and pushes to git

**When to use**: After version step and reviewing changes

**Safe to run**: ⚠️ **NO** - publishes to npm and pushes to git

**Prerequisites**: Must run `git add . && git commit -m "Version packages"` first

---

### `mise run release-verify`
**Purpose**: Post-release verification and validation

**What it does**:
- 🔍 Verifies packages are available on npm registry
- 📊 Shows release summary and git tags
- ✅ Confirms successful publication

**When to use**: After publish completes

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
- ⏸️ Pauses before publish for manual confirmation
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

2. **Create changeset** (if not already done):
   ```bash
   pnpm changeset
   # Follow prompts to describe changes
   ```

3. **Validation phase**:
   ```bash
   mise run release-preflight
   # Wait for all checks to pass
   ```

4. **Simulation phase**:
   ```bash
   mise run release-dry-run  
   # Verify everything works without changes
   ```

5. **Version phase**:
   ```bash
   mise run release-version
   # This modifies files - review carefully!
   ```

6. **Review and commit**:
   ```bash
   # Review all changes
   git diff
   find packages -name CHANGELOG.md -exec echo "=== {} ===" \; -exec head -20 {} \;
   
   # Commit version changes
   git add .
   git commit -m "chore: version packages for v0.19.0"
   ```

7. **Publication phase**:
   ```bash
   mise run release-publish
   # This publishes to npm and pushes to git
   ```

8. **Verification phase**:
   ```bash
   mise run release-verify
   # Confirm packages are available
   ```

### Quick Automated Release

For experienced users who want automation:

```bash
mise run release-full
# Includes all phases with safety pauses
```

## Safety Features

- **Multi-stage validation**: Each phase validates different aspects
- **No automatic file modification**: Explicit steps for destructive operations  
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
- **Review version changes carefully** - check CHANGELOGs and version numbers
- **Test in development environment** - verify packages work after installation
- **Communicate releases** - notify team of new versions
- **Monitor after release** - watch for issues in production

## Troubleshooting

### "No changesets present"
```bash
# Create a changeset
pnpm changeset
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

This process ensures reliable, safe releases with multiple validation checkpoints and clear rollback procedures.