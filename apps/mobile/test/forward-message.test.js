import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const modal = fs.readFileSync(path.join(here, '../src/components/ForwardMessageModal.js'), 'utf8');
const media = fs.readFileSync(path.join(here, '../src/components/MediaMessage.js'), 'utf8');
const api = fs.readFileSync(path.join(here, '../../../packages/api-client/src/cloudcomai-api.js'), 'utf8');
const endpoints = fs.readFileSync(path.join(here, '../../../packages/api-client/src/endpoints.js'), 'utf8');
const contract = JSON.parse(fs.readFileSync(path.join(here, '../../../backend/api-contract.json'), 'utf8'));
const handler = fs.readFileSync(path.join(here, '../../../backend/api/forward_message.php'), 'utf8');

test('mobile forward flow supports search, multi-select and confirmation', () => {
  assert.match(modal, /Search contacts or chats/);
  assert.match(modal, /selected\.map\(chat => Number\(chat\.id\)\)/);
  assert.match(modal, />Forward<\/Text>/);
  assert.match(media, /ForwardMessageModal/);
  assert.match(media, /forwarded_text/);
  assert.match(media, /Forwarded/);
});

test('forward API is registered and only forwards visible text messages', () => {
  assert.match(endpoints, /FORWARD_MESSAGE: 'v1\/messages\/forward'/);
  assert.match(api, /forwardMessage\(messageId, chatIds, options = \{\}\)/);
  assert.equal(contract.routes['v1/messages/forward'].handler, 'forward_message.php');
  assert.ok(contract.routes['v1/messages/forward'].methods.includes('POST'));
  assert.match(handler, /\['text', 'forwarded_text'\]/);
  assert.match(handler, /assert_visible_message/);
  assert.match(handler, /c\.type IN \("private","group"\)/);
  assert.match(handler, /type,body,reply_to_message_id,expires_at,created_at/);
  assert.match(handler, /forwarded_text/);
  assert.match(handler, /create_chat_notifications/);
});
