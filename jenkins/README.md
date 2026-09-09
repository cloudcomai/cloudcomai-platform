# CloudComAI Jenkins Pipelines

This folder is intentionally isolated from `.github/workflows` and the existing `deployment/` directory. Jenkins jobs should point directly at the Jenkinsfiles in this folder.

## Job layout

Create these Jenkins Pipeline jobs:

- `CloudComAI-DB-Validate` -> `jenkins/Jenkinsfile.db-validate`
- `CloudComAI-DB-Migrate` -> `jenkins/Jenkinsfile.db-migrate`
- `CloudComAI-Backend-Build` -> `jenkins/Jenkinsfile.backend-build`
- `CloudComAI-Backend-Deploy` -> `jenkins/Jenkinsfile.backend-deploy`
- `CloudComAI-Web-Build` -> `jenkins/Jenkinsfile.web-build`
- `CloudComAI-Web-Deploy` -> `jenkins/Jenkinsfile.web-deploy`
- `CloudComAI-Android-Build` -> `jenkins/Jenkinsfile.android-build`
- `CloudComAI-iOS-Build` -> `jenkins/Jenkinsfile.ios-build`
- `CloudComAI-Full-Build-Deploy` -> `jenkins/Jenkinsfile.full`

## Required build order

The combined pipeline uses this dependency order:

```text
DB validate
   |
Backend build
   |
Web build
   |
   +-------------------+
   |                   |
Android build       iOS build
   |                   |
   +---------+---------+
             |
      all builds passed
             |
      DB migration
             |
      Backend deploy
             |
   Backend health check
             |
        Web deploy
             |
      Web health check
```

Android and iOS execute in parallel only after DB, backend and web validation/builds succeed.

Database *validation* happens before builds. Database *migration* is deferred until all selected builds have succeeded so a failed mobile/web/backend build cannot leave the database ahead of the deployed application.

## Build and deployment separation

Build jobs never deploy. Deploy jobs consume an archived artifact/build number.

This means:

- a build can be run repeatedly without changing a server;
- the exact tested artifact can later be deployed;
- production can use a previously verified build;
- DB migration remains a separate explicit action;
- the full orchestrator reuses the same individual jobs rather than duplicating their logic.

## Full pipeline modes

`CloudComAI-Full-Build-Deploy` supports:

- `build-only` - DB validation + backend + web + selected mobile builds; no deployment.
- `test-deploy` - build everything selected and deploy to test.
- `production-deploy` - build everything selected and deploy to production; requires confirmation.
- `android-only` - Android build only.
- `full` - DB validation, backend, web, parallel mobile builds, DB migration if selected, backend deploy and web deploy.

## Jenkins agents

Recommended labels:

- `windows` or `linux`: web/backend/DB/Android jobs.
- `android`: agent with Java 21+, Android SDK and Gradle requirements.
- `macos`: iOS agent with Xcode for local iOS builds.

A signed local iOS build requires macOS/Xcode and Apple signing. Jenkins itself does not remove this Apple requirement. If no macOS agent is available, keep `BUILD_IOS=false` or adapt the iOS job to trigger EAS.

## Tooling expected on agents

- Git
- Java 21+ for Jenkins/Android tooling
- Node.js 24
- Corepack + pnpm 10.15.0
- PHP 8.3
- curl
- zip/PowerShell archive support as appropriate
- Android SDK for Android local builds
- Xcode for iOS local builds

## Credentials

Create Jenkins credentials instead of putting secrets in source control. Suggested IDs:

- `cloudcomai-github`
- `cloudcomai-test-ftp`
- `cloudcomai-prod-ftp`
- `cloudcomai-migration-token`
- `cloudcomai-test-db`
- `cloudcomai-prod-db`
- `android-keystore`
- `android-key-alias`
- `android-key-password`
- `android-store-password`

Environment values such as `EXPO_PUBLIC_API_BASE_URL`, deploy host/path and migration tokens must come from Jenkins credentials/environment configuration.

## Artifacts

Recommended artifact naming:

- `web-build-<jenkins-build>-<git-sha>.zip`
- `backend-build-<jenkins-build>-<git-sha>.zip`
- `cloudcomai-android-<profile>-<jenkins-build>-<git-sha>.apk`
- `cloudcomai-android-<profile>-<jenkins-build>-<git-sha>.aab`
- `cloudcomai-ios-<profile>-<jenkins-build>-<git-sha>.ipa`

The templates archive artifacts in Jenkins and fingerprint them.

## Production safety

The full pipeline requires `CONFIRM_PRODUCTION=true` before a production deployment. Fresh-install database operations are intentionally not included in the full production flow. Fresh installation should remain a separately controlled administrative operation.

## Existing CI/CD

These files do not replace or modify the current GitHub Actions/EAS workflows. Jenkins can be introduced gradually and the existing workflows can remain as fallback/manual alternatives.
