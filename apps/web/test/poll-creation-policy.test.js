import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const modal = fs.readFileSync(new URL('../src/components/PollModal.jsx', import.meta.url), 'utf8');
const backend = fs.readFileSync(new URL('../../../backend/api/polls.php', import.meta.url), 'utf8');
const canvas = fs.readFileSync(new URL('../src/components/ChatCanvas.jsx', import.meta.url), 'utf8');
const mobileMenu = fs.readFileSync(new URL('../../mobile/src/components/MobileMenu.js', import.meta.url), 'utf8');

test('poll creation allows only group/public chats and 2-4 options', () => {
  assert.match(modal, /chatType === 'group' \|\| chatType === 'public'/);
  assert.doesNotMatch(modal, /selectedChat\.isGroup \|\|/);
  assert.match(canvas, /const isPollChat = selectedChat\?\.type === 'group' \|\| selectedChat\?\.type === 'public'/);
  assert.match(canvas, /\{isPollChat && <button className="action-utility-btn"/);
  assert.match(mobileMenu, /listChats\('group'\).*listChats\('public'\)/s);
  assert.doesNotMatch(mobileMenu, /loadPollConversations[\s\S]*listChats\('private'\)/);
  assert.match(modal, /options\.length >= 4/);
  assert.match(modal, /cleanOptions\.length < 2 \|\| cleanOptions\.length > 4/);
  assert.match(modal, /2 to 4 different options/);
  assert.match(backend, /in_array\(\$chatRow\['type'\], \['group', 'public'\], true\)/);
  assert.match(backend, /count\(\$cleanOptions\) < 2 \|\| count\(\$cleanOptions\) > 4/);
});
