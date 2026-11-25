import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const store = fs.readFileSync(new URL('../src/hooks/useMessagingStore.js', import.meta.url), 'utf8');
const messagingCore = fs.readFileSync(new URL('../../../packages/chat-core/src/messaging-store.js', import.meta.url), 'utf8');

test('messaging persistence uses URI-based legacy FileSystem calls, not shared File objects', () => {
  assert.match(store, /from 'expo-file-system\/legacy'/);
  assert.match(store, /FileSystem\.getInfoAsync\(uri\)/);
  assert.match(store, /FileSystem\.readAsStringAsync\(uri\)/);
  assert.match(store, /FileSystem\.writeAsStringAsync\(fileUri, value\)/);
  assert.doesNotMatch(store, /new File\s*\(/);
  assert.doesNotMatch(store, /\.text\s*\(/);
});

test('messaging persistence retains account-scoped primary and backup files', () => {
  assert.match(messagingCore, /cloudcomai\.messages\.\$\{userId\}/);
  assert.match(store, /storageFileUri\(key, '\.backup\.json'\)/);
  assert.match(store, /if \(value === null\) return readStoredValue\(backupUri\)/);
  assert.match(store, /if \(backup !== null\) return backup/);
});

test('messaging storage serializes read-modify-write operations per account key', () => {
  assert.match(store, /async withLock\(key, operation\)/);
  assert.match(store, /storageLocks\.get\(lockKey\)/);
  assert.match(store, /await operation\(\)/);
});
