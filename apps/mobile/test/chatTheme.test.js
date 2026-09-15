import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_THEME_IDS, CHAT_THEMES, resolveChatTheme, readableMessageColor } from '../src/services/chatThemeDefinitions.js';

const relativeLuminance = hex => {
  const rgb = hex.slice(1).match(/.{2}/g).map(pair => parseInt(pair, 16) / 255).map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
};

const contrastRatio = (first, second) => {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

test('custom bubble colors retain readable message text', () => {
  for (const background of ['#000000', '#ffffff', '#3157d5', '#ffff00', '#ff1493', '#777777']) {
    for (const preferred of ['#172033', '#f8fafc']) {
      assert.ok(contrastRatio(background, readableMessageColor(background, preferred)) >= 4.5);
    }
  }
  assert.equal(readableMessageColor('#ffffff', '#172033'), '#172033');
});

test('chat theme catalog contains all requested themes', () => {
  assert.deepEqual(CHAT_THEME_IDS, ['system', 'light', 'dark', 'amoled', 'nature', 'ocean', 'sunset', 'royal', 'minimal', 'gradient', 'romance', 'wallpaper']);
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

test('light-theme message surfaces keep readable text contrast', () => {
  for (const id of ['system', 'light', 'nature', 'ocean', 'sunset', 'royal', 'minimal', 'gradient', 'romance']) {
    const theme = CHAT_THEMES[id];
    assert.ok(contrastRatio(theme.colors.outgoing, theme.colors.text) >= 4.5, `${id} outgoing text contrast is below WCAG AA`);
    assert.ok(contrastRatio(theme.colors.incoming, theme.colors.text) >= 4.5, `${id} incoming text contrast is below WCAG AA`);
  }
});

test('dark-theme message surfaces keep readable text contrast', () => {
  for (const id of ['dark', 'amoled', 'wallpaper']) {
    const theme = CHAT_THEMES[id];
    assert.ok(contrastRatio(theme.colors.outgoing, theme.colors.text) >= 4.5, `${id} outgoing text contrast is below WCAG AA`);
    assert.ok(contrastRatio(theme.colors.incoming, theme.colors.text) >= 4.5, `${id} incoming text contrast is below WCAG AA`);
  }
});
