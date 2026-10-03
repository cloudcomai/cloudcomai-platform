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
  const downloadIndex = attachmentActions.indexOf("label={statusLabel(statuses.DOWNLOAD) || 'Download'}");
  const replyIndex = attachmentActions.indexOf('label="Reply"');
  const forwardIndex = attachmentActions.indexOf("label={statusLabel(statuses.FORWARD) || 'Forward'}");
  const saveIndex = attachmentActions.indexOf("label={message.saved ? 'Saved' : 'Save'}");
  const deleteIndex = attachmentActions.indexOf('label="Delete"');
  assert.ok(downloadIndex >= 0, 'Download action must be present');
  assert.ok(replyIndex > downloadIndex, 'Reply must follow Download');
  assert.ok(forwardIndex > replyIndex, 'Forward must follow Reply');
  assert.ok(saveIndex > forwardIndex, 'Save must follow Forward');
  assert.ok(deleteIndex > saveIndex, 'Delete must follow Save');
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

test('text message edit action follows the three-hour two-edit UI policy', () => {
  assert.match(app, /const canEditMessage = message =>/);
  assert.match(app, /Number\(message\?\.edit_count \|\| 0\) >= 2/);
  assert.match(app, /parseEditTimestamp\(message\?\.created_at/);
  assert.match(app, /3 \* 60 \* 60 \* 1000/);
  assert.match(media, /canEdit \? <MessageAction type="edit" label="Edit"/);
  assert.match(media, /accessibilityLabel="Edit message"/);
  assert.match(app, /canEdit=\{item\.type === 'poll' \? canEditPoll\(item\) : canEditMessage\(item\)\}/);
  assert.match(app, /edit_count: Number\(updated\?\.edit_count/);
});


test('edit timestamp parser treats database timestamps as UTC', () => {
  assert.match(app, /const parseEditTimestamp = value =>/);
  assert.match(app, /normalized = raw\.includes\('T'\).*replace\(' ', 'T'\)/s);
  assert.match(app, /const createdAt = parseEditTimestamp\(message\?\.created_at/);
});
