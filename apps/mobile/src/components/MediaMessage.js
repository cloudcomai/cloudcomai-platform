import React, { useEffect, useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { parseSharedLocation, parseMessageTimestamp } from '@cloudcomai/chat-core';
import { apiClient, downloadAttachmentPreview } from '../services/platform';
import { attachmentKind } from '../utils/media';
import { pauseVideoPlayback, retryVideoPlayback, startVideoPlayback } from '../utils/videoPlayback';

export function AudioPreview({ source }) {
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const play = async () => {
    if (status.playing) player.pause();
    else {
      await setAudioModeAsync({ playsInSilentMode: true });
      if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) await player.seekTo(0);
      player.play();
    }
  };
  return <Pressable style={styles.audioCard} onPress={play} accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause voice message' : 'Play voice message'}>
    <Text style={styles.audioButton}>{status.playing ? '❚❚' : '▶'}</Text>
    <View style={styles.audioCopy}><Text style={styles.audioTitle}>{status.playing ? 'Playing audio' : 'Voice message'}</Text><Text style={styles.audioTime}>{Math.floor(status.currentTime || 0)} / {Math.ceil(status.duration || 0)}s</Text></View>
  </Pressable>;
}

export function VideoPreview({ source }) {
  const { width } = useWindowDimensions();
  const mediaWidth = Math.min(280, (width - 28) * 0.82 - 22);
  const player = useVideoPlayer(source, p => { p.loop = false; });
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const statusSubscription = player.addListener('statusChange', event => {
      if (event.status === 'error') setError('Video could not be played. Tap retry to try again.');
    });
    const playingSubscription = player.addListener('playingChange', event => setPlaying(Boolean(event.isPlaying)));
    return () => { statusSubscription.remove(); playingSubscription.remove(); };
  }, [player]);
  const retry = () => { setError(''); if (!retryVideoPlayback(player, source)) setError('Video could not be played. Tap retry to try again.'); };
  if (error) return <Pressable style={styles.control} onPress={retry} accessibilityRole="button"><Text style={styles.error}>{error}</Text><Text style={styles.link}>Retry video</Text></Pressable>;
  return <View style={[styles.videoShell, { width: mediaWidth, height: mediaWidth * 0.75 }]}>
    <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls fullscreenOptions={{ enable: true }} />
    {!playing ? <Pressable style={styles.videoPlayOverlay} onPress={() => startVideoPlayback(player)} accessibilityRole="button" accessibilityLabel="Play video"><Text style={styles.videoPlay}>▶</Text></Pressable> : null}
    {playing ? <Pressable style={styles.videoPauseOverlay} onPress={() => pauseVideoPlayback(player)} accessibilityRole="button" accessibilityLabel="Pause video"><Text style={styles.videoPause}>❚❚</Text></Pressable> : null}
  </View>;
}

