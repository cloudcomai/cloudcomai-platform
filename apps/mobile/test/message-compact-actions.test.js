import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');
const media = fs.readFileSync(new URL('../src/components/MediaMessage.js', import.meta.url), 'utf8');
const receipt = fs.readFileSync(new URL('../src/components/ReadReceipt.js', import.meta.url), 'utf8');

test('message actions stay hidden until the bubble is selected', () => {
  assert.match(app, /showActions=\{selected\}/);
  assert.match(app, /\{selected \? <View style=\{styles\.messageActions\}>/);
  assert.doesNotMatch(media, />↗ Forward<\/Text>/);
  assert.match(media, /showActions && Number\(message\.show_profile\)/);
  assert.match(media, /showActions \? <View style=\{styles\.inlineActions\}>/);
});

test('selected message actions use compact accessible icons instead of large text labels', () => {
  for (const label of ['Save message', 'Reply to message', 'Edit message', 'Delete message', 'Forward message']) {
    assert.ok(app.includes(`accessibilityLabel="${label}"`) || media.includes(`accessibilityLabel="${label}"`), `missing accessible ${label} action`);
  }
  assert.match(app, /messageActionButton: \{ width: 30, height: 30/);
  assert.match(media, /compactAction: \{ width: 30, height: 30/);
});

test('read status is compact and only shown for a selected message', () => {
  assert.match(receipt, /showStatus = false/);
  assert.match(receipt, /showStatus && eligible && isSender && readBy\.length/);
  assert.match(receipt, />✓✓<\/Text>/);
  assert.doesNotMatch(receipt, /<Text style=\{styles\.label\}>/);
});
