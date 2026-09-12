import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, '../src/components/PublicChatsList.js'), 'utf8');
const api = fs.readFileSync(path.join(here, '../../../packages/api-client/src/cloudcomai-api.js'), 'utf8');
const contract = JSON.parse(fs.readFileSync(path.join(here, '../../../backend/api-contract.json'), 'utf8'));
const handler = fs.readFileSync(path.join(here, '../../../backend/api/public_chats.php'), 'utf8');

test('public chat directory exposes a leave-room action', () => {
  assert.match(component, /leaveRoom\s*=\s*room\s*=>/);
  assert.match(component, /platformApi\.leavePublicChat\(Number\(room\.id\)\)/);
  assert.match(component, /Leave room/);
  assert.match(component, /style:\s*'destructive'/);
});

test('mobile API client and backend contract expose public chat leave', () => {
  assert.match(api, /leavePublicChat\(roomId, options = \{\}\)/);
  assert.match(api, /ApiRoute\.PUBLIC_CHATS/);
  assert.equal(contract.routes['v1/public-chats'].handler, 'public_chats.php');
  assert.ok(contract.routes['v1/public-chats'].methods.includes('DELETE'));
  assert.match(handler, /\$method === 'DELETE'/);
  assert.match(handler, /status='left'/);
});
