# wee-events monorepo tasks

# Default recipe - show available commands
default:
    @echo "📋 Available commands:"
    @just --list
    @echo ""
    @echo "🎯 Quick start:"
    @echo "  just build          # Build if needed"
    @echo "  just test           # Run tests" 
    @echo "  just release        # Release interactively"
    @echo "  just release-dry    # Preview release"
    @echo ""
    @echo "📝 You can also use: mise run release"

# Clean all build artifacts
clean:
    pnpm run clean

# Install dependencies with frozen lockfile
install:
    pnpm install --frozen-lockfile

# Build all packages (Turbo handles caching automatically)
build: install
    pnpm run build

# Run tests (builds first if needed)
test: build
    pnpm run test

# Run linting (builds first if needed)  
lint: build
    pnpm run lint

# Validate everything is ready for release
validate: build test lint
    #!/bin/bash
    set -e
    echo "🔍 Validating release readiness..."
    
    # Git state validation
    if ! git diff --quiet; then
        echo "❌ Working directory not clean"
        exit 1
    fi
    
    if ! git symbolic-ref HEAD | grep -q refs/heads/main; then
        echo "❌ Not on main branch"  
        exit 1
    fi
    
    git fetch origin
    if ! git diff --quiet HEAD origin/main; then
        echo "❌ Local main differs from origin/main"
        exit 1
    fi
    
    # Security audit (only fail on high/critical)
    if ! pnpm audit --audit-level=high; then
        echo "❌ High/critical security vulnerabilities found"
        exit 1
    fi
    
    echo "✅ All validations passed"

# Dry run release (shows what would happen)
release-dry: validate
    pnpm run release:dry

# Interactive release process
release: validate
    #!/bin/bash
    set -e
    echo "🚀 Starting interactive release..."
    echo "📋 Recent conventional commits:"
    git log --oneline --grep='feat\|fix\|BREAKING CHANGE' -10 || echo 'No conventional commits found'
    echo ""
    echo "🔄 Executing release (you'll be prompted to confirm)..."
    pnpm run release
    echo "✅ Running post-release verification..."
    just verify

# Automated release (non-interactive)
release-ci: validate
    #!/bin/bash
    set -e
    echo "🤖 Running automated release..."
    pnpm run release:ci
    just verify

# Verify published packages
verify:
    #!/bin/bash
    set -e
    echo "✅ Verifying published packages..."
    echo "⏱️ Waiting 10 seconds for npm registry propagation..."
    sleep 10
    
    echo "📦 Checking package availability:"
    find packages -name package.json -exec jq -r .name {} \; | while read pkg; do
        echo "Checking $pkg..."
        if npm view "$pkg" version --silent >/dev/null 2>&1; then
            echo "✅ $pkg found on registry"
        else
            echo "❌ $pkg not found on registry"
        fi
    done
    
    echo "📊 Release summary:"
    echo "Latest commit: $(git log --oneline -1)"
    echo "Recent tags: $(git tag --sort=-version:refname | head -3 | tr '\n' ' ')"

# Emergency rollback guidance
rollback:
    #!/bin/bash
    echo "🚨 EMERGENCY ROLLBACK GUIDANCE"
    echo "⚠️ Manual steps required:"
    echo ""
    echo "1. Unpublish packages (within 72 hours):"
    echo "   npm unpublish <package>@<version>"
    echo ""
    echo "2. Revert git commits:"
    echo "   git revert HEAD"
    echo ""  
    echo "3. Delete git tags:"
    echo "   git tag -d <tag>"
    echo "   git push origin :refs/tags/<tag>"
    echo ""
    echo "4. Notify stakeholders"
    echo ""
    echo "Last commit: $(git log --oneline -1)"

# Clean rebuild everything from scratch
rebuild: clean install
    pnpm run build

# Show project status
status:
    #!/bin/bash
    echo "📊 Project Status"
    echo "=================="
    echo ""
    echo "🔧 Tools:"
    mise current
    echo ""
    echo "📦 Dependencies:"
    echo "Node: $(node --version)"
    echo "pnpm: $(pnpm --version)"
    echo ""
    echo "🏗️ Build status:"
    echo "Managed by Turbo with intelligent caching"
    echo ""
    echo "📋 Git status:"
    git status --short --branch
    echo ""
    echo "📊 Recent commits:"
    git log --oneline --grep='feat\|fix\|BREAKING CHANGE' -5 || echo 'No conventional commits found'