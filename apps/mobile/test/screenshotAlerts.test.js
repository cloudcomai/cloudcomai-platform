import assert from 'node:assert/strict';
import test from 'node:test';
import { filterScreenshotAlerts, isScreenshotAlert } from '../src/utils/screenshotAlerts.js';

test('only screenshot events are eligible for the Alerts inbox', () => {
  assert.equal(isScreenshotAlert({ data: { event: 'screenshot' } }), true);
  assert.equal(isScreenshotAlert({ data: { event: 'message' } }), false);
  assert.equal(isScreenshotAlert({ category: 'message', data: { event: 'message' } }), false);
  assert.equal(isScreenshotAlert({ category: 'attachment', data: { event: 'download_request' } }), false);
});

test('filters regular activity out of screenshot alerts', () => {
  const screenshot = { id: 1, data: { event: 'screenshot' } };
  const notifications = [
    screenshot,
    { id: 2, category: 'message', data: { event: 'message' } },
    { id: 3, category: 'system', data: { event: 'friend_request' } },
    { id: 4, category: 'attachment', data: { event: 'download_request' } },
  ];
  assert.deepEqual(filterScreenshotAlerts(notifications), [screenshot]);
});

 test('missing notification data is never treated as a screenshot alert', () => {
  assert.deepEqual(filterScreenshotAlerts([null, {}, { category: 'system' }]), []);
});
