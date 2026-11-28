# Creator Clicks lifecycle deployment

## Scope and isolation

Creator Clicks uses only `creator_clicks_*` tables and dedicated API handlers. This work does not require changing CloudComAI account, chat, WebSocket, or Moments tables.

## Migration

Apply database migrations in order, including:

- `033_creator_clicks.sql`
- `034_creator_clicks_lifecycle.sql`

Migration 034 adds separate channel tombstone/profile-image fields, a 24-hour feed deadline, and a retryable media-cleanup queue. It preserves each post's 90-day `expires_at` deadline.

Do not run the API code before applying the migration. The repository's deployment migration process should be used; no production database was modified by this PR.

## Media requirements

- Creator media storage: `backend/uploads/creator-clicks/{creator_id}/`
- Profile pictures: JPG, PNG, WebP; maximum 5 MB.
- Post images: JPG, PNG, WebP; maximum 10 MB each; maximum five per post.
- Video: MP4, MOV, WebM; maximum 160 seconds. Server-side duration validation requires `ffprobe` to be installed and callable by PHP.
- Media is served through authenticated Creator Clicks endpoints. Video responses support HTTP byte ranges.
- Do not expose the upload directory as a public static directory.

## Retention and cleanup

Schedule the following CLI worker at least daily:

```sh
php backend/cron/creator_clicks_cleanup.php
```

The worker:
- Deletes posts after their original 90-day retention deadline.
- Removes dependent reactions, views, and reports for purged posts.
- Processes queued media cleanup in retryable batches.
- Preserves media still referenced by another post or creator profile.
- Removes abandoned uploads older than 24 hours when they are not referenced.

Run the worker under the same deployment account and PHP configuration used by the backend. Confirm the Creator Clicks upload directory is writable by the API and removable by the worker.

## Delete-operation guarantees

- Individual post deletion is owner-scoped and transactionally removes only the selected post and its engagement records.
- Channel deletion is a separate owner-scoped operation. It deletes the channel's posts and follower relationships and writes a channel tombstone so the deleted channel cannot be reopened.
- Channel deletion does not delete the CloudComAI user record, credentials, chats, contacts, Moments, or unrelated data.

## Rollout checklist

1. Back up the database and Creator Clicks upload directory.
2. Apply migrations 033 and 034.
3. Deploy backend API handlers and client changes.
4. Verify `ffprobe` and storage permissions.
5. Configure the daily cleanup worker.
6. Validate uploads, authenticated media playback, feed/history expiry, post deletion, and channel deletion in staging.
7. Only then consider production rollout under the normal release approval process.

No production migration or deployment is performed by this PR.
