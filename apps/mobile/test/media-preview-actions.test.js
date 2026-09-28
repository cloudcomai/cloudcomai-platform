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

test('attachment controls are unified, labeled and selection gated', () => {
  assert.match(media, /function AttachmentApproval\(\{ attachment, message, showActions = false, onForward, onReply, onSave, onDelete, colors = \{\} \}\)/);
  assert.match(media, /showActions \? <View style=\{\[styles\.messageActions/);
  for (const label of ['Download attachment', 'Reply to message', 'Forward attachment', 'Save message', 'Delete message']) {
    assert.ok(media.includes(`accessibilityLabel="${label}"`) || media.includes(`accessibilityLabel={message.saved ? 'Unsave message' : 'Save message'}`), `missing ${label}`);
  }
  assert.match(media, /request\('DOWNLOAD'\)/);
  assert.match(media, /request\('FORWARD'\)/);
  assert.match(media, /if \(nextStatus === 'APPROVED'\)/);
  assert.match(media, /onForward\?\.\(\)/);
  assert.match(media, /messageActions: \{ flexDirection: 'row', flexWrap: 'nowrap'/);
  assert.match(media, /messageActionButton: \{ flex: 1, minWidth: 0/);
});
