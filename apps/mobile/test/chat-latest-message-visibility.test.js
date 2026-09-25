import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');

test('latest chat message remains visible above media controls and composer', () => {
  assert.match(source, /messageArea: \{ flex: 1, minHeight: 0 \}/);
  assert.match(source, /messageList: \{ flexGrow: 1, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 18, justifyContent: 'flex-end' \}/);
  assert.match(source, /onLayout=\{\(\) => \{ if \(atBottomRef\.current && !searchActive\) requestAnimationFrame\(\(\) => listRef\.current\?\.scrollToEnd/);
  assert.match(source, /onContentSizeChange=\{\(\) => \{ if \(atBottomRef\.current && !searchActive\) requestAnimationFrame/);
  const listIndex = source.indexOf('<View style={styles.messageArea}>');
  const mediaIndex = source.indexOf('<MediaComposer chat={chat}', listIndex);
  const composerIndex = source.indexOf('<View style={[styles.composer', mediaIndex);
  assert.ok(listIndex >= 0 && mediaIndex > listIndex && composerIndex > mediaIndex);
});
