import test from 'node:test';
import assert from 'node:assert/strict';
import { appendEmoji, EMOJI_CATEGORIES, searchEmojiItems } from '../src/index.js';

test('emoji categories expose the complete keyboard category set and a large Unicode catalogue', () => {
  assert.deepEqual(EMOJI_CATEGORIES.map(item => item.id), ['recent','smileys','animals','food','activities','travel','objects','symbols','flags']);
  assert.ok(EMOJI_CATEGORIES.slice(1).every(item => item.emojis.length >= 20));
  const total = EMOJI_CATEGORIES.reduce((count, category) => count + category.emojis.length, 0);
  assert.ok(total >= 700, `Expected at least 700 emoji entries, received ${total}`);
});

test('emoji search matches emoji names and symbols case-insensitively', () => {
  const smileys = EMOJI_CATEGORIES.find(item => item.id === 'smileys').emojis;
  assert.ok(searchEmojiItems(smileys, 'laugh').some(item => item[0] === '😂'));
  assert.ok(searchEmojiItems(smileys, '❤️').some(item => item[0] === '❤️'));
  assert.ok(searchEmojiItems(smileys, 'skin tone').some(item => item[0] === '👍🏽'));
  assert.equal(searchEmojiItems(smileys, 'not-a-real-emoji').length, 0);
});

test('emoji insertion preserves existing composer text and Unicode code points', () => {
  assert.equal(appendEmoji('Hello ', '👨‍👩‍👧‍👦'), 'Hello 👨‍👩‍👧‍👦');
  assert.equal(appendEmoji('', '❤️'), '❤️');
});