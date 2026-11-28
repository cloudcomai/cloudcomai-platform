import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');
const screen = fs.readFileSync(new URL('../src/components/CreatorClicksScreen.js', import.meta.url), 'utf8');

test('Creator Clicks is placed between Settings and Polls in the mobile Home quick actions', () => {
  const settings = app.indexOf('accessibilityLabel="Open settings"');
  const creator = app.indexOf('accessibilityLabel="Open Creator Clicks"');
  const polls = app.indexOf('accessibilityLabel="Create poll"');
  assert.ok(settings >= 0 && creator > settings && polls > creator);
});

test('Creator Clicks opens as an independent screen without changing chat routes', () => {
  assert.match(app, /<CreatorClicksScreen user=\{session\.user\}/);
  assert.match(app, /setCreatorClicksOpen\(true\)/);
  assert.match(screen, /platformApi\.listCreatorClicksFeed\(\)/);
});

test('Live Streaming is displayed as Coming Soon only', () => {
  assert.match(screen, /Live Streaming · Coming Soon/);
  assert.doesNotMatch(screen, /getUserMedia|RTCPeerConnection|WebRTC|MediaStream/);
});
