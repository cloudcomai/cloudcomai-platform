import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const platformSource = await readFile(new URL('../src/services/platform.js', import.meta.url), 'utf8');
const ringBellsSource = await readFile(new URL('../src/components/RingBellsStatus.js', import.meta.url), 'utf8');
const composerSource = await readFile(new URL('../src/components/MediaComposer.js', import.meta.url), 'utf8');


test('profile and group image uploads use Expo File multipart parts to avoid unsupported FormDataPart errors', () => {
  assert.match(platformSource, /appendExpoFilePart/);
  assert.match(platformSource, /multipartPartMode:\s*'expo-file'/);
  assert.match(platformSource, /maxBytes:\s*12\s*\*\s*1024\s*\*\s*1024/);
});


test('chat attachment uploads use Expo File multipart parts instead of unsupported legacy FormData objects', () => {
  const attachmentUpload = platformSource.match(/export const uploadAttachmentAsset=[^\n]+/)?.[0] || '';
  assert.match(attachmentUpload, /multipartPartMode:\s*'expo-file'/);
  assert.match(attachmentUpload, /ApiRoute\.UPLOAD_ATTACHMENT/);
});

test('mobile uploads use native FormData file parts for Android content/file URIs', () => {
  assert.match(platformSource, /new FormDataCtor\(\)/);
  assert.match(platformSource, /isNativeFileUri\s*=\s*uri\s*=>\s*\/\^\(content\|file\)/);
  assert.match(platformSource, /form\.append\(fieldName,\s*\{\s*uri:\s*normalized\.uri,\s*name:\s*normalized\.name,\s*type:\s*normalized\.mimeType\s*\}\)/);
  assert.match(platformSource, /body:\s*formData/);
  assert.doesNotMatch(platformSource, /UploadType\.MULTIPART/);
});

test('mobile uploads preserve MIME metadata and filename for native and Blob parts', () => {
  assert.match(platformSource, /original_filename:\s*parameters\.original_filename\s*\|\|\s*normalized\.name/);
  assert.match(platformSource, /blob\.slice\(0,\s*blob\.size,\s*normalized\.mimeType\)/);
  assert.match(platformSource, /form\.append\(fieldName,\s*typedBlob,\s*normalized\.name\)/);
});

test('media upload reports progress, real server errors and retry without creating a message on client failure', () => {
  assert.match(platformSource, /xhr\.onload\s*=\s*\(\)\s*=>resolve/);
  assert.match(platformSource, /xhr\.ontimeout/);
  assert.match(composerSource, /setUploadError/);
  assert.match(composerSource, /Retry/);
  assert.match(composerSource, /onMessage\(data\.message\)/);
});

test('Ring Bell media posting uses the shared upload route and exposes retry/success states', () => {
  assert.match(ringBellsSource, /ApiRoute\.STORY_MEDIA_UPLOAD/);
  assert.match(ringBellsSource, /maxBytes:\s*50\s*\*\s*1024\s*\*\s*1024/);
  assert.match(ringBellsSource, /Media posted successfully\./);
  assert.match(ringBellsSource, /Retry upload/);
  assert.match(ringBellsSource, /mediaPostError/);
  assert.match(ringBellsSource, /upload\?\.data\?\.filename/);
});

const appSource = await readFile(new URL('../App.js', import.meta.url), 'utf8');

test('chat attachment preview uses the native Modal and dismisses after Send', () => {
  assert.ok(appSource.includes('  Modal,\n'));
  assert.ok(appSource.includes('setAttachmentDraft(null);setReplyTo(null);setAttachmentProgress(1);'));
  assert.ok(appSource.includes('onRequestClose={() => { if(!uploading)setAttachmentDraft(null); }}'));
});

