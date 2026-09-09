# Chat lifecycle and account controls

## Behavior

- Polls accept a future expiry date. Leaving it blank gives the poll 30 days from creation. Dates chosen in the apps expire at the end of that local calendar day and are stored in UTC. Voting closes at expiry and expired polls disappear from messages.
- Existing polls without a deadline receive `created_at + 30 days` during upgrade. Existing poll messages keep an earlier retention deadline if they already have one. New polls use their chosen poll deadline; ordinary messages continue to use the conversation's retention policy.
- Expired messages become inaccessible immediately. Daily cleanup permanently removes message content, associated attachments, poll choices/votes, saved references, and notifications. Incremental synchronization removes deleted messages from already-open conversations.
- Read receipts use the last message actually displayed while the chat is foregrounded and scrolled to its bottom. Opening a chat cannot mark a newer, unseen message as read. Notification badges use server counts; inbox entries can be marked read or unread. Account push preferences and chat mute settings are checked again before sending queued notifications.
- Text messages are saved locally before sending and retry while the app is open and connected. The same request ID is reused after a lost response or app restart, preventing duplicate server messages. Permanent failures show Retry/Discard and hold later messages in that conversation until resolved. Media uploads still require a connection.
- Draft text is stored per account and conversation on the current device. Editing or cancelling an existing message preserves the previous draft. Drafts and pending text remain on this device after sign-out and resume when that same account signs in; they do not sync between devices. Clearing browser/app storage removes them.
- Save/Unsave appears in message actions. Settings → Saved messages lists accessible saved messages and opens their conversations. Saving does not extend retention or restore deleted messages.
- Privacy & Account → Profile visibility controls email, phone, age, and gender. Email/phone start private; age/gender retain their existing visible defaults. Hidden contact fields are excluded from profile results and email search matching.
- Settings → Devices & sessions lists active sign-ins. Users can sign out one device or all other devices. The latter also invalidates older legacy tokens, rotates the current token, and registers this mobile device for push again.
- The owner can choose Make owner for an active member in group management. The previous owner becomes an admin, existing invitation links are revoked, and the transfer is recorded. Other members cannot transfer ownership through the API.

## Upgrade an existing installation

1. Back up the database and attachment storage before deployment.
2. Apply outstanding existing migrations, then `backend/database/migrations/012_chat_lifecycle_controls.sql` using the existing migration runner (`backend/scripts/migrate.php`; the GoDaddy release workflow stages and invokes this runner). Migration 012 is independently idempotent. Number 011 is reserved for the separate public-city-chat PR.
3. Deploy the backend before the updated web/mobile clients. New endpoints require the new tables. Existing authentication tokens continue working until expiry or explicit revocation.
4. Install the daily cron entry below and keep the existing notification worker schedule. These are separate jobs.

For a fresh database, import `backend/database/fresh-install.sql` once. It already includes the current tables, indexes, defaults, and migration markers; do not replay historical SQL on a fresh installation. The database integration suite compares the migration-created tables with the consolidated schema and repeats the migration to check idempotence.

## Daily cleanup on the backend host

Use `backend/cron/daily-cleanup.cron.example`. Replace the PHP executable and account paths, create a writable log directory outside the web root, and configure the hosting cron timezone as UTC:

```cron
15 2 * * * /usr/local/bin/php /home/ACCOUNT/public_html/apiapp/cron_cleanup.php >> /home/ACCOUNT/logs/cloudcomai-cleanup.log 2>&1
```

The command is CLI-only and uses the deployed backend configuration. It requires database DELETE/UPDATE access and filesystem permission to remove uploaded attachments. It takes a database lock so concurrent invocations do not duplicate work. A normal run handles up to 50,000 messages and 5,000 queued files; run it again to drain a larger initial backlog. File deletion happens after database commit and failures remain queued for a later run. Review its JSON counts and nonzero exit status in the host's cron monitoring.

There is no dry-run mode: a manual invocation performs deletion. Expired content cannot be recovered by rolling back code. To pause cleanup, disable this cron entry; leave the additive tables intact when rolling back the application. Restore content only from an appropriate pre-cleanup backup. Synchronization tombstones retain IDs/chat IDs without message text, and retry records retain keys/hashes to prevent an old send from recreating deleted content.

This PR provides the job and installation instructions. It does not install a production cron, run a production migration, or delete production data.

## Related PR review

Reviewed against `main` at `f69d113` on 2026-09-09. The latest Android workflow, chat themes, notification navigation, profile preview, and profile cache fixes are preserved.

| Open PR | Relationship to this work |
| --- | --- |
| [#74 Android push delivery](https://github.com/cloudcomai/cloudcomai-platform/pull/74) | Complementary changes to push priority, retries, and invalid device tokens. Both edit the notification worker; retain this PR's eligibility checks/lock and that PR's transport improvements when resolving the eventual merge. |
| [#79 Video playback](https://github.com/cloudcomai/cloudcomai-platform/pull/79) | Playback startup/retry changes share the media component with the responsive sizing fixes here. Preserve both behaviors. |
| [#73 Contacts auto-sync](https://github.com/cloudcomai/cloudcomai-platform/pull/73) | Shares the dashboard file; its contacts work is separate from this PR's notification list. |
| [#75 Public city chats](https://github.com/cloudcomai/cloudcomai-platform/pull/75) | Shares mobile App, API contract, and consolidated schema. Its App diff includes extensive line compression. Keep the new mobile features during conflict resolution and retain both independent migrations (011/012). |
| [#70 Profile/presence/media](https://github.com/cloudcomai/cloudcomai-platform/pull/70) | Partly overlaps profile preview/cache fixes already merged through #76/#78. Also shares profile/group/media APIs with the privacy and ownership controls here; review its remaining changes against current main. |

None of these open PRs duplicates poll expiry, daily retention cleanup, persistent text retry/drafts, saved messages, device sessions, or ownership transfer. They have not been merged or copied into this feature branch.

## Validation

Run `pnpm check` and `EXPO_PUBLIC_API_BASE_URL=https://example.invalid/api pnpm build:mobile`. The GitHub validation workflow also runs PHP lint, unit tests, Apache storage-access checks, and MySQL integration tests covering authorization, privacy, notification visibility, read watermarks, idempotent sends, retention/files, ownership, sessions, and fresh/upgrade schema consistency.

Android builds can use the manual [Gradle workflow](android-without-eas.md) without EAS cloud quota. Native bundle exports do not replace physical-device checks for the keyboard, large text, notification taps, background push, and video playback.
