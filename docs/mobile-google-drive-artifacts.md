# Google Drive mobile artifact upload

CloudComAI mobile build workflows upload successful build outputs to Google Drive in addition to the normal GitHub Actions artifact.

## Destination folder

Default Drive folder ID:

`1Qs0iWqJbn-2D46S0ef6ddaMFQgHqmY1u`

You can override it later with the repository variable:

`GOOGLE_DRIVE_ARTIFACT_FOLDER_ID`

## Required GitHub secret

Create a Google Cloud service account with Google Drive API access and add its full JSON key as the GitHub Actions secret:

`GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`

Share the destination Google Drive folder with the service account email address as **Editor**. The service account only needs access to this folder; the entire Drive does not need to be shared.

## Folder layout

Production Android builds are copied to:

`production/run-<github-run-number>-<short-sha>/android/`

Preview builds are copied to:

`preview/run-<github-run-number>-<short-sha>/android/`

or:

`preview/run-<github-run-number>-<short-sha>/ios/`

This prevents a later build from overwriting an earlier artifact.

## Files

Production Android:

- `CloudComAI-production.aab`
- `CloudComAI-production.apk`
- AAB build metadata
- APK build metadata

Preview builds include the platform preview binary and its build metadata.

GitHub Actions artifacts are still retained for 30 days. The Drive upload is an additional persistent copy.
