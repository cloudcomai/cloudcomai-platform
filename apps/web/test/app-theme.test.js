import assert from 'node:assert/strict';
import test from 'node:test';
import { APP_THEME_IDS, APP_THEMES, DEFAULT_APP_THEME_ID, resolveAppTheme } from '../src/services/appTheme.js';

test('web exposes four complete themes in product order', () => {
  assert.deepEqual(APP_THEME_IDS, ['modern-blue', 'teal-green', 'purple-accent', 'midnight']);
  assert.equal(DEFAULT_APP_THEME_ID, 'modern-blue');
});

test('every web theme defines the full contrast token set', () => {
  const required = ['primary','primaryDark','primaryLight','background','surface','surfaceSecondary','textPrimary','textSecondary','textMuted','textOnPrimary','placeholder','disabled','border','divider','incomingBubble','incomingBubbleText','outgoingBubble','outgoingBubbleText','success','warning','error','iconPrimary','iconSecondary','headerBackground','headerText','navigationBackground','navigationText','navigationActive','modalBackground','modalText','accent','highlight'];
  for (const theme of Object.values(APP_THEMES)) for (const key of required) assert.ok(theme.colors[key], `${theme.id} is missing ${key}`);
});

test('unknown web theme resolves to CloudCom Blue', () => assert.equal(resolveAppTheme('unknown').id, DEFAULT_APP_THEME_ID));
