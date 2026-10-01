import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');
const boundary = fs.readFileSync(new URL('../src/components/MessageRenderErrorBoundary.js', import.meta.url), 'utf8');
const media = fs.readFileSync(new URL('../src/components/MediaMessage.js', import.meta.url), 'utf8');

assert.ok(app.includes("import MessageRenderErrorBoundary from './src/components/MessageRenderErrorBoundary';"), 'chat detail must import the per-message render boundary');
assert.ok(app.includes('<MessageRenderErrorBoundary messageId={item.id}>'), 'each rendered message must be isolated from sibling render failures');
assert.ok(app.includes('</MessageRenderErrorBoundary>'), 'per-message render boundary must close around MediaMessage');
assert.ok(boundary.includes('getDerivedStateFromError'), 'message boundary must catch render failures');
assert.ok(boundary.includes('MESSAGE_RENDER_FAILURE'), 'message boundary must emit a sanitized failure event');
assert.ok(boundary.includes('Retry message'), 'message boundary must offer retry');
assert.ok(boundary.includes("['name', 'message']"), 'diagnostics must whitelist safe error fields');
assert.ok(!boundary.includes('token'), 'diagnostics must not reference tokens');
assert.ok(!boundary.includes('password'), 'diagnostics must not reference passwords');
assert.ok(media.includes('Array.isArray(message.poll?.options)'), 'poll rendering must tolerate malformed/non-array option payloads');
assert.ok(media.includes('!Number.isNaN(parseMessageTimestamp(message.poll.expires_at).getTime())'), 'poll rendering must guard invalid expiry timestamps');

console.log('message-render-error-boundary.test.js passed');
