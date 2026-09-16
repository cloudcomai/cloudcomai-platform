# AI Feature-to-PR Workflow

Use these instructions when implementing a feature, bug fix, or repository-controlled configuration change with an AI coding assistant.

## Workflow

1. Inspect the repository, latest base branch, architecture, coding patterns, tests, CI/CD, and existing implementation.
2. **Before creating a branch, check all open PRs.**
3. If a relevant or overlapping open PR exists:
   - Inspect its branch and changes.
   - Reuse the existing PR branch.
   - Sync it with the latest base branch when required.
   - Implement and commit new changes to the **same PR branch**.
   - Do not create a duplicate PR.
4. If no relevant PR exists, create a new feature/fix branch from the latest base branch.
5. **Never commit directly to `main`, `master`, or the base/default branch.**
6. Implement the requested feature completely without unnecessary unrelated changes.
7. Add or update relevant tests.
8. Run available tests, build, lint, and validation. Fix repository-controlled code/configuration failures introduced or exposed by the work.
9. Review the final diff for unrelated changes, secrets, debug code, generated files, and security issues.
10. Commit and push only to the feature/PR branch.
11. Create a new PR only when no suitable open PR exists.
12. Do not merge unless explicitly requested by the user/reviewer.

## CI — Validate monorepo

After pushing changes, verify the GitHub Actions workflow/check named **`Validate monorepo`** for the latest PR/branch commit.

- If successful, report `PASS`.
- If it fails, inspect the actual failed job/step and logs.
- Determine whether the failure is caused by code, tests, dependencies, lockfiles, build configuration, workflow configuration, or other repository-controlled configuration.
- Fix repository-controlled code/configuration errors safely.
- Add/update tests when required.
- Commit fixes to the **same PR branch**, push, and verify the new run.
- Repeat **inspect → fix → push → validate** until it passes or the remaining failure requires external credentials, permissions, infrastructure, or manual action.
- Never disable, skip, weaken, or remove tests/validation merely to make CI pass.
- Never claim CI passed unless the latest relevant run actually completed successfully.
- For external failures, report the exact blocker and required action.

Final validation should report:

- `Validate monorepo: PASS/FAIL`
- `Tests: PASS/FAIL`
- `Build: PASS/FAIL`
- `Lint: PASS/FAIL` when configured

## Database Changes

If database/schema changes are required:

- Add the incremental migration/ALTER SQL required for **existing installations**.
- **Also update the consolidated fresh-install SQL/schema** with the same final structure.
- A fresh installation must receive the latest schema directly and must **not** need to execute every historical migration/ALTER SQL file.
- Preserve historical migrations needed to upgrade existing installations.
- Verify that a fresh installation and an upgraded existing installation result in the same current schema, including tables, columns, indexes, constraints, defaults, and required bootstrap/seed data.

## Limits / Continuation

If an AI, GitHub, connector, API, or tool limit interrupts the task:

- Preserve the current branch, open PR, commits, completed work, CI status, and test status.
- Respect any retry/reset time supplied by the service.
- Resume from the last incomplete step.
- Re-check the existing PR and latest `Validate monorepo` run before continuing.
- Continue committing fixes to the same PR branch.
- Do not restart completed work or create duplicate branches, commits, PRs, or migrations.
- If automatic resumption is unavailable, report the checkpoint and exact next action.

## Developer Invocation

A developer should tell the AI assistant to read this file before starting work. The minimum prompt is:

```text
Read and follow .github/ai/feature-to-pr.md.

Feature:
<feature or bug description>

Requirements:
<optional requirements>

Base:
main
```

For follow-up work on an existing implementation or PR:

```text
Read and follow .github/ai/feature-to-pr.md.

Continue/fix this feature:
<feature or issue>

Before creating anything new, inspect all open PRs and reuse the relevant existing PR branch.
Verify Validate monorepo and fix repository-controlled code/config errors until it passes or an external blocker remains.

Base:
main
```
