import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const platformSource = await readFile(new URL('../src/services/platform.js', import.meta.url), 'utf8');
const ringBellsSource = await readFile(new URL('../src/components/RingBellsStatus.js', import.meta.url), 'utf8');
const composerSource = await readFile(new URL('../src/components/MediaComposer.js', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../App.js', import.meta.url), 'utf8');


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


test('chat attachment preview uses the native Modal and dismisses after Send', () => {
  assert.match(appSource, /\\bModal,\\n/);
  assert.match(appSource, /setAttachmentDraft\\(null\\);setReplyTo\\(null\\);setAttachmentProgress\\(1\\);/);
  assert.match(appSource, /onRequestClose=\\{\\(\\) => \\{ if\\(!uploading\\)setAttachmentDraft\\(null\\); \\}\\}/);
});

test('chat photo/document Send uses the non-XHR upload path so the preview modal cannot remain stuck on the progress overlay', () => {
  const sendAttachment = appSource.match(/const sendAttachment = async \(\) => \{[\\s\\S]*?\n  \};/)?.[0] || '';
  assert.match(sendAttachment, /uploadAttachmentAsset\(attachmentDraft,\{chat_id:chat\.id,download_policy:'APPROVAL_REQUIRED',reply_to_message_id:replyTo\?\.id\|\|undefined\}\)/);
  assert.doesNotMatch(sendAttachment, /onProgress/);
  assert.match(appSource, /Sending attachment… Please wait\./);
  assert.match(appSource, /ActivityIndicator color="#3157d5"/);
});
