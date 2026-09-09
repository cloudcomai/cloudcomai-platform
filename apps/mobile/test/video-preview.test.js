import assert from 'node:assert/strict';
import test from 'node:test';
import { retryVideoPlayback, startVideoPlayback } from '../src/utils/videoPlayback.js';

test('starts video playback when a player is available', () => {
  let played = 0;
  const player = { play: () => { played += 1; } };

  assert.equal(startVideoPlayback(player), true);
  assert.equal(played, 1);
});

test('replaces the source and starts playback when retrying', () => {
  let replacedWith = null;
  let played = 0;
  const player = {
    replace: source => { replacedWith = source; },
    play: () => { played += 1; },
  };

  assert.equal(retryVideoPlayback(player, 'file:///retry.mp4'), true);
  assert.equal(replacedWith, 'file:///retry.mp4');
  assert.equal(played, 1);
});

test('does not throw when no playable player is supplied', () => {
  assert.equal(startVideoPlayback(null), false);
  assert.equal(retryVideoPlayback(null, 'file:///retry.mp4'), false);
});
