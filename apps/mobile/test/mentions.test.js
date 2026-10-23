import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../App.js', import.meta.url), 'utf8');
const lists = await readFile(new URL('../src/components/MobileDashboardLists.js', import.meta.url), 'utf8');
const media = await readFile(new URL('../src/components/MediaMessage.js', import.meta.url), 'utf8');
const api = await readFile(new URL('../../../packages/api-client/src/cloudcomai-api.js', import.meta.url), 'utf8');

test('mobile composer limits mentions to group/public rooms and submits stable recipient IDs', () => {
  assert.match(app, /mentionChatEnabled = Boolean\(chat\?\.isGroup \|\| chat\?\.type === 'group' \|\| chat\?\.type === 'public'/);
  assert.match(app, /searchMentionCandidates\(Number\(chat\.id\), mentionQuery\)/);
  assert.match(app, /mention_user_ids: mentionUsers\.map\(item => Number\(item\.id\)\)/);
  assert.match(media, /renderMentionText/);
});

test('mobile Mentions inbox opens the original message and navigates to its context', () => {
  assert.match(lists, /tab==='mentions'/);
  assert.match(lists, /platformApi\.openMention\(Number\(item\.mention_id\)\)/);
  assert.match(lists, /onOpenChat\?\.\(Number\(item\.chat_id\),Number\(item\.message_id\)\)/);
  assert.match(app, /initialMessageId=\{pendingMentionMessageId\}/);
  assert.match(app, /navigateToMessage\(initialMessageId\)/);
  assert.match(api, /listMessageMentions/);
});
