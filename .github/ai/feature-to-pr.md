# AI Feature-to-PR Workflow

Use these instructions when implementing a feature, bug fix, or repository-controlled configuration change with an AI coding assistant.

## End-to-End Execution

This is an **end-to-end execution request**, not a planning-only or progress-report request.

Once execution starts, continue through every applicable step in the current execution: repository inspection → open-PR verification → branch selection/creation → implementation → tests → build/lint → commit → push → PR creation/update → base synchronization/conflict resolution → CI verification → repository-controlled fixes → final verification.

- Do **not** voluntarily stop after creating a branch, editing files, adding tests, committing, pushing, creating/updating a PR, or encountering a normal repository-controlled failure.
- Do **not** ask the user to say `continue` between normal executable workflow steps.
- Do **not** return `Status: IN PROGRESS` merely because executable steps remain.
- Do not ask for repeated approval for routine implementation, testing, committing, pushing, PR updates, conflict resolution, or CI fixes already authorized by the task.
- Continue until the Completion Criteria are satisfied or a genuine external blocker prevents further execution.

## Workflow

1. Inspect the repository, latest base branch, architecture, coding patterns, tests, CI/CD, and existing implementation.
2. **Before creating a branch, check all currently OPEN PRs and inspect relevant changed files for overlap.**
3. If a relevant OPEN PR exists for the same feature or closely related feature group:
   - Inspect its branch and changes.
   - Confirm the PR is still OPEN and its head branch is the intended branch.
   - Reuse that PR branch.
   - Sync it with the latest base branch when required.
   - Implement and commit follow-up changes to the **same OPEN PR branch**.
   - Do not create a duplicate PR.
4. If no relevant OPEN PR exists, create a new feature/fix branch from the latest base branch.
5. **Never commit directly to `main`, `master`, or the base/default branch.**
6. Use one PR per independent feature or closely related feature group. Keep unrelated features in separate branches/PRs.
7. Implement the requested feature completely without unnecessary unrelated changes.
8. **Web + Mobile feature parity is the default.** Unless the request explicitly limits the work to one platform, implement every user-facing feature/fix in both the Web app and Mobile app (Android/iOS shared mobile code where applicable).
   - Inspect the existing Web and Mobile implementations before coding.
   - Keep behavior, validation, permissions, API contracts, error handling, and user-visible states consistent across Web and Mobile.
   - Do not mark the feature complete because only Web or only Mobile works.
   - If a platform genuinely cannot support the feature, document the technical reason and treat the missing parity as a blocker unless the user explicitly accepts the limitation.
   - Add/update Web and Mobile tests for the feature when applicable.
9. Add or update relevant tests.
10. Run available tests, build, lint, and validation. Fix repository-controlled failures introduced or exposed by the work.
11. Review the final diff for unrelated changes, secrets, debug code, generated files, and security issues.
12. Re-check PR state before every commit/push intended for an existing PR.
13. Commit and push only to the correct active feature/PR branch.
14. Create a new PR only when no suitable OPEN PR exists.
15. Do not merge unless explicitly requested by the user/reviewer.

## PR State Safety

Before **every commit or push** intended for an existing PR:

1. Fetch the PR's current state.
2. Confirm `state = OPEN`.
3. Confirm the PR head branch matches the branch being modified.
4. Confirm the branch still belongs to the intended feature.

If the PR is `MERGED` or `CLOSED`:

- **Stop using that PR/branch for follow-up work.**
- Do not push changes expecting them to update the merged/closed PR.
- Do not report that the existing PR was updated.
- Fetch the latest base branch.
- Re-check all currently OPEN PRs for the same/overlapping feature.
- Reuse another suitable OPEN PR only when it genuinely covers the same or closely related feature.
- Otherwise create a new branch from the latest base and create a new PR.

Immediately before reporting completion, re-fetch the PR and confirm it is still OPEN, points to the expected head branch, and contains the latest implementation commit.

## Parallel Development / Conflict Prevention

When multiple developers or AI assistants work in parallel:

- One developer/AI should own a feature PR branch at a time unless shared ownership is explicitly coordinated.
- Before starting work, inspect all OPEN PRs and their changed files to identify overlapping files/features.
- Keep unrelated features in separate PRs.
- Avoid unnecessary edits to shared/high-conflict files such as lockfiles, common navigation/layout components, consolidated SQL schemas, shared configuration, and GitHub workflows.
- If multiple features require the same shared file, make the smallest compatible change and preserve all intended behavior rather than independently rewriting the file.
- Keep feature branches short-lived and commits focused.
- Regularly synchronize the latest base branch into active feature branches when development is long-running or overlapping work is being merged.
- After another overlapping PR is merged, sync the newly updated base before continuing/finalizing the active PR.
- Before final validation, sync the latest base again when the branch is behind or overlapping changes have landed.
- Resolve conflicts **on the feature branch, never directly on `main`**.
- Never resolve conflicts by blindly choosing `ours`, `theirs`, `accept current`, or `accept incoming`.
- Inspect both sides and preserve both newer base-branch behavior and the current feature's required behavior.
- After conflict resolution, review the resulting diff and rerun relevant tests/build/lint plus `Validate monorepo`.
- Commit/push conflict resolutions to the same OPEN feature PR branch.

