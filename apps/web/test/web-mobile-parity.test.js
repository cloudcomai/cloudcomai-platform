import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const canvas = await readFile(new URL('../src/components/ChatCanvas.jsx', import.meta.url), 'utf8');
const parity = await readFile(new URL('../src/components/WebMobileParity.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

test('web exposes mobile message actions', () => {
  assert.match(canvas, /ForwardMessageDialog/);
  assert.match(canvas, /MessageReadStatusDialog/);
  assert.match(canvas, /aria-label="Forward message"/);
  assert.match(canvas, /aria-label="Message info"/);
  assert.match(parity, /platformApi\.forwardMessage/);
  assert.match(parity, /platformApi\.getMessageReadStatus/);
});

test('web exposes mobile profile and friend relationship flow', () => {
  assert.match(canvas, /UserProfileDialog/);
  assert.match(parity, /platformApi\.getUserProfile/);
  assert.match(parity, /platformApi\.getFriendRelationship/);
  assert.match(parity, /platformApi\.sendFriendRequest/);
});

test('web supports per-chat themes like mobile', () => {
  assert.match(canvas, /ChatThemeControl/);
  assert.match(parity, /cloudcomai\.web\.chat-theme/);
  for (const theme of ['ocean','forest','sunset','midnight']) assert.match(styles, new RegExp(`data-chat-theme="${theme}"`));
});
