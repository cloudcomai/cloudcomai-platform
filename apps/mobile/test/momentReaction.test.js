import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFirstEmojiGrapheme, splitGraphemes } from '../src/utils/momentReaction.js';

test('keeps a ZWJ family emoji as one complete grapheme', () => {
  assert.equal(extractFirstEmojiGrapheme('Great 👨‍👩‍👧‍👦!'), '👨‍👩‍👧‍👦');
});

test('keeps a rainbow flag sequence intact', () => {
  assert.equal(extractFirstEmojiGrapheme('🏳️‍🌈'), '🏳️‍🌈');
});

test('keeps regional-indicator flags intact', () => {
  assert.equal(extractFirstEmojiGrapheme('Visited 🇮🇳 today'), '🇮🇳');
});

test('keeps skin-tone modifiers intact', () => {
  assert.equal(extractFirstEmojiGrapheme('Thanks 👍🏽'), '👍🏽');
});

test('keeps keycap emoji sequences intact', () => {
  assert.equal(extractFirstEmojiGrapheme('Number 1️⃣'), '1️⃣');
});

test('selects the first complete emoji grapheme from a reply', () => {
  assert.equal(extractFirstEmojiGrapheme('Hello ❤️‍🔥 then 😂'), '❤️‍🔥');
});

test('returns no emoji for plain text', () => {
  assert.equal(extractFirstEmojiGrapheme('Nice Moment!'), '');
});

test('splits graphemes without breaking joined emoji', () => {
  assert.deepEqual(splitGraphemes('A👨‍👩‍👧‍👦B'), ['A', '👨‍👩‍👧‍👦', 'B']);
});
