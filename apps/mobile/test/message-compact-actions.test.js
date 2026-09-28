import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');
const media = fs.readFileSync(new URL('../src/components/MediaMessage.js', import.meta.url), 'utf8');
const receipt = fs.readFileSync(new URL('../src/components/ReadReceipt.js', import.meta.url), 'utf8');

test('message actions stay hidden until the bubble is selected', () => {
  assert.match(app, /showActions=\{selected\}/);
  assert.match(media, /showActions \? <View style=\{\[styles\.messageActions/);
  assert.match(media, /showActions && Number\(message\.show_profile\)/);
});

test('selected attachment actions match the approved single-row reference', () => {
  const attachmentActions = media.slice(media.indexOf('{showActions ? <View style={[styles.messageActions'));
  const labels = ['Download', 'Reply', 'Forward', 'Delete'];
  let previous = -1;
  for (const label of labels) {
    const index = attachmentActions.indexOf(`label="${label}"`);
    assert.ok(index > previous, `${label} must be present in approved order`);
    previous = index;
  }
  const saveIndex = attachmentActions.indexOf("label={message.saved ? 'Saved' : 'Save'}");
  assert.ok(saveIndex > attachmentActions.indexOf('label="Forward"'), 'Save must follow Forward');
  assert.ok(saveIndex < attachmentActions.indexOf('label="Delete"'), 'Save must precede Delete');
  assert.match(media, /messageActions: \{ flexDirection: 'row', flexWrap: 'nowrap'/);
  assert.match(media, /messageActionButton: \{ flex: 1, minWidth: 0/);
  assert.doesNotMatch(media, /type === 'DOWNLOAD' \? '↓' : '↗'/);
  assert.match(media, /type === 'save'.*bookmarkIcon/);
  assert.match(media, /status === 'PENDING' \? 'Request Pending'/);
  assert.match(media, /statuses\.FORWARD === 'PENDING' \? undefined/);
  assert.match(media, /statuses\.DOWNLOAD === 'PENDING' \? undefined/);
});

test('text messages expose reply forward save delete without download', () => {
  const textBranch = media.slice(media.indexOf('if (!attachment) return'), media.indexOf('return <View>{error && kind'));
  for (const label of ['Reply', 'Forward', 'Delete']) assert.ok(textBranch.includes(`label="${label}"`));
  assert.ok(textBranch.includes("label={message.saved ? 'Saved' : 'Save'}"));
  assert.ok(!textBranch.includes('label="Download"'));
  assert.match(textBranch, /width: mediaWidth, maxWidth: '100%'/);
});

test('read status is compact and only shown for a selected message', () => {
  assert.match(receipt, /showStatus = false/);
  assert.match(receipt, /showStatus && eligible && isSender && readBy\.length/);
  assert.match(receipt, />✓✓<\/Text>/);
  assert.doesNotMatch(receipt, /<Text style=\{styles\.label\}>/);
});
