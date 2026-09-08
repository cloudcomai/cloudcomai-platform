import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { parseSharedLocation, parseMessageTimestamp } from '@cloudcomai/chat-core';
import { downloadAttachmentPreview, platformApi } from '../services/platform';
import { attachmentKind } from '../utils/media';

export function AudioPreview({ source }) {
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const play = async () => {
    if (status.playing) player.pause();
    else { await setAudioModeAsync({ playsInSilentMode: true }); if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) await player.seekTo(0); player.play(); }
  };
  return <Pressable style={styles.control} onPress={play} accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause voice message' : 'Play voice message'}><Text style={styles.link}>{status.playing ? 'Pause' : 'Play'} voice · {Math.floor(status.currentTime || 0)} / {Math.ceil(status.duration || 0)}s</Text></Pressable>;
}

export function VideoPreview({ source }) {
  const { width } = useWindowDimensions();
  const mediaWidth = Math.min(280, (width - 28) * 0.82 - 22);
  const player = useVideoPlayer(source);
  const [error, setError] = useState('');
  useEffect(() => {
    const subscription = player.addListener('statusChange', event => { if (event.status === 'error') setError('Video unavailable or unsupported on this device.'); });
    return () => subscription.remove();
  }, [player]);
  return error ? <Text>{error}</Text> : <VideoView player={player} style={[styles.video, { width: mediaWidth, height: mediaWidth * 0.75 }]} nativeControls fullscreenOptions={{ enable: true }} />;
}

export default function MediaMessage({ message, autoDownload }) {
  const { width } = useWindowDimensions();
  const mediaWidth = Math.min(280, (width - 28) * 0.82 - 22);
  const [requested, setRequested] = useState(false);
  const [pollOptions, setPollOptions] = useState(message.poll?.options || []);
  const [pollBusy, setPollBusy] = useState(false);
  const [source, setSource] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const attachment = message.attachment;
  useEffect(() => { setPollOptions(message.poll?.options || []); }, [message.poll?.options]);
  const kind = attachmentKind(message.type, attachment);
  useEffect(() => {
    setRequested(false);
    setSource(null);
    setError('');
  }, [attachment?.id]);
  useEffect(() => {
    if (!kind || !attachment?.id || (!autoDownload && !requested)) return undefined;
    let active = true;
    let previewFile = null;
    setError('');
    downloadAttachmentPreview(attachment).then(file => {
      previewFile = file;
      if (active) setSource(file.uri);
      else if (file.exists) file.delete();
    }).catch(loadError => {
      if (active) setError(loadError.message || 'Preview unavailable.');
    });
    return () => {
      active = false;
      if (previewFile?.exists) {
        try { previewFile.delete(); } catch {}
      }
    };
  }, [attachment?.id, kind, requested, autoDownload, reloadKey]);
  if (message.type === 'poll') {
    const pollId = Number(message.poll_id || message.poll?.id || 0);
    const vote = async optionId => {
      if (!pollId || pollBusy) return;
      setPollBusy(true);
      setError('');
      try {
        const { data } = await platformApi.voteInPoll(pollId, optionId);
        if (Array.isArray(data.options)) setPollOptions(data.options);
      } catch (e) {
        setError(e.message || 'Unable to save vote.');
      } finally {
        setPollBusy(false);
      }
    };
    return <View style={[styles.pollCard, { width: mediaWidth }]}>
      <Text style={styles.pollQuestion}>📊 {message.poll?.question || 'Poll'}</Text>
      {pollOptions.map(option => <Pressable key={option.id} disabled={pollBusy || Boolean(message.poll?.expires_at && parseMessageTimestamp(message.poll.expires_at) <= new Date())} onPress={() => vote(option.id)} style={[styles.pollOption, option.selected && styles.pollOptionSelected]}>
        <Text style={styles.pollOptionText}>{option.text}</Text>
        <Text style={styles.pollVotes}>{option.votes || 0}{option.selected ? ' ✓' : ''}</Text>
      </Pressable>)}
      {message.poll?.expires_at ? <Text style={styles.meta}>Expires {parseMessageTimestamp(message.poll.expires_at).toLocaleString()}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>;
  }
  if (message.type === 'location') {
    const location = parseSharedLocation(message.body);
    return location ? <Pressable onPress={() => Linking.openURL(location.url).catch(() => setError('Unable to open maps.'))} accessibilityRole="link"><Text style={styles.link}>📍 {location.label}</Text><Text>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</Text><Text style={styles.link}>Open in maps ↗</Text>{error ? <Text>{error}</Text> : null}</Pressable> : <Text>Location unavailable</Text>;
  }
  if (!attachment) return <Text style={styles.text}>{message.type === 'poll' ? `Poll: ${message.poll?.question || 'Poll'}` : message.body || ''}</Text>;
  return <View><Text style={styles.text}>{attachment.name}</Text><Text style={styles.meta}>{Math.ceil(Number(attachment.file_size || 0) / 1024)} KB · {attachment.download_policy === 'APPROVAL_REQUIRED' ? 'Download requires approval' : attachment.download_policy === 'VIEW_ONLY' ? 'View only' : 'Download allowed'}</Text>
    {error ? <View><Text style={styles.error}>{error}</Text><Pressable onPress={() => { setSource(null); setError(''); setRequested(true); setReloadKey(value => value + 1); }} style={styles.control}><Text style={styles.link}>Try preview again</Text></Pressable></View> : source ? kind === 'audio' ? <AudioPreview source={source} /> : kind === 'video' ? <VideoPreview source={source} /> : <Image source={{ uri: source }} style={[styles.video, { width: mediaWidth, height: mediaWidth * 0.75 }]} resizeMode="contain" onError={() => setError('Image preview could not be displayed.')} /> : kind ? <Pressable onPress={() => setRequested(true)} style={styles.control}><Text style={styles.link}>{requested || autoDownload ? 'Loading…' : `Load ${kind}`}</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({ pollCard: { maxWidth: '100%' }, pollQuestion: { color: '#172033', fontWeight: '800', fontSize: 15, marginBottom: 8 }, pollOption: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 6, borderWidth: 1, borderColor: '#d8deea', borderRadius: 10, backgroundColor: '#fff' }, pollOptionSelected: { borderColor: '#3157d5', backgroundColor: '#eef2ff' }, pollOptionText: { color: '#172033', flex: 1 }, pollVotes: { color: '#3157d5', fontWeight: '800', marginLeft: 8 }, error: { color: '#b91c1c', marginTop: 6 }, video: { width: 240, height: 180, borderRadius: 8 }, control: { paddingVertical: 12 }, link: { color: '#3157d5', fontWeight: '600' }, text: { color: '#172033', fontSize: 15 }, meta: { color: '#68748a', fontSize: 11, marginVertical: 6 } });
