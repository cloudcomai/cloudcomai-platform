import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/PublicChatManagement.js', import.meta.url), 'utf8');

test('online users show real profile image fallback, age and privacy-aware gender', () => {
  assert.match(source, /mediaUrl\('user', item\.id\)/);
  assert.match(source, /item\.age_private \? 'Age: Private'/);
  assert.match(source, /item\.gender_private \? 'Gender: Private'/);
  assert.match(source, /Age: Not set/);
  assert.match(source, /Gender: Not set/);
  assert.match(source, /No users are currently online in this room/);
});

test('friend request action uses authenticated backend and reflects relationship states', () => {
  assert.match(source, /platformApi\.sendFriendRequest\(id\)/);
  assert.match(source, /platformApi\.respondToFriendRequest\(requestId, 'accept'\)/);
  assert.match(source, /Request Sent/);
  assert.match(source, /Respond to Request/);
  assert.match(source, /return 'Friend'/);
  assert.match(source, /relationship\.status === 'accepted'/);
  assert.match(source, /busyUserId/);
  assert.match(source, /Number\(item\.id\) === Number\(user\?\.id\)/);
});

test('manage popup supports stepwise Android and visible back navigation', () => {
  assert.match(source, /BackHandler\.addEventListener\('hardwareBackPress', goBack\)/);
  assert.match(source, /onRequestClose=\{goBack\}/);
  assert.match(source, /if \(screen !== 'menu'\)/);
  assert.match(source, /Leave Chat \/ Leave Room/);
});
