# Repository audit — 8 September 2026

Reviewed base: `main` at `1ccf84d02265042d59e60a99d378b6cdbbd86367`.
Fix branch: `fix/repository-audit-security-reliability`.

The review covered authentication and password recovery, group membership,
message permissions and synchronization, attachment storage/access, profile
validation, deployment rules, existing tests, and web/mobile build configuration.
These are source findings supported by regression coverage, not a certification
of the deployed servers or a complete penetration test.

## Important findings addressed

| Priority | Finding and impact | Resolution |
| --- | --- | --- |
| High | The group member endpoint also accepts private chat IDs. A participant can add a third account and expose the private conversation's history. | Require an active membership in a **group** for every member operation. Reject private chat IDs. |
| High | Group authorization compares numeric membership IDs with usernames; MySQL can coerce a username such as `1intruder` into user ID 1. The roster join has the same issue and can return unrelated users. | Use `users.id` exclusively for authorization and joins. Add a regression with a numeric-prefix username. |
| High | Adding an existing owner/admin changes their role to `member`, bypassing the owner-removal protection. Owners can also remove themselves and leave an unmanaged group. | Re-adding active members preserves roles. Protect the authoritative `chats.owner_id`, reject owner removal, reject banned/unavailable targets, and serialize member updates. Existing member invitation behavior is preserved. |
| High | Stored attachments are beneath the served backend directory with no shipped rule denying direct file URLs. On a host using only the repository's rules, a known file path bypasses membership/download checks. Internal files and the cleanup script also lack equivalent protection. | Deny direct requests to storage and internal directories in the backend root `.htaccess`, which is deployed even though runtime storage is excluded. Make cleanup CLI-only. Profile/group image URLs remain accessible. |
| High | PHP's permissive date parser and unsigned year difference accept future or normalized invalid birth dates. This bypasses the existing adult-only registration/profile rule. | Validate a real, exact ISO calendar date and reject future dates before calculating age. Apply equivalent calendar checks to shared JavaScript validation. |
| High | Text/location insertion commits before notification creation. A later database error reports failure although the message exists, encouraging duplicate retries and leaving partial state. | Commit the message, chat visibility, notification history, and delivery queue together; roll everything back on failure. This does not yet provide idempotency for lost network responses. |
| Medium | A poll vote does not mark its message for incremental synchronization. Web vote responses also permanently override later server totals. | Mark voted polls for the existing update stream and expire local web vote overrides when a new poll snapshot arrives. |
| Medium | Poll voting ignores hidden, cleared, expired, and closed polls. Racing first votes can produce multiple choices; later updates can fail on the primary key. | Enforce message visibility and poll closure, serialize votes, and replace the user's choice atomically. Existing duplicate choices are repaired when that user votes again. The current API remains single-choice. |

Detailed group debug logging of account payloads and endpoint-specific CORS
overrides were removed while fixing group authorization. CORS uses the existing
shared configuration.

## Remaining findings and proposed follow-up work

These changes are proposed for approval; they are not included in this fix.

| Priority | Finding | Suggested scope |
| --- | --- | --- |
| High before wider public rollout | `backend/api/login.php` and registration have no application-level attempt throttling. Password recovery already has separate throttling. Host/WAF protections were not verified. | Agree per-account/IP limits and recovery behavior; add persistent throttling and corresponding upgrade/fresh-install schema coverage. |
| Medium | `backend/cron_cleanup.php` expires message bodies but retains attachment bytes and poll rows. Storage can grow after messages disappear. | Add bounded, retryable cleanup of expired media and poll data, with disk-failure handling and retention tests. |
| Medium | `backend/api/media_upload.php` deletes the old photo before saving its replacement. A disk/write failure can remove the previous photo. | Stage and atomically replace profile/group images; test failed writes and concurrent replacements. |
| Medium | Initial message retrieval returns the oldest 200 eligible messages and catches up on subsequent polls. Large conversations can take multiple polling intervals to reach recent messages. | Load the latest page first and add explicit older-history pagination while preserving the synchronization cursor. |
| Medium | Private chat creation checks for an existing conversation before opening its transaction. Concurrent creation can produce duplicate conversations for the same pair. | Add an enforced canonical participant-pair identity, safe reconciliation of existing duplicates, and upgrade/fresh-install SQL. |
| Low | Large web/mobile components concentrate unrelated state and UI behavior; much UI coverage exercises helpers rather than rendered interactions. | Extract components when touching the related areas and add a small end-to-end suite for registration, private chat, media, voting, and permissions. |
| Moderate dependency advisory; exposure not demonstrated | `pnpm audit --prod` reports `uuid@7.0.3` through Expo's `xcode` build dependency ([GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)). The inspected caller uses `uuid.v4()`; the advisory concerns v3/v5/v6 with supplied output buffers. | Track an upstream compatible dependency update and validate native prebuilds; avoid an untested major-version override. There are zero reported high/critical dependency advisories in this scan. |

## New feature proposals for approval

1. **Reliable offline sending.** Local drafts/outbox, visible pending/failed status,
   retry, and a server idempotency key so a lost response does not duplicate a send.
2. **Profile privacy controls.** Per-field visibility for email, mobile, age, and
   gender, with clear defaults and server-side enforcement.
3. **Group ownership transfer.** The owner can choose a successor before leaving;
   include an audit trail and role protections.
4. **Active sessions and account protection.** List/revoke devices, sign out other
   sessions, and add verified contact recovery. Design this together with login
   throttling; retain the existing password-reset session revocation.
5. **Saved messages and drafts.** Bookmarks, per-conversation drafts, and useful
   search filters for media, sender, and date.

Suggested implementation order: authentication throttling and retention cleanup;
then offline reliability and profile privacy; then group ownership and saved
messages. These can fit the current PHP/MySQL backend and static React/Expo
clients without requiring a production Node server or Redis.

## Validation and deployment

- Baseline and changed code: `pnpm check` (workspace tests, API contract, web build).
  The changed code passes 43 JavaScript tests.
- Changed code: `EXPO_PUBLIC_API_BASE_URL=https://example.invalid/api pnpm build:mobile`
  exports both Android and iOS bundles. This is not a device installation test.
- CI: PHP 8.3 syntax checks, pure PHP date/router/contact/schema tests, isolated
  MySQL 8 privacy/messaging/password-recovery integration tests, and real Apache
  access tests for root/subdirectory installations.
- Integration regressions cover numeric username impersonation, private chat
  injection, owner/admin preservation, invalid DOB APIs, poll visibility and
  synchronization, duplicate vote repair, and notification-failure rollback.
- PHP/MySQL/Apache checks run in CI because those executables are unavailable in
  the local review environment. Consult the PR checks for their executed results.
- Database structure: unchanged. Existing installations and the consolidated
  fresh-install schema use the same existing tables; no migration is required.
- After merge approval, deploy the backend root `.htaccess` along with PHP files
  and the web build. Retain the existing runtime storage and configuration.
  Check that a controlled direct storage URL returns 403 while an authorized
  attachment preview still works. Non-Apache hosts need equivalent access rules.
- The PR changes source code and tests. Production deployment remains a separate
  manual action, and physical Android/iOS smoke tests remain necessary.

Implementation references: [PHP calendar parsing](https://www.php.net/manual/en/datetimeimmutable.createfromformat.php)
and [Apache forbidden rewrite rules](https://httpd.apache.org/docs/current/rewrite/flags.html#flag_f).
