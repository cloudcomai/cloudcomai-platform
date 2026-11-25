import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');

test('individual mobile chat header renders the other participant avatar only', () => {
  assert.match(app, /!chat\.isGroup && !chat\.isPublic && chat\.other_user_id/);
  assert.match(app, /userId=\{chat\.other_user_id\}/);
  assert.match(app, /mediaUrl\('user', chat\.other_user_id/);
  assert.match(app, /key=\{String\(chat\.other_user_id\)\}/);
});

test('individual chat header avatar uses responsive 36dp and 32dp sizing', () => {
  assert.match(app, /windowWidth < 360 \? 32 : 36/);
  assert.match(app, /size=\{headerAvatarSize\}/);
  assert.match(app, /chatHeaderIdentityRow: \{[^}]*gap: 8/s);
});

test('existing profile action and notification/delete controls remain in the header', () => {
  assert.match(app, /onPress=\{\(\) => setProfileOpen\(true\)\}/);
  assert.match(app, /updateChatNotificationState\(chat\.id/);
  assert.match(app, /onPress=\{confirmDelete\}/);
});

test('avatar change is contained in the mobile application entry point', () => {
  assert.match(app, /from '\.\/src\/components\/ContactAvatar'/);
  assert.doesNotMatch(app, /apps\/web/);
});
