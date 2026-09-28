import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');

test('chat shows a themed scroll-to-latest control only after the user scrolls up', () => {
  assert.match(source, /const \[showScrollToBottom, setShowScrollToBottom\] = useState\(false\)/);
  assert.match(source, /setShowScrollToBottom\(!searchActive && distanceFromBottom > 160\)/);
  assert.match(source, /accessibilityLabel="Scroll to latest message"/);
  assert.match(source, /listRef\.current\?\.scrollToEnd\?\.\(\{ animated: true \}\)/);
  assert.match(source, /backgroundColor: theme\.colors\.composer/);
  assert.match(source, /color: theme\.colors\.iconPrimary \|\| theme\.colors\.accent/);
  assert.match(source, /scrollToBottomButton: \{ position: 'absolute', right: 14, bottom: 12, width: 38, height: 38/);
});
