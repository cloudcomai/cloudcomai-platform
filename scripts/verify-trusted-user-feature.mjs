import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const migration = read('backend/database/migrations/023_trusted_users.sql');
const trustedApi = read('backend/api/trusted_user.php');
const attachmentApi = read('backend/api/attachment.php');
const requestApi = read('backend/api/request_attachment_download.php');
const profileApi = read('backend/api/user_profile.php');
const payload = read('backend/lib/message_payload.php');
const profileUi = read('apps/mobile/src/components/UserProfileModal.js');
const contract = JSON.parse(read('backend/api-contract.json'));
const clientApi = read('packages/api-client/src/cloudcomai-api.js');
const endpoints = read('packages/api-client/src/endpoints.js');

assert.match(migration, /PRIMARY KEY \(owner_user_id, trusted_user_id\)/);
assert.match(migration, /owner_user_id <> trusted_user_id/);
assert.match(migration, /updated_at DATETIME NOT NULL/);
assert.equal(contract.routes['v1/users/trusted-user'].handler, 'trusted_user.php');
assert.deepEqual(contract.routes['v1/users/trusted-user'].methods.sort(), ['DELETE', 'GET', 'POST', 'PUT']);

assert.match(trustedApi, /\$viewer = auth_user\(\)/);
assert.match(trustedApi, /INSERT INTO trusted_users\(owner_user_id,trusted_user_id/);
assert.match(trustedApi, /users_block_state\(\(int\)\$viewer\['id'\], \$targetUserId\)/);
assert.doesNotMatch(trustedApi, /\$d\[['"]isTrusted['"]\]/i);

// Direction is sender -> recipient. The authenticated receiver must NOT be
// able to grant themselves approval-free access by trusting the sender.
assert.match(attachmentApi, /is_trusted_user\(\(int\)\$a\['sender_id'\], \(int\)\$user\['id'\]\)/);
assert.match(requestApi, /is_trusted_user\(\(int\)\$a\['sender_id'\], \(int\)\$user\['id'\]\)/);
assert.match(payload, /is_trusted_user\(\(int\)\$message\['sender_id'\], \(int\)\$viewer\['id'\]\)/);
assert.doesNotMatch(attachmentApi, /is_trusted_user\(\(int\)\$user\['id'\], \(int\)\$a\['sender_id'\]\)/);
assert.doesNotMatch(requestApi, /is_trusted_user\(\(int\)\$user\['id'\], \(int\)\$a\['sender_id'\]\)/);
assert.doesNotMatch(payload, /is_trusted_user\(\(int\)\$viewer\['id'\], \(int\)\$message\['sender_id'\]\)/);
const bypassIndex = requestApi.indexOf("out(['status'=>'APPROVED'");
const insertIndex = requestApi.indexOf('INSERT INTO attachment_download_requests');
assert.ok(bypassIndex > -1 && bypassIndex < insertIndex, 'trusted bypass must happen before approval request creation');
const notificationIndex = requestApi.indexOf('queue_user_notification');
assert.ok(notificationIndex > insertIndex, 'approval notification must only be queued after a real request is created');

assert.match(profileApi, /'trusted_user' => !\$self && is_trusted_user/);
assert.match(profileUi, /Trusted User/);
assert.match(profileUi, /Allow this user to receive, download, save, and forward attachments you send without approval/);
assert.match(profileUi, /Enable Trusted User\?/);
assert.match(profileUi, /You will allow \{name\} to receive, download, save and forward attachments you send without approval/);
assert.match(profileUi, /You can turn this off anytime from their profile/);
assert.match(profileUi, />Cancel<\/Text>/);
assert.match(profileUi, />Enable<\/Text>/);
assert.match(profileUi, /trustBackdrop/);
assert.doesNotMatch(profileUi, /Alert\.alert\('Trust this user\?'/);
assert.match(endpoints, /TRUSTED_USER: 'v1\/users\/trusted-user'/);
assert.match(clientApi, /trustUser\(userId/);
assert.match(clientApi, /untrustUser\(userId/);
assert.match(profileUi, /platformApi\.trustUser\(profile\.id\)/);
assert.match(profileUi, /platformApi\.untrustUser\(profile\.id\)/);
assert.doesNotMatch(profileUi, /platformApi\.(post|delete)\(/);
assert.match(payload, /sender_trusted/);
assert.match(payload, /download_policy' => \$trustedSender \? 'ALLOW'/);

console.log('Trusted User feature checks: PASS');
