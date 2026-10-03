import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const media = fs.readFileSync(new URL('../src/components/MediaMessage.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');

test('mobile poll editing exposes creator-only edit flow with two-edit eligibility', () => {
  assert.match(media, /message\.type === 'poll'/);
  assert.match(media, /query: \{ action: 'edit' \}/);
  assert.match(media, /Edit Poll/);
  assert.match(media, /2 to 4 different options/);
  assert.match(media, /const normalizePollExpiry = value =>/);
  assert.match(media, /const expiresAt = normalizePollExpiry\(pollEditExpiry\)/);
  assert.match(media, /Choose expiry date/);
  assert.match(media, /pollCalendarOpen/);
  assert.match(media, /calendarDays/);
  assert.match(media, /pollEditError/);
  assert.match(media, /accessibilityRole="alert"/);
  assert.match(app, /const canEditPoll = message =>/);
  assert.match(app, /message\?\.type !== 'poll'/);
  assert.match(app, /Number\(message\?\.edit_count \|\| 0\) >= 2/);
});
