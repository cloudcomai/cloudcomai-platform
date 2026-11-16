import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const screen = fs.readFileSync(new URL('../src/components/MomentsScreen.js', import.meta.url), 'utf8');
const avatar = fs.readFileSync(new URL('../src/components/ContactAvatar.js', import.meta.url), 'utf8');
const contactMatching = fs.readFileSync(new URL('../../../backend/lib/contact_matching.php', import.meta.url), 'utf8');
const storyAccess = fs.readFileSync(new URL('../../../backend/lib/story_access.php', import.meta.url), 'utf8');
const storiesApi = fs.readFileSync(new URL('../../../backend/api/stories.php', import.meta.url), 'utf8');

test('Moments privacy rows use the shared contact avatar and profile media URL in both privacy views', () => {
  assert.match(screen, /import ContactAvatar from '\.\/ContactAvatar'/);
  assert.match(screen, /import \{ API_BASE_URL, mediaUrl, platformApi, sessionManager, uploadMobileFile \} from '\.\.\/services\/platform'/);
  assert.equal((screen.match(/<ContactAvatar userId=\{id\} name=\{name\} username=\{contact\.registered_user_id_text\} imageUri=\{mediaUrl\('user', id, contact\.image_version \|\| contact\.photo_version \|\| ''\)\} size=\{38\} \/>/g) || []).length, 2);
  assert.match(avatar, /showImage/);
  assert.match(avatar, /onError=\{\(\) => setFailedUri\(imageUri\)\}/);
  assert.match(contactMatching, /'image_version' => contact_profile_image_version\(\$id\)/);
  assert.match(contactMatching, /filemtime\(\$path\)[\s\S]*?filesize\(\$path\)/);
});

test('Moments privacy selection contains only registered accounts from the saved contacts API', () => {
  assert.match(screen, /platformApi\.listContacts\(1, 500\)/);
  assert.match(screen, /setContacts\(contactResponse\?\.data\?\.contacts \|\| \[\]\)/);
  assert.match(screen, /filter\(contact => Number\(contact\.registered_user_id\) > 0\)/);
  assert.doesNotMatch(screen, /Number\(contact\.registered_user_id \|\| contact\.id\)/);
  assert.match(screen, /toggleId\(hiddenIds, setHiddenIds, id\)/);
  assert.match(screen, /await platformApi\.updateStoryPrivacy\(hiddenIds\)/);
});

test('Contact-based Moments do not grant access based only on a private chat', () => {
  assert.match(storyAccess, /function story_contact_relationship/);
  assert.match(storyAccess, /friend_requests WHERE status="accepted"/);
  assert.match(storyAccess, /google_contacts gc/);
  assert.match(storyAccess, /phone_contacts pc/);
  assert.doesNotMatch(storyAccess, /WHERE c\.type="private"/);
});

test('Group Moments require both the owner and viewer to remain active members', () => {
  assert.match(storyAccess, /audience === 'groups'/);
  assert.match(storyAccess, /viewer\.status="active"/);
  assert.match(storyAccess, /owner_member\.status="active"/);
  assert.match(storyAccess, /c\.type="group"/);
});

test('New Moments cannot be published to a public audience and public legacy stories are not exposed', () => {
  assert.match(storiesApi, /\['contacts', 'groups', 'friends'\]/);
  assert.doesNotMatch(storiesApi, /\['contacts', 'groups', 'friends', 'public'\]/);
  assert.doesNotMatch(storyAccess, /audience === 'public'\) return true/);
  assert.match(storyAccess, /audience === 'contacts'.*story_contact_relationship/);
});

test('Moments privacy still preserves hidden-contact exclusions', () => {
  assert.match(storyAccess, /user_story_hidden_contacts WHERE user_id=\? AND hidden_user_id=\?/);
  assert.match(screen, /setHiddenIds\(\(privacyResponse\?\.data\?\.hidden_user_ids \|\| \[\]\)\.map\(Number\)\)/);
});
