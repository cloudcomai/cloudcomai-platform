import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/components/PublicChatsList.js', import.meta.url), 'utf8');

test('favorites open while public chat room sections are closed by default', () => {
  assert.match(source, /\[publicRoomsOpen, setPublicRoomsOpen\] = useState\(false\)/);
  assert.match(source, /\[languageRoomsOpen, setLanguageRoomsOpen\] = useState\(false\)/);
  assert.match(source, /\[favoritesOpen, setFavoritesOpen\] = useState\(true\)/);
});
