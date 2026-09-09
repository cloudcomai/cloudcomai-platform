# Android builds without Expo cloud quota

The **Build Android without EAS** workflow uses Expo's local prebuild command
and the Android Gradle wrapper on a GitHub runner. It does not call EAS Build,
need EXPO_TOKEN, or consume an EAS cloud build. GitHub Actions usage limits
still apply. The same script runs on a computer with Node 22, pnpm 10.15,
JDK 17 and the Android SDK/NDK installed (Android Studio can install these).

## Download a test APK

Open Actions → Build Android without EAS → Run workflow. Choose the
feature branch for testing (or main), then choose preview. Download the APK from the completed run's artifact.
This workflow runs manually; opening or updating a pull request does not
start an Android build.
The preview is named **CloudComAI Test**, uses a separate application ID and
is signed with the Android template's debug key. It installs alongside the
existing app, contains its JS bundle and does not require Metro or Expo Go.
It is for testing and must not be published to Google Play.

Set the repository/environment variable `EXPO_PUBLIC_API_BASE_URL` to your
backend's HTTPS API URL. Without it, preview builds use example.invalid to allow
compilation; such an APK cannot sign in until rebuilt with a real URL.
Preview builds do not configure Firebase by default, so test background push
notifications with a signed release and its matching Firebase configuration.

## Signed release APK and AAB

Configure these secrets in the existing `production` GitHub environment:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64 encoding of the existing Android keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Alias of the signing key |
| `ANDROID_KEY_PASSWORD` | Key password |
| `ANDROID_GOOGLE_SERVICES_JSON` | Firebase google-services.json for com.cloudcomai.mobile |

Download the **existing** keystore using `eas credentials -p android` if EAS
currently manages it. This retrieves credentials; it does not start a cloud
build. Keep the credentials private and out of git. Use the existing signing
identity to update directly installed APKs. For Google Play App Signing, use
the registered upload key for the AAB; a locally signed APK cannot replace an
APK installed from Play unless its app signing certificate matches.

Run the workflow from `main`, choose `release`, and enter a version code
higher than the last code used by EAS/Google Play. This path manages the code
explicitly; EAS remote auto-increment is not used. The artifact includes both
APK and AAB from the same source, version code and signing configuration.
No store submission or production deployment is performed.

## Build on your computer

From the repository root, install dependencies and set the public API URL:

```bash
pnpm install --frozen-lockfile
export EXPO_PUBLIC_API_BASE_URL=https://your-domain.example/apiapp/api
node apps/mobile/scripts/build-android.mjs preview
```

For a release, provide `ANDROID_VERSION_CODE`, `ANDROID_KEYSTORE_PATH` (absolute
path), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
and `ANDROID_GOOGLE_SERVICES_FILE` through your local environment, then run:

```bash
node apps/mobile/scripts/build-android.mjs release
```

The script regenerates `apps/mobile/android/`; keep custom native changes in
config plugins. APK output is in `apps/mobile/android/app/build/outputs/apk/release/`
and AAB output is in `apps/mobile/android/app/build/outputs/bundle/release/`.

These standalone builds disable EAS Update and receive changes through new
APKs/store releases. The existing EAS workflows and their OTA behavior remain
available. Expo modules and the Expo push transport remain part of the app;
avoiding EAS Build does not require replacing those libraries/services.

Reference: [Expo local release builds](https://docs.expo.dev/guides/local-app-production/).
