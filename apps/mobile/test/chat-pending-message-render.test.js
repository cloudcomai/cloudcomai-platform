import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');
const start = app.indexOf('localMessages?.outbox?.some');
const end = app.indexOf('<MediaComposer', start);

assert.ok(start >= 0, 'pending-message outbox UI must exist');
assert.ok(end > start, 'pending-message outbox UI must end before MediaComposer');

const pendingUi = app.slice(start, end);
assert.ok(pendingUi.includes('Retry'), 'pending messages should keep Retry action');
assert.ok(pendingUi.includes('Discard'), 'pending messages should keep Discard action');
assert.ok(!pendingUi.includes('messageColors.'), 'pending-message UI must not reference renderItem-scoped messageColors');
assert.ok(pendingUi.includes('theme.colors.text'), 'pending-message actions should use the chat theme color');

console.log('chat-pending-message-render.test.js passed');
