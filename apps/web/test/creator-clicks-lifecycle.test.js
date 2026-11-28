import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const api = read('../../../backend/api/creator_clicks.php');
const migration = read('../../../backend/database/migrations/034_creator_clicks_lifecycle.sql');
const worker = read('../../../backend/cron/creator_clicks_cleanup.php');
const panel = read('../src/components/CreatorClicksPanel.jsx');
const client = read('../../../packages/api-client/src/cloudcomai-api.js');

test('Creator Clicks separates 24-hour feed expiry from 90-day history retention', () => {
  assert.match(migration, /feed_expires_at/);
  assert.match(migration, /DATE_ADD\(created_at, INTERVAL 24 HOUR\)/);
  assert.match(api, /INTERVAL 24 HOUR/);
  assert.match(api, /INTERVAL 90 DAY/);
  assert.match(api, /p\.feed_expires_at>UTC_TIMESTAMP\(\)/);
  assert.match(api, /p\.expires_at>UTC_TIMESTAMP\(\)/);
});

test('Discover excludes followed creators and feed is restricted to followed creators', () => {
  assert.match(api, /NOT EXISTS\(SELECT 1 FROM creator_clicks_follows followed WHERE followed\.follower_id=\? AND followed\.creator_id=p\.user_id\)/);
  assert.match(api, /EXISTS\(SELECT 1 FROM creator_clicks_follows f WHERE f\.creator_id=p\.creator_id AND f\.follower_id=\?\)/);
});

test('Post deletion is a separate owner-scoped transaction and never deletes the channel', () => {
  assert.match(api, /WHERE id=\? AND creator_id=\? AND deleted_at IS NULL FOR UPDATE/);
  assert.match(api, /'channel_preserved' => true/);
  assert.match(api, /DELETE FROM creator_clicks_posts WHERE id=\? AND creator_id=\?/);
  assert.match(panel, /Delete Post/);
  assert.match(client, /deleteCreatorClick\(postId/);
});

test('Channel deletion is an independent owner-scoped operation and leaves the account intact', () => {
  assert.match(api, /\$operation === 'channel'/);
  assert.match(api, /SELECT user_id,channel_deleted_at FROM creator_clicks_profiles WHERE user_id=\? FOR UPDATE/);
  assert.match(api, /DELETE FROM creator_clicks_follows WHERE creator_id=\? OR follower_id=\?/);
  assert.match(api, /'account_preserved' => true/);
  assert.match(api, /channel_deleted_at=UTC_TIMESTAMP\(\)/);
  assert.match(api, /channel_deleted_at IS NULL/);
  assert.match(panel, /Delete Channel/);
  assert.match(client, /deleteCreatorClicksChannel/);
});

test('Creator Clicks cleanup is retryable, CLI-only, and scoped to its own media directory', () => {
  assert.match(worker, /PHP_SAPI !== 'cli'/);
  assert.match(worker, /creator_clicks_posts/);
  assert.match(worker, /uploads\/creator-clicks/);
  assert.match(worker, /attempts<8/);
  assert.doesNotMatch(worker, /DELETE FROM (messages|chats|stories)/i);
});

test('Creator Clicks validates and serves isolated images, videos, and profile pictures', () => {
  const upload = read('../../../backend/api/creator_clicks_media_upload.php');
  const serve = read('../../../backend/api/creator_clicks_media.php');
  const profileUpload = read('../../../backend/api/creator_clicks_profile_upload.php');
  const profileMedia = read('../../../backend/api/creator_clicks_profile_media.php');
  const contract = JSON.parse(read('../../../backend/api-contract.json'));
  assert.match(upload, /10 \* 1024 \* 1024/);
  assert.match(upload, /160/);
  assert.match(upload, /ffprobe/);
  assert.match(serve, /HTTP_RANGE/);
  assert.match(profileUpload, /5 \* 1024 \* 1024/);
  assert.match(profileMedia, /channel_avatar_path/);
  assert.equal(contract.routes['v1/creator-clicks/media/upload'].handler, 'creator_clicks_media_upload.php');
  assert.equal(contract.routes['v1/creator-clicks/profile/upload'].handler, 'creator_clicks_profile_upload.php');
});
