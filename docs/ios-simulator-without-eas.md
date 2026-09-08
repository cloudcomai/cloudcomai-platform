# iOS Simulator preview builds without EAS

The **Build iOS Simulator without EAS** GitHub Actions workflow creates a
CloudComAI preview app for the iOS Simulator using a GitHub-hosted macOS runner.
It does not call EAS Build and does not require an Apple Developer subscription
because the artifact targets the simulator rather than a physical iPhone.

## Run the build

After this workflow is merged:

1. Open **Actions** in GitHub.
2. Select **Build iOS Simulator without EAS**.
3. Choose **Run workflow**.
4. Wait for the manual build to finish.
5. Download the `CloudComAI-iOS-Simulator-Preview-<run>` artifact.

The artifact contains:

`CloudComAI-iOS-Simulator-preview.zip`

Unzip it on a Mac and install the contained `.app` into an iOS Simulator with
Xcode or `xcrun simctl install booted <path-to-app>`.

## Required GitHub configuration

The workflow uses the existing preview configuration:

- Variable `EXPO_PUBLIC_API_BASE_URL`
- Variable `ENABLE_GOOGLE_DRIVE_ARTIFACT_UPLOAD`
- Variable `GOOGLE_DRIVE_ARTIFACT_FOLDER_ID`
- Secret `RCLONE_CONFIG`

No `EXPO_TOKEN`, `EAS_PROJECT_ID`, Apple certificate, provisioning profile,
or App Store Connect credential is required for this simulator-only build.

When Google Drive upload is enabled, artifacts are copied to:

`preview/run-<run-number>-<short-sha>/ios`

The same rclone OAuth configuration used by the mobile preview workflow is
reused here.

## Limitation

This artifact is for the iOS Simulator only. It cannot be installed directly on
a physical iPhone. A physical-device IPA requires Apple code signing and an
appropriate provisioning setup.
