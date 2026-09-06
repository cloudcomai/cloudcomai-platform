# CloudComAI Mobile

React Native + Expo application targeting Android and iOS from one JavaScript
codebase. The foundation uses the same language-independent PHP API and shared
authentication/API packages as the Web application.

## Development

1. Copy `.env.example` to `.env` and set the API base URL when needed.
2. Run `pnpm install` from the repository root.
3. Run `pnpm dev:mobile`, then open the project in an Android/iOS development
   build or compatible Expo Go client.

The authentication session is stored per installed app using Expo SecureStore.
It is not shared between users, devices, the Web application, or other apps.

The mobile app includes login, session restore/logout, private/group chat,
attachments, Expo notifications, local notification preferences, and opening a
chat from a notification tap. Expo/EAS credentials and production submission
remain operator-managed; see [Mobile releases](MOBILE_RELEASES.md).


## Preview builds from GitHub Actions

The repository workflow `.github/workflows/build-mobile-preview.yml` builds:

- Android: `CloudComAI-preview.apk`
- iOS: `CloudComAI-preview.ipa`

The selected build uses the `preview` EAS channel and the
`EXPO_PUBLIC_API_BASE_URL` value from the EAS `preview` environment.

Required GitHub repository configuration:

1. Secret `EXPO_TOKEN`: Expo access token used by EAS CLI.
2. Variable `EAS_PROJECT_ID`: Expo EAS project UUID.

Required Expo project environment variable:

1. `EXPO_PUBLIC_API_BASE_URL` in the `preview` environment. For the current test
   deployment, set it to `https://cloudcomai.freedev.app/apiapp/api`.

Before the first non-interactive CI build, initialize EAS credentials interactively for each platform from `apps/mobile`:

```bash
eas login
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

This initializes the EAS project and signing credentials. Android can use EAS-managed signing. iOS device/internal builds require valid Apple signing credentials and provisioning.

After the one-time setup, run **Build CloudComAI Mobile Preview** from GitHub
Actions and select a platform. Android is the default; choose iOS only after its
signing credentials are available. Successful builds are retained as GitHub
Actions artifacts for 30 days.

The first build made after `expo-updates` is enabled is the baseline that can
receive compatible over-the-air updates. Older APK/IPA installations cannot
receive them.
