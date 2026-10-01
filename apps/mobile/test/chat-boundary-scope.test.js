import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');

assert.ok(app.includes("import ConversationErrorBoundary from './src/components/ConversationErrorBoundary';"));
assert.ok(app.includes('<ConversationErrorBoundary'), 'ChatDetail must have a dedicated conversation boundary');
assert.ok(app.includes('onBackToChats={() => { setSelectedChat(null); loadChats(false, true); }}'), 'conversation recovery must return to chat list');
assert.ok(app.includes('if (safeItem.type === 'moderation')'), 'moderation messages must also be isolated');
console.log('chat-boundary-scope.test.js passed');

assert.ok(app.includes('function ChatMessageRow('), 'message row rendering must be isolated as a component');
assert.ok(app.includes("const safeItem = item && typeof item === 'object' ? item : { id: 0, type: 'text', body: '' };"), 'message rows must tolerate malformed message payloads');
assert.ok(app.includes('<ChatMessageRow'), 'FlatList must render through the guarded message row');
console.log('chat-message-row-guard.test.js passed');
