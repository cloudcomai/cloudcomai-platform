import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const canvas = await readFile(new URL('../src/components/ChatCanvas.jsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const inbox = await readFile(new URL('../src/components/NotificationPanel.jsx', import.meta.url), 'utf8');
const api = await readFile(new URL('../../../packages/api-client/src/cloudcomai-api.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

test('web composer limits mentions to group and public chats and submits stable recipient IDs', () => {
  assert.match(canvas, /mentionChatEnabled = selectedChat\?\.type === 'group' \|\| selectedChat\?\.type === 'public'/);
  assert.match(canvas, /action: 'candidates', chat_id: Number\(selectedChat\.id\)/);
  assert.match(canvas, /mentionUsers\.map\(item => Number\(item\.id\)\)/);
  assert.match(app, /mention_user_ids: mentionUserIds/);
  assert.match(app, /mentionUserIds/);
  assert.match(canvas, /message-mention-token/);
});

test('web Mentions inbox opens the authorized original message and includes the candidate API client methods', () => {
  assert.match(inbox, /view === 'mentions'/);
  assert.match(inbox, /action: 'open', mention_id: Number\(item\.mention_id\)/);
  assert.match(inbox, /onOpenChat\?\.\(Number\(item\.chat_id\), Number\(item\.message_id\)\)/);
  assert.match(api, /searchMentionCandidates/);
  assert.match(api, /listMessageMentions/);
  assert.match(api, /openMention/);
  assert.match(styles, /\.mention-suggestions/);
});