function AttachmentApproval({ attachment }) {
  const [statuses, setStatuses] = useState({ DOWNLOAD: null, FORWARD: null });
  const [senderRequests, setSenderRequests] = useState([]);
  const request = async requestType => {
    try {
      const result = await apiClient.post('v1/attachment-requests/request', { attachment_id: attachment.id, request_type: requestType });
      setStatuses(current => ({ ...current, [requestType]: result.data?.status || 'PENDING' }));
    } catch (e) { Alert.alert('Approval request', e.message || 'Unable to request approval.'); }
  };
  const respond = async (requestId, status) => {
    try {
      await apiClient.post('v1/attachment-requests/respond', { request_id: requestId, status });
      setSenderRequests(items => items.filter(item => Number(item.request_id) !== Number(requestId)));
    } catch (e) { Alert.alert('Approval response', e.message || 'Unable to update request.'); }
  };
  useEffect(() => {
    let active = true;
    apiClient.get('v1/attachment-requests').then(result => {
      if (active) setSenderRequests((result.data?.requests || []).filter(item => Number(item.attachment_id) === Number(attachment.id)));
    }).catch(() => {});
    return () => { active = false; };
  }, [attachment.id]);
  const statusLabel = status => status === 'APPROVED' ? 'Approved' : status === 'DENIED' ? 'Rejected' : status === 'PENDING' ? 'Request Pending' : null;
  return <View style={styles.approvalBox}>
    <View style={styles.approvalActions}>
      {(['DOWNLOAD', 'FORWARD']).map(type => <View key={type} style={styles.approvalAction}>
        {statusLabel(statuses[type]) ? <Text style={[styles.approvalStatus, statuses[type] === 'DENIED' && styles.rejected]}>{statusLabel(statuses[type])}</Text> : null}
        {statuses[type] !== 'APPROVED' && statuses[type] !== 'PENDING' ? <Pressable onPress={() => request(type)}><Text style={styles.link}>{type === 'DOWNLOAD' ? 'Save / Download' : 'Forward'}</Text></Pressable> : null}
      </View>)}
    </View>
    {senderRequests.map(item => <View key={item.request_id} style={styles.senderApproval}>
      <Text style={styles.senderApprovalText}>{item.requester_name || 'A recipient'} requested {String(item.request_type || 'DOWNLOAD').toLowerCase()} access.</Text>
      <View style={styles.approvalActions}><Pressable onPress={() => respond(item.request_id, 'APPROVED')}><Text style={styles.link}>Approve</Text></Pressable><Pressable onPress={() => respond(item.request_id, 'DENIED')}><Text style={styles.rejectLink}>Reject</Text></Pressable></View>
    </View>)}
  </View>;
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
  useEffect(() => { setRequested(false); setSource(null); setError(''); }, [attachment?.id]);
  useEffect(() => {
    if (!kind || !attachment?.id || (!autoDownload && !requested)) return undefined;
    let active = true;
    let previewFile = null;
    setError('');
    downloadAttachmentPreview(attachment).then(file => {
      previewFile = file;
      if (active) setSource(file.uri);
      else if (file.exists) file.delete();
    }).catch(loadError => { if (active) setError(loadError.message || 'Preview unavailable.'); });
    return () => { active = false; if (previewFile?.exists) { try { previewFile.delete(); } catch {} } };
  }, [attachment?.id, kind, requested, autoDownload, reloadKey]);
  if (message.type === 'poll') {
    const pollId = Number(message.poll_id || message.poll?.id || 0);
    const vote = async optionId => {
      if (!pollId || pollBusy) return;
      setPollBusy(true); setError('');
      try { const { data } = await apiClient.post('v1/polls', { poll_id: pollId, option_id: optionId }, { query: { action: 'vote' } }); if (Array.isArray(data.options)) setPollOptions(data.options); }
      catch (e) { setError(e.message || 'Unable to save vote.'); }
      finally { setPollBusy(false); }
    };
    return <View style={[styles.pollCard, { width: mediaWidth }]}><Text style={styles.pollQuestion}>📊 {message.poll?.question || 'Poll'}</Text>{pollOptions.map(option => <Pressable key={option.id} disabled={pollBusy || Boolean(message.poll?.expires_at && parseMessageTimestamp(message.poll.expires_at) <= new Date())} onPress={() => vote(option.id)} style={[styles.pollOption, option.selected && styles.pollOptionSelected]}><Text style={styles.pollOptionText}>{option.text}</Text><Text style={styles.pollVotes}>{option.votes || 0}{option.selected ? ' ✓' : ''}</Text></Pressable>)}{message.poll?.expires_at ? <Text style={styles.meta}>Expires {parseMessageTimestamp(message.poll.expires_at).toLocaleString()}</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}</View>;
  }
  if (message.type === 'location') {
    const location = parseSharedLocation(message.body);
    return location ? <Pressable onPress={() => Linking.openURL(location.url).catch(() => setError('Unable to open maps.'))} accessibilityRole="link"><Text style={styles.link}>📍 {location.label}</Text><Text>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</Text><Text style={styles.link}>Open in maps ↗</Text>{error ? <Text>{error}</Text> : null}</Pressable> : <Text>Location unavailable</Text>;
  }
  if (!attachment) return <Text style={styles.text}>{message.body || ''}</Text>;
  return <View>
    {error ? <View><Text style={styles.error}>{error}</Text><Pressable onPress={() => { setSource(null); setError(''); setRequested(true); setReloadKey(value => value + 1); }} style={styles.control}><Text style={styles.link}>Try preview again</Text></Pressable></View> : source ? kind === 'audio' ? <AudioPreview source={source} /> : kind === 'video' ? <VideoPreview source={source} /> : kind === 'image' ? <Image source={{ uri: source }} style={[styles.image, { width: mediaWidth, height: mediaWidth * 0.75 }]} resizeMode="contain" onError={() => setError('Image preview could not be displayed.')} /> : <View style={styles.documentCard}><Text style={styles.documentIcon}>▤</Text><Text numberOfLines={2} style={styles.documentName}>{attachment.name || 'Document'}</Text><Pressable style={styles.documentButton} onPress={() => setRequested(true)}><Text style={styles.link}>Preview document</Text></Pressable></View> : kind ? <Pressable onPress={() => setRequested(true)} style={styles.previewPlaceholder}><Text style={kind === 'video' ? styles.videoPlaceholderIcon : styles.previewIcon}>{kind === 'video' ? '▶' : kind === 'audio' ? '♫' : '▤'}</Text><Text style={styles.previewLabel}>{kind === 'video' ? 'Video' : kind === 'audio' ? 'Audio' : 'Document'}</Text></Pressable> : null}
    {kind ? <AttachmentApproval attachment={attachment} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  pollCard: { maxWidth: '100%' }, pollQuestion: { color: '#172033', fontWeight: '800', fontSize: 15, marginBottom: 8 }, pollOption: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 6, borderWidth: 1, borderColor: '#d8deea', borderRadius: 10, backgroundColor: '#fff' }, pollOptionSelected: { borderColor: '#3157d5', backgroundColor: '#eef2ff' }, pollOptionText: { color: '#172033', flex: 1 }, pollVotes: { color: '#3157d5', fontWeight: '800', marginLeft: 8 }, error: { color: '#b91c1c', marginTop: 6 }, control: { paddingVertical: 12 }, link: { color: '#3157d5', fontWeight: '700' }, rejectLink: { color: '#b91c1c', fontWeight: '700' }, text: { color: '#172033', fontSize: 15 }, meta: { color: '#68748a', fontSize: 11, marginVertical: 6 }, audioCard: { minWidth: 210, maxWidth: 280, minHeight: 58, padding: 10, borderRadius: 12, backgroundColor: '#eef2ff', flexDirection: 'row', alignItems: 'center' }, audioButton: { width: 38, height: 38, borderRadius: 19, textAlign: 'center', textAlignVertical: 'center', backgroundColor: '#3157d5', color: '#fff', fontWeight: '800', fontSize: 18 }, audioCopy: { marginLeft: 10 }, audioTitle: { color: '#172033', fontWeight: '700' }, audioTime: { color: '#68748a', fontSize: 11, marginTop: 2 }, videoShell: { borderRadius: 10, overflow: 'hidden', backgroundColor: '#10131a', position: 'relative' }, videoPlayOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }, videoPlay: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff', color: '#172033', textAlign: 'center', textAlignVertical: 'center', fontSize: 28, paddingLeft: 4 }, videoPauseOverlay: { position: 'absolute', left: 12, bottom: 12 }, videoPause: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,.65)', color: '#fff', textAlign: 'center', textAlignVertical: 'center', fontSize: 17 }, approvalBox: { marginTop: 6 }, approvalActions: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' }, approvalAction: { minWidth: 105 }, approvalStatus: { color: '#166534', fontSize: 11, fontWeight: '800', marginBottom: 4 }, rejected: { color: '#b91c1c' }, senderApproval: { marginTop: 6, padding: 8, borderRadius: 8, backgroundColor: '#fff7ed' }, senderApprovalText: { color: '#7c2d12', fontSize: 11, marginBottom: 4 }, previewPlaceholder: { width: 230, height: 140, borderRadius: 10, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' }, previewIcon: { fontSize: 32, color: '#3157d5' }, videoPlaceholderIcon: { fontSize: 40, color: '#3157d5' }, previewLabel: { marginTop: 4, color: '#3157d5', fontWeight: '700' }, image: { borderRadius: 10, backgroundColor: '#f4f6fa' }, documentCard: { width: 230, minHeight: 100, padding: 12, borderRadius: 10, backgroundColor: '#f4f6fa' }, documentIcon: { fontSize: 28, color: '#3157d5' }, documentName: { color: '#172033', fontWeight: '700', marginVertical: 5 }, documentButton: { paddingVertical: 4 },
});
