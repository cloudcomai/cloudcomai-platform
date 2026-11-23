import assert from 'node:assert/strict';
import test from 'node:test';
import { APP_THEME_IDS, APP_THEMES, DEFAULT_APP_THEME_ID, applyAppTheme, resolveAppTheme } from '../src/services/appTheme.js';

test('web exposes four complete themes in product order', () => {
  assert.deepEqual(APP_THEME_IDS, ['modern-blue', 'teal-green', 'purple-accent', 'midnight']);
  assert.equal(DEFAULT_APP_THEME_ID, 'modern-blue');
});

test('every web theme defines the full contrast token set', () => {
  const required = ['primary','primaryDark','primaryLight','background','surface','surfaceSecondary','textPrimary','textSecondary','textMuted','textOnPrimary','placeholder','disabled','border','divider','incomingBubble','incomingBubbleText','outgoingBubble','outgoingBubbleText','success','warning','error','iconPrimary','iconSecondary','headerBackground','headerText','navigationBackground','navigationText','navigationActive','modalBackground','modalText','accent','highlight'];
  for (const theme of Object.values(APP_THEMES)) for (const key of required) assert.ok(theme.colors[key], `${theme.id} is missing ${key}`);
});

test('unknown web theme resolves to CloudCom Blue', () => assert.equal(resolveAppTheme('unknown').id, DEFAULT_APP_THEME_ID));

test('applying each palette updates the legacy web CSS tokens used by screens', () => {
  const previousDocument = globalThis.document;
  const values = new Map();
  const root = { dataset: {}, style: { colorScheme: '', setProperty: (name, value) => values.set(name, value) } };
  globalThis.document = { documentElement: root };
  try {
    for (const theme of Object.values(APP_THEMES)) {
      values.clear();
      applyAppTheme(theme.id);
      assert.equal(root.dataset.appTheme, theme.id);
      assert.equal(root.style.colorScheme, theme.id === 'midnight' ? 'dark' : 'light');
      assert.equal(values.get('--bg-primary'), theme.colors.surface);
      assert.equal(values.get('--bg-directory'), theme.colors.surfaceSecondary);
      assert.equal(values.get('--bg-canvas'), theme.colors.background);
      assert.equal(values.get('--text-main'), theme.colors.textPrimary);
      assert.equal(values.get('--primary-color'), theme.colors.primary);
      assert.equal(values.get('--border-color'), theme.colors.border);
      assert.equal(values.get('--bubble-outgoing'), theme.colors.outgoingBubble);
      assert.equal(values.get('--bubble-incoming'), theme.colors.incomingBubble);
    }
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});


test('Midnight theme keeps outgoing message text readable on its blue bubble', () => {
  assert.equal(APP_THEMES.midnight.colors.primary, '#2366A8');
  assert.equal(APP_THEMES.midnight.colors.outgoingBubble, '#2366A8');
  assert.equal(APP_THEMES.midnight.colors.outgoingBubbleText, '#FFFFFF');
  assert.equal(APP_THEMES.midnight.colors.textPrimary, '#F3F7FC');
});
