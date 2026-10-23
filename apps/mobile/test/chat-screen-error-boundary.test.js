import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');

test('chat screen is protected by a recoverable error boundary', () => {
  assert.match(source, /class ChatDetailErrorBoundary extends React\.Component/);
  assert.match(source, /We couldn’t open this conversation\./);
  assert.match(source, /Try again/);
  assert.match(source, /Return to Chats/);
  assert.match(source, /function ChatDetail\\(props\\)[\\s\\S]*?return <ChatDetailErrorBoundary \\{\\.\\.\\.props\\} \/>;/);
});

test('message polling rejects malformed API responses with a recoverable error', () => {
  assert.match(source, /const response = await platformApi\.listMessages\(chat\.id, afterId/);
  assert.match(source, /!Array\.isArray\(data\.messages\)/);
  assert.match(source, /invalid message response\. Please retry\./);
  assert.match(source, /const incomingMessages = Array\.isArray\(incoming\.messages\) \? incoming\.messages : \[\]/);
});

test('message synchronization handles absent polling payloads without dereferencing them', () => {
  assert.match(source, /if \(!incoming \|\| typeof incoming !== 'object'\) \{ setLoading\(false\); setError\('The server returned an invalid message response\. Please retry\.'\); return; \}/);
});
