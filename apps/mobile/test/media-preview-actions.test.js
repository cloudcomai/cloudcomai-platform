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

test('attachment save and forward controls use labeled touch targets and remain selection gated', () => {
  assert.match(media, /function AttachmentApproval\(\{ attachment, message, showActions = false, onForward, colors = \{\} \}\)/);
  assert.match(media, /if \(!showActions && !senderRequests\.length/);
  assert.match(media, /accessibilityLabel=\{type === 'DOWNLOAD' \? 'Download attachment' : 'Forward attachment'\}/);
  assert.match(media, /type === 'DOWNLOAD' \? '↓' : '↗'/);
  assert.match(media, /type === 'DOWNLOAD' \? 'Download' : 'Forward'/);
  assert.match(media, /if \(nextStatus === 'APPROVED'\)/);
  assert.match(media, /requestType === 'DOWNLOAD'/);
  assert.match(media, /onForward\?\.\(\)/);
  const attachmentBranch = media.slice(media.indexOf('return <View>{error && kind'));
  assert.match(attachmentBranch, /<ForwardMessageModal visible=\{forwardOpen\} message=\{message\} onClose=\{\(\) => setForwardOpen\(false\)\} \/>/);
  assert.match(media, /approvalIconButton: \{ minWidth: 64, minHeight: 48/);
});
