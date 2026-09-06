# CloudComAI mobile releases

CloudComAI uses EAS Build for native binaries and EAS Update for compatible
JavaScript and asset changes. Mobile release workflows are independent of the
GoDaddy and InfinityFree web/backend deployments.

## One-time configuration

### GitHub repository settings

Configure:

- Secret `EXPO_TOKEN`: an Expo access token allowed to manage the project.
- Variable `EAS_PROJECT_ID`: the EAS project UUID.
- Environments `preview` and `production`. Add required reviewers to the
  `production` environment when the repository plan supports them.

### EAS environment variables

Set `EXPO_PUBLIC_API_BASE_URL` as a **plain text** variable in each EAS
environment. It is intentionally not committed in `eas.json`, so changing a
hosting provider does not require a code change.

```bash
eas env:set \
  --name EXPO_PUBLIC_API_BASE_URL \
  --value https://cloudcomai.freedev.app/apiapp/api \
  --environment preview \
  --visibility plaintext

eas env:set \
  --name EXPO_PUBLIC_API_BASE_URL \
  --value https://www.cloudcomai.com/apiapp/api \
  --environment production \
  --visibility plaintext
```

`EXPO_PUBLIC_` values are embedded in the client and must never contain
passwords, access tokens, or other secrets.

### Baseline binaries

After merging the EAS Update setup, create and install a new native build. An
older binary that does not contain `expo-updates` cannot receive OTA releases.

1. Run **Build CloudComAI Mobile Preview** and select `android`, `ios`, or
   `all`.
2. Install and test the preview binary.
3. When ready to launch, run **Build CloudComAI Mobile Production** from
   `main`, enter `BUILD`, and select the platform.
4. Submit the resulting production binary separately. The workflow does not
   publish to Google Play or the Apple App Store.

Production builds use remote store build numbers and automatically increment
them. Increment `expo.version` in `app.json` when creating a new user-visible
store release.

When `android` or `all` is selected, the production workflow creates both
Android formats from the same source commit:

| File | Purpose | Location |
| --- | --- | --- |
| `CloudComAI-production.aab` | Upload to Google Play | EAS Build and the `CloudComAI-Android-Production` GitHub Actions artifact |
| `CloudComAI-production.apk` | Install directly on an Android device for release testing | EAS Build and the same GitHub Actions artifact |

The workflow builds the AAB first with automatic version-code incrementing.
The `production-apk` profile then reuses that remote version code without
incrementing it again, keeping the paired AAB and APK on the same Android build
number. The GitHub Actions download is retained for 30 days; EAS retains its
own build records according to the Expo account plan.

## Incremental release decision

| Change | Release path |
| --- | --- |
| PHP, database, or server configuration only | Deploy the backend; do not publish a mobile release. Keep the API backward-compatible with installed app versions. |
| JavaScript, UI, styling, or bundled assets only | Publish an EAS Update after testing. |
| Expo SDK, native module/config plugin, permission, package/bundle identifier, or other native configuration | Increment the app version and create a new EAS Build. |

The fingerprint runtime policy prevents a binary from loading an update built
for incompatible native code. If a native fingerprint changes, produce new
preview and production binaries before publishing updates for that runtime.

## Publish an OTA update

1. Merge the approved application PR.
2. From the `main` commit being released, run **Publish CloudComAI Mobile
   Update** with channel `preview` and a descriptive message.
3. Test the installed preview build, including login, API connectivity, chats,
   attachments, and notifications.
4. Run the workflow again from the same `main` commit with channel
   `production`, enter `PUBLISH`, and use the same release description.

The production workflow is rejected from non-`main` refs. Selecting the
`production` GitHub environment also applies any configured environment
approval rules. Publishing an OTA update does not submit or install a new native
binary.

## Rollback

If an OTA release fails after publication, use the EAS dashboard or run
`eas update:rollback` from `apps/mobile` to republish a previously working
update or return clients to the update embedded in their binary. Test the
rollback on the affected channel before treating the incident as resolved.

A native binary cannot be rolled back with EAS Update. Correct it with a new
store build or use the store's release controls.
