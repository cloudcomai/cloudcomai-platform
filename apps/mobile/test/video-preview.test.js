import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { pauseVideoPlayback, retryVideoPlayback, startVideoPlayback } from '../src/utils/videoPlayback.js';

test('starts playback for a playable video', () => {
  let played = 0;
  assert.equal(startVideoPlayback({ play: () => { played += 1; } }), true);
  assert.equal(played, 1);
});

test('pause immediately stops playback and keeps the current position', () => {
  let paused = 0;
  const player = { currentTime: 12, pause: () => { paused += 1; } };
  assert.equal(pauseVideoPlayback(player), true);
  assert.equal(paused, 1);
  assert.equal(player.currentTime, 12);
});

test('replaces source and retries playback from the beginning', () => {
  let source = null;
  let played = 0;
  const player = { currentTime: 9, replace: value => { source = value; }, play: () => { played += 1; } };
  assert.equal(retryVideoPlayback(player, 'file:///retry.mp4'), true);
  assert.equal(source, 'file:///retry.mp4');
  assert.equal(player.currentTime, 0);
  assert.equal(played, 1);
});

test('handles unavailable players safely', () => {
  assert.equal(startVideoPlayback(null), false);
  assert.equal(pauseVideoPlayback(null), false);
  assert.equal(retryVideoPlayback(null, 'file:///retry.mp4'), false);
});

test('chat video is lazy, thumbnail-backed and aspect-ratio safe', () => {
  const source = fs.readFileSync(new URL('../src/components/MediaMessage.js', import.meta.url), 'utf8');
  assert.match(source, /downloadVideoThumbnail\(attachment\)/);
  assert.match(source, /downloadAttachmentPreview\(attachment\)/);
  assert.match(source, /thumbnail_available/);
  assert.match(source, /attachment\?\.width/);
  assert.match(source, /attachment\?\.height/);
  assert.match(source, /formatBytes\(attachment\?\.file_size\)/);
  assert.match(source, /presentationStyle="fullScreen"/);
  assert.match(source, /fullscreenOptions=\{\{ enable: true \}\}/);
  assert.match(source, /contentFit="contain"/);
  assert.match(source, /useVideoPlayer\(videoSource/);
  assert.doesNotMatch(source, /useVideoPlayer\(source, p => \{ p\.pause\(\); \}\)/);
});

test('chat video does not eagerly download the video attachment on render', () => {
  const source = fs.readFileSync(new URL('../src/components/MediaMessage.js', import.meta.url), 'utf8');
  const videoBlock = source.slice(source.indexOf('export function VideoPreview'), source.indexOf('function AttachmentApproval'));
  assert.match(videoBlock, /if \(!videoSource\)/);
  assert.match(videoBlock, /downloadAttachmentPreview\(attachment\)/);
});
