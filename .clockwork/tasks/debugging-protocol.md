# AI Agent Debugging Protocol

## 1. Core Principles: The Unbreakable Rules

> **These are non-negotiable. Adhere to these principles at all times.**

1.  **OBSERVE FIRST, ACT SECOND:** Never make any changes to the code until you have a verifiable hypothesis about the root cause. Your primary goal is to understand, not to guess.
2.  **THE ERROR IS A SYMPTOM, NOT THE CAUSE:** The location of a thrown error is where the system finally broke, not where the problem started. Your investigation must trace the execution path backward to find the origin of the failure.
3.  **ONE CHANGE AT A TIME:** Isolate every code modification. After each single, atomic change, you must run the full verification process. If the change does not fix the issue, revert it immediately before proceeding.
4.  **PROVE THE HYPOTHESIS:** Before applying a fix, you must prove it will work. Use the diagnostic tools to test your theory in isolation. You must be able to explain *why* your proposed change is the correct one.
5.  **A "FIX" THAT CREATES A NEW ERROR IS A FAILURE:** Swapping one error for another is not progress. It indicates a flawed hypothesis. Revert the change and restart the analysis.

## 2. Systematic Debugging Process

> **Follow this exact sequence for every debugging task.**

### Step 1: Triage and Reproduce

- [ ] **Stash Existing Changes:** If `git status` is not clean, run `git stash` to isolate the debugging session.
- [ ] **Execute the Failing Command:** Run the command that originally produced the error (e.g., `pnpm run build`, `pnpm run test`).
- [ ] **Capture the Full Error:** Copy the complete error message and stack trace.
- [ ] **Confirm Reproducibility:** Run the command again to ensure the failure is consistent.

### Step 2: Analyze the Failure Cascade

Module loading and execution errors often create a cascade effect. A single failure early in the process will cause numerous downstream errors.

1.  **Identify the Final Error:** Note the file, line number, and error type (e.g., `TypeError: Cannot read properties of undefined`).
2.  **Identify the Undefined Object:** In the example above, some object is `undefined`.
3.  **Formulate the Core Question:** Do not ask "How do I fix this line?" Ask **"Why is this object `undefined`?"**
4.  **Trace the Object's Origin:**
    *   Is it imported from another module?
    *   Is it declared in the same file?
    *   Is it a function parameter?
5.  **Investigate the Source:** The most common cause is a module import failure. The module providing the object may have failed to evaluate. Your investigation must now focus on that source module.

### Step 3: Investigate the Source Module

- [ ] **Test Module Loadability:** Use a one-liner to check if the module can be loaded at all.
    ```bash
    # Can the module be required by Node.js?
    node -e "require('@scope/package-name')" && echo "✓ Loads" || echo "✗ Fails"
    node -e "require('./path/to/local/file.js')" && echo "✓ Loads" || echo "✗ Fails"
    ```
- [ ] **Inspect Module Exports:** If it loads, check what it *actually* exports. Compare this with what your code *expects* to import.
    ```bash
    # What keys are on the exported object?
    node -p "Object.keys(require('@scope/package-name'))"
    ```
- [ ] **Check for Import/Export Mismatches:** Verify that the import style (default, named, namespace) matches the export style of the source module.
    ```typescript
    // These are NOT the same. You must use the correct one.
    import thing from 'module';         // Default
    import { thing } from 'module';     // Named
    import * as thing from 'module';    // Namespace
    ```
- [ ] **Read the Source Module:** Look for syntax errors, side effects during initialization, or other issues that could prevent it from exporting correctly.

### Step 4: Formulate and Test a Hypothesis

- [ ] **Write Down the Hypothesis:** State clearly what you believe the root cause is (e.g., "The `core` module fails to load because the `http-errors` import is using a named import instead of a default import.").
- [ ] **Prove It:** Use the diagnostic tools to prove this without changing code. For the example above, you could test the import directly.
    ```bash
    # Test the problematic import in isolation
    node -e "const e = require('http-errors'); console.log(typeof e)"
    ```
- [ ] **If the Hypothesis is Wrong, Go Back:** If your test fails to prove the hypothesis, do not proceed. Return to Step 2.

### Step 5: Apply and Verify the Fix

- [ ] **Make One, Minimal Change:** Apply the single, targeted change to fix the proven root cause.
- [ ] **Run Full Verification Suite:** A fix is not complete until it passes all checks.
    ```bash
    pnpm run clean && pnpm install --frozen-lockfile && pnpm run build && pnpm run lint && pnpm run test
    ```
- [ ] **Confirm Success:** If all checks pass and the original error is gone, the task is complete.
- [ ] **If It Fails, Revert Immediately:**
    ```bash
    git checkout -- .
    ```
    Then, return to Step 2 with the new information.

## 3. Special Case: Post-Rebase/Merge Failures

> If a build was working before a `git rebase` or `git merge`, the environment is likely stale.

- [ ] **Perform a Full Clean:** Caches and old artifacts are the most common culprits.
    ```bash
    pnpm run clean
    rm -rf node_modules
    pnpm install --frozen-lockfile
    ```
- [ ] **Rebuild Everything:**
    ```bash
    pnpm run build
    ```
- [ ] **Check for Renamed Files:** Look for file renames in the git history that might break imports.
    ```bash
    git diff --name-status HEAD@{1}
    ```