When several PRs were based on the same earlier `main`, merge them sequentially. After each merge, the next overlapping PR should synchronize the newly updated `main`, resolve conflicts, and revalidate before it is considered ready.

## CI — Validate monorepo

After pushing changes, verify the GitHub Actions workflow/check named **`Validate monorepo`** for the **latest relevant PR commit**.

- A successful run for an older commit does **not** satisfy completion.
- If new commits are pushed after a successful run, verify the new latest run.
- If successful, report `PASS`.
- If it fails, inspect the actual failed job/step and logs.
- Determine whether the failure is caused by code, tests, dependencies, lockfiles, build configuration, workflow configuration, or other repository-controlled configuration.
- Repository-controlled failures are **not blockers**. Fix them safely on the active feature PR branch.
- Add/update tests when required.
- Commit fixes to the **same OPEN PR branch**, push, and verify the new run.
- Repeat **inspect → fix → push → validate** until it passes or a genuine external blocker remains.
- Never disable, skip, weaken, or remove tests/validation merely to make CI pass.
- Never claim CI passed unless the latest relevant run actually completed successfully.

Normal repository-controlled problems that must be investigated/fixed rather than treated as blockers include compilation errors, test failures, lint failures, dependency/lockfile problems, merge conflicts, workflow YAML errors, application/repository configuration errors, and `Validate monorepo` failures.


## Media / File Upload Safety

Treat image, video, audio, document, camera, gallery, attachment, avatar, and other file-upload changes as cross-layer compatibility work. Do not patch only the visible failing line and assume upload behavior is fixed.

Before modifying media/file upload code:

1. Trace the complete path end-to-end: picker/camera result -> asset normalization -> URI scheme -> local file access -> multipart construction -> transport (fetch/XHR) -> API route -> backend multipart parser -> storage -> response -> preview/download.
2. Inspect the exact installed Expo/React Native versions and APIs supported by those versions. Do not assume examples from another Expo SDK or React Native version are compatible.
3. Inspect existing upload helpers before adding another multipart implementation. Prefer one tested upload abstraction instead of separate ad-hoc image/video/document implementations.
4. Identify URI variants produced by each supported source/platform, including Android content://, file://, camera output, gallery output, document-provider URIs, and iOS equivalents where applicable.
5. Never assume picker metadata such as fileSize, MIME type, or filename is always present. Missing optional metadata must not cause a valid selected asset to be rejected; validate size when it can actually be determined.

### Expo / React Native multipart rules

- Do not mix incompatible multipart representations in the same transport path.
- Expo fetch/FormData and React Native XHR/FormData may accept different file-part representations. Verify the chosen representation against the repository's installed Expo SDK before changing it.
- Do not blindly use React Native legacy { uri, name, type } objects with Expo fetch when the installed Expo implementation expects an Expo File/Blob part; this can cause Unsupported FormDataPart implementation.
- Do not construct an expo-file-system File using an argument form that is not supported by the installed SDK. Verify constructor/factory semantics for the installed version and URI type. Incorrect native object construction can cause FileSystemFile.text argument-cast failures or Cannot use shared object that was already released.
- Do not reuse/release native shared file objects across asynchronous operations unless the installed API explicitly supports it.
- Do not manually set the multipart Content-Type boundary when FormData/fetch/XHR is responsible for generating it.
- Preserve authentication headers, API route, field names, original filename, MIME type, size limits, progress callbacks, timeout behavior, and backend contract while changing transport internals.

### Required media regression coverage

For any media/file-upload change, inspect and test every applicable path rather than only the path mentioned in the bug report: gallery image, camera image, gallery video, recorded video, voice/audio, documents/attachments, profile/avatar media, Android picker/provider URIs, iOS shared code, missing metadata, maximum-size rejection, progress and non-progress paths, server errors, and resulting preview/download.

If automated tests cannot exercise native picker/file-system behavior, add unit coverage for normalization/multipart decisions where possible and explicitly inspect the native integration path. Do not claim the upload issue is verified solely because JavaScript unit tests pass.

### Media change completion gate

Before reporting a media/upload fix complete, confirm:

1. The implementation matches the repository's installed Expo/React Native versions.
2. No known incompatible multipart part shapes are mixed.
3. Android content:// and supported local URI handling are accounted for.
4. Missing optional picker metadata does not reject otherwise valid files.
5. Image and video paths are both reviewed when they share upload infrastructure.
6. Other consumers of the changed shared helper (audio/documents/profile media) were regression-reviewed.
7. Relevant automated tests/build/Validate monorepo pass.
8. If native-device behavior cannot be executed in the current environment, report that device verification is still required instead of claiming the runtime error is proven fixed.

