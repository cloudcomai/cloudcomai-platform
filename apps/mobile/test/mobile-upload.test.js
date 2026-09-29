import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const platformSource = await readFile(new URL('../src/services/platform.js', import.meta.url), 'utf8');
const ringBellsSource = await readFile(new URL('../src/components/RingBellsStatus.js', import.meta.url), 'utf8');
const composerSource = await readFile(new URL('../src/components/MediaComposer.js', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../App.js', import.meta.url), 'utf8');


test('profile and group image uploads use Expo File multipart parts to avoid unsupported FormDataPart errors', () => {
  assert.match(platformSource, /appendExpoFilePart/);
  assert.match(platformSource, /multipartPartMode:\s*'expo-file'/);
  assert.match(platformSource, /maxBytes:\s*12\s*\*\s*1024\s*\*\s*1024/);
});


test('chat attachment uploads use the shared multipart service and expose cancellation hooks', () => {
  const attachmentUpload = platformSource.match(/export const uploadAttachmentAsset=[^\n]+/)?.[0] || '';
  assert.match(attachmentUpload, /multipartPartMode='expo-file'/);
  assert.match(attachmentUpload, /ApiRoute\.UPLOAD_ATTACHMENT/);
  assert.match(attachmentUpload, /onProgress/);
  assert.match(attachmentUpload, /onCancelAvailable/);
  assert.match(platformSource, /const appendExpoFilePart =/);
  assert.match(platformSource, /form\.append\(fieldName,file\)/);
});

test('shared multipart contract covers image, voice, video and document attachments', () => {
  const attachmentUpload = platformSource.match(/export const uploadAttachmentAsset=[^\n]+/)?.[0] || '';
  assert.match(attachmentUpload, /ApiRoute\.UPLOAD_ATTACHMENT/);
  assert.match(attachmentUpload, /multipartPartMode='expo-file'/);
  assert.match(platformSource, /const appendNativeFilePart =/);
  assert.match(platformSource, /const appendExpoFilePart =/);
  assert.match(platformSource, /form\.append\(fieldName,file\)/);
  assert.match(composerSource, /uploadAttachmentAsset/);
  assert.match(composerSource, /type:\s*'voice'/);
  assert.match(composerSource, /type:\s*'video'/);
  assert.match(appSource, /useAttachmentUpload/);
});

test('voice and video uploads use native file parts with progress XHR', () => {
  assert.match(composerSource, /multipartPartMode:\s*'native'/);
  assert.match(composerSource, /type:\s*'voice'/);
  assert.match(composerSource, /type:\s*'video'/);
  assert.match(platformSource, /const appendNativeFilePart =/);
  assert.match(platformSource, /form\.append\(fieldName,\{uri:normalized\.uri,name:normalized\.name,type:normalized\.mimeType\}\)/);
  assert.match(platformSource, /onProgress,onCancelAvailable/);
  assert.match(platformSource, /xhr\.upload\.onprogress/);
  assert.match(platformSource, /xhr\.send\(formData\)/);
});

test('profile image upload uses the same supported Expo File multipart contract', () => {
  const mediaUpload = platformSource.match(/export const uploadMediaAsset=[^\n]+/)?.[0] || '';
  assert.match(mediaUpload, /ApiRoute\.MEDIA_UPLOAD/);
  assert.match(mediaUpload, /fieldName:\s*'image'/);
  assert.match(mediaUpload, /multipartPartMode:\s*'expo-file'/);
  assert.match(mediaUpload, /fallbackMime:\s*'image\/jpeg'/);
  assert.doesNotMatch(platformSource, /File\.fromUri\(/);
});

test('multipart fallback preserves MIME type and filename instead of unsupported data formats', () => {
  assert.match(platformSource, /blob\.slice\(0,\s*blob\.size,\s*normalized\.mimeType\)/);
  assert.match(platformSource, /form\.append\(fieldName,\s*typedBlob,\s*normalized\.name\)/);
  assert.match(platformSource, /fileBlob\.slice\(0,\s*fileBlob\.size,\s*file\.mimeType\)/);
  assert.match(platformSource, /form\.append\(key,fileBlob\.type===file\.mimeType\?fileBlob:fileBlob\.slice\(0,fileBlob\.size,file\.mimeType\),file\.name\)/);
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

test('media upload reports progress, server errors and retry without creating a message on client failure', () => {
  assert.match(platformSource, /xhr\.onload=\(\)=>\{/);
  assert.match(platformSource, /xhr\.ontimeout=\(\)=>/);
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


test('chat attachment preview uses the native Modal and dismisses after Send', () => {
  assert.ok(appSource.includes('  Modal,\n'));
  assert.match(appSource, /onRequestClose=\{\(\) => \{ if\(uploading\) cancelUpload\(\); else setAttachmentDraft\(null\); \}\}/);
  assert.match(appSource, /sendAttachment\(attachmentDraft/);
});

test('chat attachment upload is owned by useAttachmentUpload with progress and cancellation wired into the preview modal', () => {
  const hookSource = appSource.match(/useAttachmentUpload\(\{[\s\S]*?\n  \}\);/)?.[0] || '';
  assert.match(appSource, /import \{ useAttachmentUpload \} from ['"]\.\/src\/hooks\/useAttachmentUpload['"]/);
  assert.match(hookSource, /chatId: chat\.id/);
  assert.match(hookSource, /onMessage: onMediaMessage/);
  const hookSource = await readFile(new URL('../src/hooks/useAttachmentUpload.js', import.meta.url), 'utf8');
  assert.match(hookSource, /onProgress: progress => setAttachmentProgress\(progress\)/);
  assert.match(hookSource, /onCancelAvailable: cancel =>/);
  assert.match(appSource, /onRequestClose=\{\(\) => \{ if\(uploading\) cancelUpload\(\); else setAttachmentDraft\(null\); \}\}/);
  assert.match(appSource, /if\(uploading\)\{ cancelUpload\(\); \} else \{ setAttachmentDraft\(null\); setAttachmentError\(''\); \}/);
  assert.match(appSource, /disabled=\{uploading\}/);
  assert.match(appSource, /Sending attachment… Please wait\./);
  assert.match(appSource, /ActivityIndicator color="#3157d5"/);
});

test('mobile attachment service exposes an active XHR cancellation handle and normalizes cancelled uploads', () => {
  assert.match(platformSource, /activeAttachmentUploadCancel/);
  assert.match(platformSource, /onCancelAvailable/);
  assert.match(platformSource, /xhr\.abort\(\)/);
  assert.match(platformSource, /code:'UPLOAD_CANCELLED'/);
  assert.match(platformSource, /finally\{activeAttachmentUploadCancel=null;onCancelAvailable\?\.\(null\);\}/);
});

test('mobile attachment hook clears the draft after UPLOAD_CANCELLED and does not report a cancellation as an upload error', async () => {
  const hookSource = await readFile(new URL('../src/hooks/useAttachmentUpload.js', import.meta.url), 'utf8');
  assert.match(hookSource, /error\?\.code === 'UPLOAD_CANCELLED'/);
  assert.match(hookSource, /clearDraft\?\.\(\)/);
  assert.match(hookSource, /setAttachmentError\(''\)/);
  assert.match(hookSource, /cancelActiveAttachmentUpload\(\)/);
});


test('chat attachment chooser provides working camera, photo library and document actions with explicit close controls', () => {
  assert.match(appSource, /setAttachmentMenuOpen\(true\)/);
  assert.match(appSource, /requestCameraPermissionsAsync/);
  assert.match(appSource, /requestMediaLibraryPermissionsAsync/);
  assert.match(appSource, /launchCameraAsync/);
  assert.match(appSource, /launchImageLibraryAsync/);
  assert.match(appSource, /DocumentPicker\.getDocumentAsync/);
  assert.match(appSource, /multipartPartMode:\s*'native'/);
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


test('voice/video upload does not require expo-file-system File construction to succeed for Android content URIs', () => {
  assert.match(platformSource, /try\{file=new File\(normalized\.uri\);\}catch\{\}/);
  assert.match(platformSource, /file\?\.size\?\?normalized\.size/);
});
