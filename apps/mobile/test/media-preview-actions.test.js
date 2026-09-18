import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const media = fs.readFileSync(new URL('../src/components/MediaMessage.js', import.meta.url), 'utf8');

test('image attachments can open in a full-screen contain viewer', () => {
  assert.match(media, /accessibilityLabel="Open image full screen"/);
  assert.match(media, /presentationStyle="fullScreen"/);
  assert.match(media, /style=\{styles\.fullscreenImage\} resizeMode="contain"/);
  assert.match(media, /accessibilityLabel="Close image"/);
});

test('attachment save and forward controls are compact icons and selection gated', () => {
  assert.match(media, /function AttachmentApproval\(\{ attachment, showActions = false \}\)/);
  assert.match(media, /if \(!showActions && !senderRequests\.length/);
  assert.match(media, /accessibilityLabel=\{type === 'DOWNLOAD' \? 'Request save or download' : 'Request forward'\}/);
  assert.match(media, /type === 'DOWNLOAD' \? '⇩' : '↗'/);
  assert.doesNotMatch(media, />Save \/ Download<\/Text>/);
  assert.doesNotMatch(media, />Forward<\/Text>/);
  assert.match(media, /approvalIconButton: \{ width: 30, height: 30/);
});
