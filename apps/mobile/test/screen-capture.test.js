import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../App.js', import.meta.url), 'utf8');

test('the whole mobile app enables and releases native screen-capture protection', () => {
  assert.match(appSource, /const appCaptureProtectionKey = 'cloudcomai-app-wide-capture-protection'/);
  assert.match(appSource, /ScreenCapture\.preventScreenCaptureAsync\(appCaptureProtectionKey\)/);
  assert.match(appSource, /ScreenCapture\.allowScreenCaptureAsync\(appCaptureProtectionKey\)/);
});

test('chat screens enable and release native screen-capture protection', () => {
  assert.match(appSource, /ScreenCapture\.preventScreenCaptureAsync\(captureProtectionKey\)/);
  assert.match(appSource, /ScreenCapture\.allowScreenCaptureAsync\(captureProtectionKey\)/);
  assert.match(appSource, /const captureProtectionKey = `chat-\$\{chat\.id\}`/);
});

test('screenshot detection and participant notification remain in place', () => {
  assert.match(appSource, /ScreenCapture\.addScreenshotListener/);
  assert.match(appSource, /platformApi\.reportScreenshot\(chat\.id\)/);
});

