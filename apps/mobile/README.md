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

This foundation includes login, session restore/logout, and private/group chat
lists. Chat detail, registration, attachments, notifications, and offline
behavior are intentionally incremental follow-up phases.
