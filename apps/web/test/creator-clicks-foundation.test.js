import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const sidebar = read('../src/components/Sidebar.jsx');
const app = read('../src/App.jsx');
const panel = read('../src/components/CreatorClicksPanel.jsx');
const routes = read('../../../packages/api-client/src/endpoints.js');
const client = read('../../../packages/api-client/src/cloudcomai-api.js');
const contract = JSON.parse(read('../../../backend/api-contract.json'));
const api = read('../../../backend/api/creator_clicks.php');
const migration = read('../../../backend/database/migrations/033_creator_clicks.sql');

test('Creator Clicks has a separate Web navigation entry and panel', () => {
  assert.match(sidebar, /setModal\('creator_clicks'\)/);
  assert.match(sidebar, /Creator Clicks/);
  assert.match(app, /CreatorClicksPanel/);
  assert.match(panel, /Live Streaming · Coming Soon/);
});

test('Creator Clicks uses a dedicated authenticated API route and typed client methods', () => {
  assert.equal(contract.routes['v1/creator-clicks'].handler, 'creator_clicks.php');
  assert.deepEqual(contract.routes['v1/creator-clicks'].methods, ['GET', 'POST', 'DELETE']);
  assert.match(routes, /CREATOR_CLICKS: 'v1\/creator-clicks'/);
  assert.match(client, /listCreatorClicksFeed/);
  assert.match(client, /publishCreatorClick/);
  assert.match(client, /followCreator/);
});

test('Creator Clicks storage is isolated from chat and Moments tables', () => {
  assert.match(migration, /creator_clicks_profiles/);
  assert.match(migration, /creator_clicks_posts/);
  assert.match(migration, /creator_clicks_follows/);
  assert.doesNotMatch(migration, /CREATE TABLE[^;]*(messages|stories|chats)/i);
  assert.match(api, /INTERVAL 90 DAY/);
  assert.match(api, /creator_clicks_blocks/);
});

test('Creator milestone badges require platform verification', () => {
  assert.match(migration, /platform_verified_at DATETIME NULL/);
  assert.match(api, /platform_verified_at/);
  assert.match(api, /\$row\['platform_verified_at'\] !== null/);
});

test('Live Streaming remains a disabled placeholder with no streaming implementation', () => {
  assert.match(panel, /disabled style=\{\{ \.\.\.buttonStyle/);
  assert.match(panel, /Coming Soon/);
  assert.doesNotMatch(panel, /getUserMedia|RTCPeerConnection|WebRTC|MediaStream/);
});

test('Channel creation and broadcast publishing live only in the My channel tab', () => {
  const feedStart = panel.indexOf("{tab === 'feed'");
  const discoverStart = panel.indexOf("{tab === 'discover'");
  const channelStart = panel.indexOf("{tab === 'profile'");
  const footerStart = panel.indexOf('<footer');
  const feed = panel.slice(feedStart, discoverStart);
  const channel = panel.slice(channelStart, footerStart);
  assert.doesNotMatch(feed, /Create my channel|Publish a broadcast|>Publish</);
  assert.match(channel, /Create my channel/);
  assert.match(channel, /Publish a broadcast/);
  assert.match(channel, />Publish</);
});
