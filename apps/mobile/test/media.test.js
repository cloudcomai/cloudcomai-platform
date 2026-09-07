import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachmentKind,
  buildApiUrl,
  normalizeUploadAsset,
  safeUploadName,
} from '../src/utils/media.js';

test('normalizes Android picker assets without treating image as a MIME type', () => {
  assert.deepEqual(normalizeUploadAsset({
    uri: 'file:///cache/cropped-photo.jpg',
    fileName: 'camera/photo.jpg',
    fileSize: 1024,
    type: 'image',
  }), {
    uri: 'file:///cache/cropped-photo.jpg',
    name: 'photo.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
  });
});

test('sanitizes upload names and infers MIME types from document extensions', () => {
  assert.equal(safeUploadName({ name: '..\\reports\\status.pdf' }), 'status.pdf');
  assert.equal(normalizeUploadAsset({ uri: 'file:///status.pdf', name: 'status.pdf' }).mimeType, 'application/pdf');
  assert.equal(
    normalizeUploadAsset({ uri: 'file:///camera-output', mimeType: 'image/jpeg' }, { fallbackName: 'attachment' }).name,
    'attachment.jpg',
  );
});

test('recognizes legacy image attachments from their filename when MIME metadata is generic', () => {
  assert.equal(attachmentKind('attachment', { name: 'holiday.PNG', mime_type: 'application/octet-stream' }), 'image');
  assert.equal(attachmentKind('voice', { name: 'recording.bin', mime_type: '' }), 'audio');
});

test('builds encoded API URLs without depending on the browser URL API', () => {
  assert.equal(
    buildApiUrl('https://example.test/api/', '/v1/media', { type: 'user', id: 42 }),
    'https://example.test/api/v1/media?type=user&id=42',
  );
});