test('chat photo/document Send uses the non-XHR upload path so the preview modal cannot remain stuck on the progress overlay', () => {
  const sendAttachment = appSource.match(/const sendAttachment = async \(\) => \{[\s\S]*?\n  \};/)?.[0] || '';
  assert.match(sendAttachment, /uploadAttachmentAsset\(attachmentDraft,\{chat_id:chat\.id,download_policy:'APPROVAL_REQUIRED',reply_to_message_id:replyTo\?\.id\|\|undefined\}\)/);
  assert.doesNotMatch(sendAttachment, /onProgress/);
  assert.match(appSource, /Sending attachment… Please wait\./);
  assert.match(appSource, /ActivityIndicator color="#3157d5"/);
});


test('chat attachment chooser provides working camera, photo library and document actions with explicit close controls', () => {
  assert.match(appSource, /setAttachmentMenuOpen\(true\)/);
  assert.match(appSource, /requestCameraPermissionsAsync/);
  assert.match(appSource, /requestMediaLibraryPermissionsAsync/);
  assert.match(appSource, /launchCameraAsync/);
  assert.match(appSource, /launchImageLibraryAsync/);
  assert.match(appSource, /DocumentPicker\.getDocumentAsync/);
  assert.match(appSource, /accessibilityLabel="Close attachment menu"/);
  assert.match(appSource, />Cancel<\/Text>/);
  assert.match(appSource, /onRequestClose=\{\(\) => setAttachmentMenuOpen\(false\)\}/);
});

test('chat attachment chooser validates file availability and 25 MB limit before preview/upload', () => {
  assert.match(appSource, /const validateAttachment = asset =>/);
  assert.match(appSource, /size > 25 \* 1024 \* 1024/);
  assert.match(appSource, /Attachments must be 25 MB or smaller/);
  assert.match(appSource, /selected file is empty or its size could not be determined/);
});


test('attachment previews use a stable on-device cache and avoid repeated server downloads', () => {
  assert.match(platformSource, /cloudcomai-attachment-previews/);
  assert.match(platformSource, /attachment\.updated_at\|\|attachment\.created_at\|\|attachment\.file_size/);
  assert.match(platformSource, /if\(file\.exists&&Number\(file\.size\|\|0\)>0\)return file/);
  assert.doesNotMatch(platformSource, /\$\{Number\(attachment\.id\)\}-\$\{Date\.now\(\)\}/);
});


test('attachment chooser matches the native dialog format while retaining PR 121 close behavior', () => {
  assert.match(appSource, /Choose where the attachment should come from\./);
  assert.match(appSource, /accessibilityLabel="Close attachment menu"/);
  assert.match(appSource, /accessibilityLabel="Close attachment menu backdrop"/);
  assert.match(appSource, /onPress=\{event => event\.stopPropagation\(\)\}/);
  assert.match(appSource, /attachmentMenuActions: \{ flexDirection: 'row'/);
  assert.match(appSource, />CAMERA<\/Text>/);
  assert.match(appSource, />PHOTO LIBRARY<\/Text>/);
  assert.match(appSource, />DOCUMENT<\/Text>/);
  assert.match(appSource, /attachmentMenuCard: \{ width: '100%', maxWidth: 420/);
  assert.doesNotMatch(appSource, /Supported documents: PDF, TXT, Word, Excel and PowerPoint/);
});


test('chat composer remains a bottom footer while messages load', () => {
  assert.match(appSource, /messageArea: \{ flex: 1, minHeight: 0 \}/);
  assert.match(appSource, /<View style=\{styles\.messageArea\}>\s*\{loading \?/);
  const composer = appSource.match(/<View style=\{\[styles\.composer,[\s\S]*?<\/View>\s*<\/KeyboardAvoidingView>/)?.[0] || '';
  assert.match(composer, /accessibilityLabel="Add photo or document"/);
  assert.match(composer, /placeholder="Type a message\.\.\."/);
  assert.match(composer, />Send<\/Text>/);
  assert.match(composer, /styles\.emojiToggle/);
});
