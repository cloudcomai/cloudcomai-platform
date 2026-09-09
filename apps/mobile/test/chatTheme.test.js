import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_THEME_IDS, CHAT_THEMES, resolveChatTheme } from '../src/services/chatThemeDefinitions.js';

test('chat theme catalog contains all requested themes', () => {
  assert.deepEqual(CHAT_THEME_IDS, ['system', 'light', 'dark', 'amoled', 'nature', 'ocean', 'sunset', 'royal', 'minimal', 'gradient', 'wallpaper']);
  assert.equal(Object.keys(CHAT_THEMES).length, CHAT_THEME_IDS.length);
  for (const id of CHAT_THEME_IDS) {
    assert.equal(CHAT_THEMES[id].id, id);
    for (const key of ['background', 'header', 'incoming', 'outgoing', 'text', 'secondary', 'accent', 'border', 'composer']) assert.match(CHAT_THEMES[id].colors[key], /^#[0-9a-f]{6}$/i);
  }
});

test('system theme resolves to the device scheme', () => {
  assert.equal(resolveChatTheme({ id: 'system' }, 'dark').id, 'dark');
  assert.equal(resolveChatTheme({ id: 'system' }, 'light').id, 'light');
});

test('invalid theme falls back to system and custom themes resolve directly', () => {
  assert.equal(resolveChatTheme({}, 'light').id, 'light');
  assert.equal(resolveChatTheme({ id: 'not-a-theme' }, 'dark').id, 'dark');
  assert.equal(resolveChatTheme({ id: 'nature' }, 'dark').id, 'nature');
  assert.equal(resolveChatTheme({ id: 'amoled' }, 'light').colors.background, '#000000');
});