## Database Changes

If database/schema changes are required:

- Add the incremental migration/ALTER SQL required for **existing installations**.
- Each independent feature should use its own appropriately ordered/uniquely named migration; do not rewrite another active feature's migration.
- **Also update the consolidated fresh-install SQL/schema** with the same final structure.
- A fresh installation must receive the latest schema directly and must **not** need to execute every historical migration/ALTER SQL file.
- Preserve historical migrations needed to upgrade existing installations.
- If parallel PRs modify the consolidated fresh-install schema, sync latest base and intentionally combine the final schema instead of choosing one side of a conflict.
- Verify that a fresh installation and an upgraded existing installation result in the same current schema, including tables, columns, indexes, constraints, defaults, and required bootstrap/seed data.

## Completion Criteria

Report `Status: COMPLETE` only when all applicable conditions are true:

1. Requested implementation is complete.
2. For user-facing features/fixes, Web and Mobile implementations are both complete unless the task explicitly scopes the change to one platform.
3. Relevant Web and Mobile tests are added/updated and pass when applicable.
4. Build passes when applicable.
5. Lint passes when configured.
6. Changes are committed and pushed.
7. The correct PR exists and is currently OPEN.
8. The PR contains the latest implementation commit.
9. Latest base has been synchronized when required.
10. Merge conflicts are resolved.
11. `Validate monorepo` for the latest relevant commit completed successfully.
12. Final PR/branch/commit/CI state was re-verified immediately before reporting completion.

Do not use `Status: COMPLETE` if any applicable criterion above remains unfinished.

## Genuine Blockers

Stop before completion only when further progress genuinely requires something unavailable to the current execution, for example:

- missing credentials/secrets;
- GitHub/repository permission failure;
- required external infrastructure/service unavailable;
- GitHub/API/tool outage or hard usage limit;
- required manual action outside available repository/tool access;
- an essential requirement that cannot safely be determined from the task/repository.

If genuinely blocked, report `Status: BLOCKED` with the exact blocker, current branch, current OPEN PR if any, latest commit, completed work, failed check/error, and exact next action required.

## Limits / Continuation

Do not voluntarily stop merely because the task has multiple steps.

If an actual AI, GitHub, connector, API, tool, or session limit interrupts execution:

- Preserve the current branch, OPEN PR, commits, completed work, CI status, test status, and exact unfinished step.
- Respect any retry/reset time supplied by the service.
- On the next execution, re-fetch latest base, all relevant OPEN PRs, the target PR state, and the latest `Validate monorepo` run before continuing.
- Resume from the last incomplete step.
- Do not restart completed work or create duplicate branches, commits, PRs, or migrations.
- Never claim work will continue automatically in the background unless an actual background/scheduled execution mechanism has been created.

## Final Status Format

For successful completion, report:

```text
Status: COMPLETE
Repository: <owner/repo>
Branch: <branch>
PR: <number/link>
Latest commit: <sha>
Implementation: <summary>
Tests: PASS
Build: PASS/N/A
Lint: PASS/N/A
Validate monorepo: PASS
Conflicts resolved: <summary/None>
Database changes: <summary/None>
External/manual actions required: None
```

For a genuine blocker, report:

```text
Status: BLOCKED
Repository: <owner/repo>
Branch: <branch>
PR: <number/link/None>
Latest commit: <sha>
Completed: <summary>
Remaining: <summary>
Exact blocker: <reason>
Failed check/error: <details>
Required user/external action: <action>
```

Do not finish with `Status: IN PROGRESS` while normal executable workflow steps remain.

## Developer Invocation

A developer should tell the AI assistant to read this file before starting work. Minimum prompt:

```text
Read and strictly follow .github/ai/feature-to-pr.md and execute the task end-to-end.
Do not stop at intermediate milestones or ask me to say continue between normal workflow steps.

Feature:
<feature or bug description>

Platform requirement:
Implement the feature in both Web and Mobile unless explicitly scoped otherwise.

Requirements:
<optional requirements>

Base:
main
```

For follow-up work:

```text
Read and strictly follow .github/ai/feature-to-pr.md and execute the task end-to-end.

Continue/fix this feature:
<feature or issue>

Before every write, verify the target PR is still OPEN. Inspect all OPEN PRs before creating anything new. Reuse a relevant OPEN feature PR branch only when appropriate; never reuse a merged/closed PR branch for follow-up work.
Synchronize latest main/base when required, resolve repository-controlled conflicts/errors, and verify Validate monorepo for the latest commit.
Do not stop at intermediate milestones or ask me to say continue between normal workflow steps.

Base:
main
```
