import assert from 'node:assert/strict';
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
