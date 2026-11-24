import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyDesktopTheme,
  DEFAULT_DESKTOP_THEME_ID,
  DESKTOP_THEME_IDS,
  DESKTOP_THEME_STORAGE_KEY,
  getStoredDesktopTheme,
  resolveDesktopTheme,
  saveDesktopTheme,
} from '../src/services/desktopTheme.js';

function withBrowserMocks(run) {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const values = new Map();
  const root = { dataset: {}, style: { colorScheme: '' } };
  globalThis.window = { localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } };
  globalThis.document = { documentElement: root };
  try { return run({ values, root }); }
  finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  }
}

test('web desktop theme exposes only Light, Dark and System Default', () => {
  assert.deepEqual(DESKTOP_THEME_IDS, ['light', 'dark', 'system']);
  assert.equal(DEFAULT_DESKTOP_THEME_ID, 'system');
});

test('invalid and missing desktop themes safely resolve to System Default', () => {
  assert.equal(resolveDesktopTheme('unknown'), 'system');
  withBrowserMocks(() => assert.equal(getStoredDesktopTheme(), 'system'));
});

test('desktop preference uses its own namespaced storage key', () => {
  withBrowserMocks(({ values }) => {
    assert.equal(saveDesktopTheme('dark'), 'dark');
    assert.equal(values.get(DESKTOP_THEME_STORAGE_KEY), 'dark');
    assert.equal(values.has('cloudcomai.app.theme.v2'), false);
  });
});

test('applying a desktop theme changes only the desktop theme attribute', () => {
  withBrowserMocks(({ root }) => {
    root.dataset.appTheme = 'teal-green';
    assert.equal(applyDesktopTheme('light'), 'light');
    assert.equal(root.dataset.desktopTheme, 'light');
    assert.equal(root.dataset.appTheme, 'teal-green');
    assert.equal(root.style.colorScheme, '');
    applyDesktopTheme('system');
    assert.equal(root.dataset.desktopTheme, 'system');
    assert.equal(root.style.colorScheme, '');
  });
});
