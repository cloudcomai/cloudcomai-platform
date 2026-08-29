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
remain operator-managed; see the release checklist.
