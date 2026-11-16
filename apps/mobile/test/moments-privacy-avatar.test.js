import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const screen = fs.readFileSync(new URL('../src/components/MomentsScreen.js', import.meta.url), 'utf8');

test('Moments privacy contact rows render the existing authenticated circular avatar before the name', () => {
  assert.match(screen, /<MomentAuthorAvatar userId=\{id\} name=\{contact\.display_name \|\| contact\.registered_name \|\| 'Contact'\} size=\{38\} token=\{token\} \/>/);
  assert.match(screen, /privacyContactCopy:[^\n]*flex: 1, minWidth: 0/);
});

test('Moments privacy contact rows retain the existing checkbox and username display', () => {
  assert.match(screen, /<Text style=\{styles\.checkMark\}>\{selected \? '☑' : '□'\}<\/Text>[\s\S]*?<MomentAuthorAvatar[\s\S]*?<Text style=\{styles\.checkLabel\}>\{contact\.display_name \|\| contact\.registered_name \|\| 'Contact'\}<\/Text>[\s\S]*?<Text style=\{styles\.muted\}>@\{contact\.registered_user_id_text \|\| id\}<\/Text>/);
  assert.match(screen, /onPress=\{\(\) => toggleId\(hiddenIds, setHiddenIds, id\)\}/);
});

test('Moments privacy still saves the same hidden contact IDs through the existing API', () => {
  assert.match(screen, /await platformApi\.updateStoryPrivacy\(hiddenIds\)/);
  assert.match(screen, /setHiddenIds\(\(privacyResponse\?\.data\?\.hidden_user_ids \|\| \[\]\)\.map\(Number\)\)/);
});
