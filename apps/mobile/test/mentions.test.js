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


test('mobile Mentions navigation handles invalid and unavailable message contexts without blanking the chat', () => {
  assert.match(app, /This mention does not contain a valid message reference/);
  assert.match(app, /The original message is unavailable, deleted, expired, or no longer visible/);
  assert.match(app, /onInitialMessageHandled\?\.\(\)/);
  assert.match(app, /if \(!target\) \{/);
  assert.match(app, /throw e;/);
});

test('mobile Mentions inbox removes read entries from the active list while preserving server history', () => {
  assert.match(lists, /filter\(item=>!item\.read_at\)/);
  assert.match(lists, /setMentions\(current=>current\.filter\(entry=>Number\(entry\.mention_id\)!==Number\(item\.mention_id\)\)\)/);
  assert.match(lists, /invalid chat or message reference/);
});


test('mobile Mentions polling cannot reinsert a mention already read in this session', () => {
  assert.match(lists, /dismissedMentionIds = useRef\(new Set\(\)\)/);
  assert.match(lists, /!dismissedMentionIds\.current\.has\(Number\(item\.mention_id\)\)/);
  assert.match(lists, /dismissedMentionIds\.current\.add\(Number\(item\.mention_id\)\)/);
});
