# @weegigs/dynamo-event-store

## 0.18.4

### Patch Changes

- d7027da: Release v0.18.4: Complete dependency modernization and code quality improvements

  This release completes a comprehensive dependency modernization effort across all packages:

  **Dependency Updates:**

  - Updated testcontainers from v9 to v11 with breaking API changes
  - Updated ulid from v2 to v3
  - Updated @middy packages from v4 to v6
  - Updated commander from v10 to v14
  - Updated all AWS SDK packages to v3.821.0
  - Updated Effect ecosystem packages to latest versions

  **Infrastructure Improvements:**

  - Implemented centralized dependency management via pnpm catalog system
  - Removed deprecated packages: @aws-sdk/smithy-client, @aws-sdk/service-error-classification, @effect/schema
  - Added mise task for clean rebuilds
  - Resolved all ESLint warnings about `any` types

  **Code Quality:**

  - Replaced deprecated AWS SDK error classification with local functions
  - Improved TypeScript typing throughout dynamo-event-store package
  - Added proper error type interfaces and type guards
  - Fixed exactOptionalPropertyTypes compatibility issues

  **Testing:**

  - All 75+ tests continue to pass
  - Updated test code to work with new API versions
  - Maintained backward compatibility where possible

  This release represents a significant modernization effort while maintaining full functionality and test coverage.

- Updated dependencies [d7027da]
  - @weegigs/events-common@0.18.4
  - @weegigs/events-core@0.18.4
  - @weegigs/events-cypher@0.18.4
