// Encode browser recordings as PCM WAV so native audio players can play them too.
export function encodeVoiceWav(channels, sampleRate) {
  if (!channels.length || !channels[0].length || !Number.isInteger(sampleRate) || sampleRate <= 0) throw new Error('Invalid audio recording');
  const frames = channels[0].length;
  const buffer = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, frames * 2, true);
  for (let index = 0; index < frames; index++) {
    const sample = Math.max(-1, Math.min(1, channels.reduce((sum, channel) => sum + (channel[index] || 0), 0) / channels.length));
    view.setInt16(44 + index * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return buffer;
}

export async function makeVoiceFile(blob) {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) throw new Error('Audio conversion is unavailable in this browser.');
  const context = new Context();
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    const channels = Array.from({ length: audio.numberOfChannels }, (_, index) => audio.getChannelData(index));
    return new File([encodeVoiceWav(channels, audio.sampleRate)], `voice-${Date.now()}.wav`, { type: 'audio/wav' });
  } finally { await context.close(); }
}
