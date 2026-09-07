# Privacy, message controls, and media

Settings → Privacy & Account is available in the web app and mobile Settings. Controls are saved for the signed-in account and apply across devices.

- **Blocked contacts:** blocks private messages, polls, media, and location in both directions; existing history remains readable. Shared groups remain available. Unblock from the same panel.
- **Hide online status:** other users see the account as offline. Presence timestamps are not exposed by the user directory.
- **Automatically load chat media:** off by default. Images, voice notes, and video load when selected; enabling this setting loads previews automatically. It does not grant permission to download originals.
- **Storage & media:** shows uploaded media totals for this account, grouped by media type.
- **Account backup:** exports the account profile, preferences, contacts, visible chats/messages, and attachment metadata as JSON. It excludes passwords, authentication tokens, hidden/deleted messages, and media bytes. This is an account data export; there is no in-app restore/import action.

Each message offers **Delete for me**. The sender also has **Delete for everyone**, which removes server-side message content and media files. Other open clients receive deletion updates through normal polling, including removal of quoted text. Previously saved files or screenshots cannot be recalled.

Search in the conversation header searches message content and attachment filenames across visible history, returning up to 100 matches. Deleted, cleared, expired, and other users' conversations are excluded. Edits and deletions synchronize without refreshing the whole screen.

Voice recordings stop at 30 seconds; new camera recordings stop at 60 seconds where the device camera supports that limit. The user previews a recording before sending or cancels it. Existing videos can also be selected. All media uploads have a 25 MB server limit. HTTPS and microphone/camera permission are required for browser recording. Device support for codecs varies; MP4/AAC provides the widest native compatibility, while browser recorders may produce WebM.

Location shares a single current coordinate with an external map link after foreground location permission. It does not start live/background tracking.

## Screenshot alerts

The native app reports screenshots detected while a conversation is open on iOS and Android 14 or newer. The person taking the screenshot sees a popup, and other participants who enabled screenshot alerts receive a notification. An open web/mobile chat also displays the incoming alert through polling. The setting controls receipt of alerts, not whether the user's capture is reported.

Android 13 and older are not enabled because screenshot detection requires broad gallery access on those versions. Browsers do not reliably expose OS screenshot events. External cameras and some capture methods cannot be detected. This feature provides notification, not screenshot prevention or DRM.

Mobile notification registration uses an Expo push token. Background delivery still requires the existing Expo push credentials, PHP delivery worker, and device notification permission. Foreground category toggles continue to apply.

## Deployment

For an existing database, apply `backend/database/migrations/006_privacy_and_security.sql` before using this backend. The existing GoDaddy incremental deployment migration step includes it. For a new installation, use the consolidated `backend/database/fresh-install.sql`. InfinityFree imports the incremental SQL manually as before.

The added Expo audio, video, camera picker, location, screen-capture, and file-sharing modules require a **new APK/AAB/native app build**. An OTA update alone cannot install these native modules. The existing fingerprint runtime policy keeps incompatible updates apart. Web/backend deployment remains the existing static-web and PHP workflow.

PR validation builds web and mobile, checks shared logic and API routes, lints PHP, and runs the privacy/messaging suite against an isolated MySQL service. These checks do not connect to production or deploy the application.

Device acceptance: test mic/camera/location permission grant and denial; record/preview/cancel/send; play media on both Android and iOS; take a screenshot with two signed-in devices; and delete a message while the other device has the chat open.
