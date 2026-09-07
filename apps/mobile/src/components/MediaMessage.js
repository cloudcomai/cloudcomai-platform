import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ApiRoute } from '@cloudcomai/api-client';
import { parseSharedLocation } from '@cloudcomai/chat-core';
import { API_BASE_URL, platformApi, sessionManager } from '../services/platform';

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
  const player = useVideoPlayer(source);
  const [error, setError] = useState('');
  useEffect(() => {
    const subscription = player.addListener('statusChange', event => { if (event.status === 'error') setError('Video unavailable or unsupported on this device.'); });
    return () => subscription.remove();
  }, [player]);
  return error ? <Text>{error}</Text> : <VideoView player={player} style={styles.video} nativeControls fullscreenOptions={{ enable: true }} />;
}

export default function MediaMessage({ message, autoDownload }) {
  const [requested, setRequested] = useState(false);
  const [pollOptions, setPollOptions] = useState(message.poll?.options || []);
  const [pollBusy, setPollBusy] = useState(false);
  const [source, setSource] = useState(null);
  const [error, setError] = useState('');
  const attachment = message.attachment;
  useEffect(() => { setPollOptions(message.poll?.options || []); }, [message.poll?.options]);
  const mime = String(attachment?.mime_type || '');
  const kind = message.type === 'voice' || mime.startsWith('audio/') ? 'audio' : mime.startsWith('video/') ? 'video' : mime.startsWith('image/') ? 'image' : '';
  useEffect(() => {
    if (!kind || !attachment?.id || (!autoDownload && !requested)) return undefined;
    let active = true;
    sessionManager.getToken().then(token => {
      if (!active) return;
      const url = new URL(ApiRoute.ATTACHMENT, `${API_BASE_URL}/`);
      url.searchParams.set('id', String(attachment.id)); url.searchParams.set('preview', '1');
      setSource({ uri: url.toString(), headers: { Authorization: `Bearer ${token}` } });
    }).catch(() => { if (active) setError('Unable to authorize media.'); });
    return () => { active = false; };
  }, [attachment?.id, kind, requested, autoDownload]);
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
    return <View style={styles.pollCard}>
      <Text style={styles.pollQuestion}>📊 {message.poll?.question || 'Poll'}</Text>
      {pollOptions.map(option => <Pressable key={option.id} disabled={pollBusy} onPress={() => vote(option.id)} style={[styles.pollOption, option.selected && styles.pollOptionSelected]}>
        <Text style={styles.pollOptionText}>{option.text}</Text>
        <Text style={styles.pollVotes}>{option.votes || 0}{option.selected ? ' ✓' : ''}</Text>
      </Pressable>)}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>;
  }
  if (message.type === 'location') {
    const location = parseSharedLocation(message.body);
    return location ? <Pressable onPress={() => Linking.openURL(location.url).catch(() => setError('Unable to open maps.'))} accessibilityRole="link"><Text style={styles.link}>📍 {location.label}</Text><Text>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</Text><Text style={styles.link}>Open in maps ↗</Text>{error ? <Text>{error}</Text> : null}</Pressable> : <Text>Location unavailable</Text>;
  }
  if (!attachment) return <Text style={styles.text}>{message.type === 'poll' ? `Poll: ${message.poll?.question || 'Poll'}` : message.body || ''}</Text>;
  return <View><Text style={styles.text}>{attachment.name}</Text><Text style={styles.meta}>{Math.ceil(Number(attachment.file_size || 0) / 1024)} KB · {attachment.download_policy === 'APPROVAL_REQUIRED' ? 'Download requires approval' : attachment.download_policy === 'VIEW_ONLY' ? 'View only' : 'Download allowed'}</Text>
    {error ? <Text>{error}</Text> : source ? kind === 'audio' ? <AudioPreview source={source} /> : kind === 'video' ? <VideoPreview source={source} /> : <Image source={source} style={styles.video} resizeMode="contain" onError={() => setError('Image unavailable.')} /> : kind ? <Pressable onPress={() => setRequested(true)} style={styles.control}><Text style={styles.link}>{requested || autoDownload ? 'Loading…' : `Load ${kind}`}</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({ pollCard: { minWidth: 220 }, pollQuestion: { color: '#172033', fontWeight: '800', fontSize: 15, marginBottom: 8 }, pollOption: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 6, borderWidth: 1, borderColor: '#d8deea', borderRadius: 10, backgroundColor: '#fff' }, pollOptionSelected: { borderColor: '#3157d5', backgroundColor: '#eef2ff' }, pollOptionText: { color: '#172033', flex: 1 }, pollVotes: { color: '#3157d5', fontWeight: '800', marginLeft: 8 }, error: { color: '#b91c1c', marginTop: 6 }, video: { width: 240, height: 180, borderRadius: 8 }, control: { paddingVertical: 12 }, link: { color: '#3157d5', fontWeight: '600' }, text: { color: '#172033', fontSize: 15 }, meta: { color: '#68748a', fontSize: 11, marginVertical: 6 } });
