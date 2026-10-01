import assert from 'node:assert/strict';
import fs from 'node:fs';

const boundary = fs.readFileSync(new URL('../src/components/ConversationErrorBoundary.js', import.meta.url), 'utf8');
const entry = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');

assert.ok(boundary.includes('getDerivedStateFromError'), 'conversation boundary must catch render errors');
assert.ok(boundary.includes('CHAT_RENDER_FAILURE'), 'conversation boundary must emit a lifecycle failure event');
assert.ok(boundary.includes('Retry'), 'conversation failure state must offer Retry');
assert.ok(boundary.includes('Back to Chats'), 'conversation failure state must offer Back to Chats');
assert.ok(boundary.includes('BackHandler.addEventListener'), 'conversation failure state must keep Android Back available');
assert.ok(boundary.includes('backSubscription?.remove'), 'conversation boundary must clean up Android Back');
assert.ok(boundary.includes("['name', 'message']"), 'diagnostic logging must whitelist safe error fields');
assert.ok(!boundary.includes('token'), 'diagnostic logging must not reference authentication tokens');
assert.ok(!boundary.includes('password'), 'diagnostic logging must not reference passwords');
assert.ok(entry.includes("import ConversationErrorBoundary from './src/components/ConversationErrorBoundary'"), 'mobile entry must import the boundary');
assert.ok(entry.includes('<ConversationErrorBoundary>'), 'mobile entry must wrap the application with the boundary');

console.log('conversation-error-boundary.test.js passed');
