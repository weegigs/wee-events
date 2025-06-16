# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tool Management

This project uses **mise** for tool version management. The `.mise.toml` file defines:
- **Node.js**: v22.15.1 (automatically activated when entering project directory)
- **pnpm**: Latest version for package management

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

This is a **pnpm workspace monorepo** using **Turbo** for task caching and build orchestration.

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
- **Turbo** for monorepo task orchestration and caching
- **pnpm workspaces** for dependency management
- **Jest** for testing with ts-jest preset
- **ESLint** with TypeScript and Prettier configurations
- **DynamoDB** for event storage
- **AWS services** integration through Effects package

### Build Dependencies
- Packages have `^build` dependencies ensuring proper build order
- Tests depend on `^compile` to ensure compilation before testing
- Turbo caches `compile`, `test`, and `lint` operations

## Testing
- Tests use `.spec.ts` or `.test.ts` extensions
- Jest configuration excludes `lib/`, `node_modules/`, and `tools/` from coverage
- Some packages generate coverage reports in HTML format

### Test Failure Analysis Protocol:
- NEVER update snapshots without understanding WHY they changed
- ALWAYS investigate the root cause when tests that should pass are failing
- ALWAYS investigate the root cause when tests that should fail are passing
- When validation tests show "expected X to fail" errors, this means validation logic is broken, not that snapshots need updating
- Snapshot changes often indicate regressions or broken functionality, not valid updates
- Ask yourself: "Should this test outcome be different?" before accepting any test changes

### Quality Verification Standards:
- Read and understand test assertions before declaring success
- Verify that test failures make logical sense in context
- Question any test that passes when it logically should fail
- Don't declare builds "successful" based solely on exit codes - analyze the actual test results
- When tests expect errors but get different errors, investigate the logic, don't update expectations

### Build Success Criteria:
- All tests passing AND behaving as logically expected
- No test failures masked by snapshot updates
- No broken validation logic accepted as "working"
- Performance improvements that don't break functionality

## Task Completion Standards

### NEVER Declare Completion When:
- **Compilation Errors Exist**: Any TypeScript errors must be resolved before claiming success
- **Tests Are Failing**: All tests must pass before declaring a task complete
- **Linting Errors Present**: ESLint errors must be fixed before completion
- **Build Processes Fail**: `pnpm build`, `pnpm test`, `pnpm lint` must all succeed

### Verification Process:
1. **Always run compilation**: Use `pnpm build` or `tsc --noEmit` to verify no TypeScript errors
2. **Always run tests**: Use `pnpm test` to ensure all tests pass
3. **Always run linting**: Use `pnpm lint` to verify code quality standards
4. **Analyze error output**: Don't just check exit codes - read and understand error messages
5. **Fix root causes**: Think deeply and address underlying issues, don't mask symptoms

### Before Claiming Success:
- [ ] No TypeScript compilation errors
- [ ] All tests passing with logical results
- [ ] No ESLint warnings or errors
- [ ] Build process completes successfully
- [ ] Code changes implement the intended functionality

### Red Flags That Indicate Incomplete Work:
- "Command failed with exit code 2" or similar compilation failures
- Test failures or "FAIL" messages in test output
- ESLint errors or warnings
- Missing imports or exports
- Type errors or `any` type usage
- Incomplete function implementations

**Remember**: A task is only complete when the code compiles, tests pass, and meets quality standards.

## Project Conventions
- We use pnpm and never npm
- Remember to use the native pnpm commands when updating and manipulating packages rather than editing the package file directly
- We control ALL dependency versions via the pnpm catalogue
- Always use the versions for the pnpm catalogue