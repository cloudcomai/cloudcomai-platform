import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeVoiceWav } from '../src/utils/voiceAudio.js';

test('voice WAV has a correct PCM header and mixed/clamped samples', () => {
  const buffer = encodeVoiceWav([new Float32Array([-1, 0, 1, 2]), new Float32Array([-1, 1, 1, 2])], 48000);
  const view = new DataView(buffer);
  assert.equal(new TextDecoder().decode(buffer.slice(0, 4)), 'RIFF');
  assert.equal(view.getUint32(4, true), buffer.byteLength - 8);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint32(40, true), 8);
  assert.deepEqual([0, 1, 2, 3].map(index => view.getInt16(44 + index * 2, true)), [-32768, 16384, 32767, 32767]);
});
