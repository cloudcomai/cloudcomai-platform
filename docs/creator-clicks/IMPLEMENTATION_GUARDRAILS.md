# Creator Clicks — Implementation Guardrails

Status: implementation tracking document; staged implementation is in progress. Live Streaming is excluded and must remain a disabled Coming Soon entry.

## Scope

Implement Creator Clicks as an isolated creator discovery and one-way broadcast ecosystem across the existing CloudComAI Web (React + Vite), Mobile (React Native + Expo), PHP backend, and MySQL database.

## Non-negotiable zero-regression boundary

- Do not redesign or alter existing Web or Mobile chat layouts.
- Do not change private, group, or public chat message processing, routes, API contracts, database records, or WebSocket event contracts.
- Do not repurpose chat messages or chat WebSocket transport for Creator Clicks broadcasts or live video.
- Do not change Moments behaviour, storage, privacy, expiry, or avatar indicators.
- Keep Web and Mobile navigation and presentation platform-specific.
- Implement Creator Clicks behind separate feature modules, endpoints, tables, permissions, and namespaced real-time events.
- Any proposed shared integration must be minimal, documented, covered by regression tests, and reviewed before merging.

## Required implementation workstreams

1. Repository architecture and regression baseline.
2. Creator directory, profiles, channel ownership, follow/unfollow.
3. One-way broadcasts (text, image, video, voice, polls), reactions, pins, sharing, and content permissions.
4. Secure uploads with server-side content/signature/MIME/size/duration validation.
5. Dedicated Creator Clicks schema, reversible migrations, and retention cleanup.
6. Fixed 90-day content expiry based on original publication time; editing and viewing must not extend expiry. Expired media must be inaccessible and purged safely.
7. Live Streaming entry point is visible but disabled and labelled **Coming Soon**. Do not implement live sessions, WebRTC, streaming providers, streaming APIs, camera/microphone permissions, or live-session lifecycle in this milestone. Future streaming must use dedicated transport and never chat WebSocket.
8. Push/in-app notifications with preferences and duplicate suppression.
9. Follower management, block/unblock, reports, moderation and audit trails.
10. Creator analytics, verified-owner follower milestone badges, and per-follower unseen broadcast state.
11. Distinct avatar unseen ring and LIVE indicator, without touching Moments indicators.
12. Reuse existing screenshot/screen-capture protections where supported; document platform limitations.
13. Independent Web and Mobile screens, accessibility, responsive/safe-area handling.
14. Automated tests, production builds, regression validation, implementation screenshots and deployment/rollback documentation.

## Navigation requirements

- Mobile Home quick actions: New Chat, New Group, Contacts, Settings, Creator Clicks.
- Keep Polls in its existing separate right-corner position.
- Web: add a separate Creator Clicks sidebar item within the existing Web sidebar structure.

## Data and security principles

- Backend authorization is authoritative; hiding UI controls is not authorization.
- Creator Clicks broadcasts, reactions, polls, followers, live sessions, reports, and analytics must not be stored as chat messages.
- Use transaction-safe follow counts and badge progression.
- Prevent blocked users from following, viewing restricted content, reacting, voting, or receiving channel notifications. There are no stream-joining actions in this milestone.
- Expiry and deletion jobs must be batched, retryable, idempotent, and scoped only to Creator Clicks records.
- Keep secrets server-side and use authenticated, non-guessable media access.
- Retain only the minimum necessary moderation/security audit metadata after content expiry, according to documented policy.

## Delivery and acceptance gates

- Work only on this feature branch; never commit directly to main/master.
- Inspect open PRs and re-check the base branch before implementation.
- Add reversible migrations and tests before declaring individual workstreams complete.
- Run Web, Mobile, PHP, database, upload, notification, live lifecycle, expiry, security, and existing chat/Moments regression checks.
- Report each validation as PASS, FAIL, NOT RUN, or BLOCKED with evidence.
- Capture screenshots/recordings from the actual running Web and Mobile applications.
- Keep this PR in draft until implementation and validation evidence are complete.
- Do not merge or deploy without explicit owner approval.

## Current status

This branch now contains the first foundation slice: isolated Creator Clicks tables, an authenticated directory/feed/profile/follow/text-broadcast API, shared API-client methods, independent Web and Mobile entry points, and initial regression tests. Image/video/voice/poll media publishing, secure media serving, cleanup workers, notifications, moderation UI, analytics, unseen rings, and full verification workflows remain incomplete. Live Streaming remains Coming Soon and is explicitly excluded from the current implementation.
