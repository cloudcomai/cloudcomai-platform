import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { parseSharedLocation, parseMessageTimestamp } from '@cloudcomai/chat-core';
import { apiClient, downloadAttachmentPreview, downloadVideoThumbnail } from '../services/platform';
import { attachmentKind } from '../utils/media';
import { pauseVideoPlayback, retryVideoPlayback, startVideoPlayback } from '../utils/videoPlayback';
import ForwardMessageModal from './ForwardMessageModal';
import UserProfileModal from './UserProfileModal';
import ReadReceipt from './ReadReceipt';

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

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function formatDuration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds || 0)));
  if (!value) return '';
  const minutes = Math.floor(value / 60);
  return `${minutes}:${String(value % 60).padStart(2, '0')}`;
}

export function VideoPreview({ source, attachment = null, local = false }) {
  const { width } = useWindowDimensions();
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailLoading, setThumbnailLoading] = useState(Boolean(attachment?.thumbnail_available));
  const [videoSource, setVideoSource] = useState(local ? source : null);
  const [downloading, setDownloading] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const ratio = useMemo(() => {
    const w = Number(attachment?.width || 0);
    const h = Number(attachment?.height || 0);
    return w > 0 && h > 0 ? Math.min(2.1, Math.max(0.56, w / h)) : 16 / 9;
  }, [attachment?.width, attachment?.height]);
  const mediaWidth = Math.min(280, Math.max(210, width * 0.72));
  const mediaHeight = mediaWidth / ratio;
  const player = useVideoPlayer(videoSource, p => { p.loop = false; });

  useEffect(() => {
    let active = true;
    if (!attachment?.thumbnail_available) { setThumbnailLoading(false); return undefined; }
    setThumbnailLoading(true);
    downloadVideoThumbnail(attachment).then(file => { if (active) setThumbnail(file.uri); else if (file.exists) file.delete(); })
      .catch(() => { if (active) setThumbnailLoading(false); })
      .finally(() => { if (active) setThumbnailLoading(false); });
    return () => { active = false; };
  }, [attachment?.id, attachment?.thumbnail_available]);

  useEffect(() => {
    const statusSubscription = player.addListener('statusChange', event => {
      if (event.status === 'error') { setError('Video could not be played. Tap retry to try again.'); setPlaying(false); }
    });
    const playingSubscription = player.addListener('playingChange', event => setPlaying(Boolean(event.isPlaying)));
    return () => { statusSubscription.remove(); playingSubscription.remove(); };
  }, [player]);

  useEffect(() => {
    if (!videoSource) return;
    player.replaceAsync(videoSource).catch(() => setError('Video could not be loaded. Tap retry to try again.'));
  }, [videoSource]);

  const openVideo = async () => {
    setError('');
    if (!videoSource) {
      setDownloading(true);
      try {
        const file = await downloadAttachmentPreview(attachment);
        setVideoSource(file.uri);
      } catch (loadError) {
        setError(loadError.message || 'Video download failed. Check your connection and retry.');
        setDownloading(false);
        return;
      }
      setDownloading(false);
    }
    setPlayerOpen(true);
  };

  const retry = async () => {
    setError('');
    if (videoSource) { retryVideoPlayback(player, videoSource); return; }
    await openVideo();
  };

  useEffect(() => {
    if (playerOpen && videoSource) player.pause();
  }, [playerOpen, videoSource]);

  const closePlayer = () => { player.pause(); setPlayerOpen(false); };
  return <>
    <View style={[styles.videoShell, { width: mediaWidth, height: mediaHeight }]}>
      {thumbnail ? <Image source={{ uri: thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      {!thumbnail && local ? <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} /> : null}
      {!thumbnail && !local && !thumbnailLoading ? <View style={styles.videoFallback}><Text style={styles.videoFallbackIcon}>▶</Text><Text style={styles.videoFallbackText}>Video</Text></View> : null}
      {thumbnailLoading ? <View style={styles.thumbnailLoading}><ActivityIndicator color="#fff" /></View> : null}
      {error ? <View style={styles.videoErrorOverlay}><Text style={styles.videoError}>{error}</Text><Pressable onPress={retry} style={styles.retryButton}><Text style={styles.retryText}>Retry</Text></Pressable></View> : null}
      <Pressable style={styles.videoPlayOverlay} onPress={openVideo} accessibilityRole="button" accessibilityLabel={downloading ? 'Downloading video' : 'Play video'} disabled={downloading || Boolean(error)}>
        <View style={styles.videoPlay}><Text style={styles.videoPlayText}>{downloading ? '…' : '▶'}</Text></View>
      </Pressable>
      <View style={styles.videoMetaOverlay} pointerEvents="none">
        {downloading ? <Text style={styles.videoMeta}>{formatBytes(attachment?.file_size)} · Downloading…</Text> : !local && !videoSource ? <Text style={styles.videoMeta}>{formatBytes(attachment?.file_size)}{attachment?.duration_seconds ? ` · ${formatDuration(attachment.duration_seconds)}` : ''}</Text> : null}
      </View>
    </View>
    <Modal visible={playerOpen} animationType="fade" presentationStyle="fullScreen" onRequestClose={closePlayer}>
      <View style={styles.fullscreen}>
        <Pressable onPress={closePlayer} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close video"><Text style={styles.closeText}>×</Text></Pressable>
        <VideoView player={player} style={styles.fullscreenVideo} contentFit="contain" nativeControls fullscreenOptions={{ enable: true }} />
      </View>
    </Modal>
  </>;
}

function AttachmentApproval({ attachment, showActions = false }) {
  const [statuses, setStatuses] = useState({ DOWNLOAD: null, FORWARD: null });
  const [senderRequests, setSenderRequests] = useState([]);
  const request = async requestType => {
    try {
      const result = await apiClient.post('v1/attachment-requests/request', { attachment_id: attachment.id, request_type: requestType });
      setStatuses(current => ({ ...current, [requestType]: result.data?.status || 'PENDING' }));
    } catch (e) { Alert.alert('Approval request', e.message || 'Unable to request approval.'); }
  };
  const respond = async (requestId, status) => {
    try { await apiClient.post('v1/attachment-requests/respond', { request_id: requestId, status }); setSenderRequests(items => items.filter(item => Number(item.request_id) !== Number(requestId))); }
    catch (e) { Alert.alert('Approval response', e.message || 'Unable to update request.'); }
  };
  useEffect(() => { let active = true; apiClient.get('v1/attachment-requests').then(result => { if (active) setSenderRequests((result.data?.requests || []).filter(item => Number(item.attachment_id) === Number(attachment.id))); }).catch(() => {}); return () => { active = false; }; }, [attachment.id]);
  const statusLabel = status => status === 'APPROVED' ? 'Approved' : status === 'DENIED' ? 'Rejected' : status === 'PENDING' ? 'Request Pending' : null;
  if (!showActions && !senderRequests.length && !Object.values(statuses).some(Boolean)) return null;
  return <View style={styles.approvalBox}><View style={styles.approvalActions}>{(['DOWNLOAD', 'FORWARD']).map(type => <View key={type} style={styles.approvalAction}>{statusLabel(statuses[type]) ? <Text style={[styles.approvalStatus, statuses[type] === 'DENIED' && styles.rejected]}>{statusLabel(statuses[type])}</Text> : null}{statuses[type] !== 'APPROVED' && statuses[type] !== 'PENDING' ? <Pressable accessibilityRole="button" accessibilityLabel={type === 'DOWNLOAD' ? 'Request save or download' : 'Request forward'} hitSlop={8} style={styles.approvalIconButton} onPress={() => request(type)}><Text style={styles.approvalIcon}>{type === 'DOWNLOAD' ? '⇩' : '↗'}</Text></Pressable> : null}</View>)}</View>{senderRequests.map(item => <View key={item.request_id} style={styles.senderApproval}><Text style={styles.senderApprovalText}>{item.requester_name || 'A recipient'} requested {String(item.request_type || 'DOWNLOAD').toLowerCase()} access.</Text><View style={styles.approvalActions}><Pressable onPress={() => respond(item.request_id, 'APPROVED')}><Text style={styles.link}>Approve</Text></Pressable><Pressable onPress={() => respond(item.request_id, 'DENIED')}><Text style={styles.rejectLink}>Reject</Text></Pressable></View></View>)}</View>;
}

function MediaMessageContent({ message, autoDownload, colors = {}, textScale = 1, showActions = false }) {
  const { width } = useWindowDimensions();
  const mediaWidth = Math.min(280, Math.max(210, width * 0.72));
  const [requested, setRequested] = useState(false);
  const [pollOptions, setPollOptions] = useState(message.poll?.options || []);
  const [pollBusy, setPollBusy] = useState(false);
  const [source, setSource] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const attachment = message.attachment;
  const messageTextStyle = { color: colors.text || '#172033', fontSize: 15 * textScale };
  const actionTextStyle = { color: colors.text || '#3157d5' };
  const canForward = ['text', 'forwarded_text'].includes(message.type);
  const profileAction = showActions && Number(message.show_profile) === 1 && message.sender_id ? <Pressable accessibilityRole="button" accessibilityLabel={`View ${message.sender_name || 'sender'} profile`} hitSlop={8} style={styles.compactAction} onPress={() => setProfileOpen(true)}><Text style={[styles.compactActionIcon, actionTextStyle]}>◉</Text></Pressable> : null;
  useEffect(() => { setPollOptions(message.poll?.options || []); }, [message.poll?.options]);
  const kind = attachmentKind(message.type, attachment);
  useEffect(() => { setRequested(false); setSource(null); setError(''); }, [attachment?.id]);
  useEffect(() => {
    if (!kind || !attachment?.id || kind === 'video' || (!autoDownload && !requested)) return undefined;
    let active = true; let previewFile = null; setError('');
    downloadAttachmentPreview(attachment).then(file => { previewFile = file; if (active) setSource(file.uri); else if (file.exists) file.delete(); }).catch(loadError => { if (active) setError(loadError.message || 'Preview unavailable.'); });
    return () => { active = false; if (previewFile?.exists) { try { previewFile.delete(); } catch {} } };
  }, [attachment?.id, kind, requested, autoDownload, reloadKey]);
  if (message.type === 'poll') {
    const pollId = Number(message.poll_id || message.poll?.id || 0);
    const vote = async optionId => { if (!pollId || pollBusy) return; setPollBusy(true); setError(''); try { const { data } = await apiClient.post('v1/polls', { poll_id: pollId, option_id: optionId }, { query: { action: 'vote' } }); if (Array.isArray(data.options)) setPollOptions(data.options); } catch (e) { setError(e.message || 'Unable to save vote.'); } finally { setPollBusy(false); } };
    return <View style={[styles.pollCard, { width: mediaWidth }]}><Text style={[styles.pollQuestion, messageTextStyle]}>📊 {message.poll?.question || 'Poll'}</Text>{pollOptions.map(option => <Pressable key={option.id} disabled={pollBusy || Boolean(message.poll?.expires_at && parseMessageTimestamp(message.poll.expires_at) <= new Date())} onPress={() => vote(option.id)} style={[styles.pollOption, option.selected && styles.pollOptionSelected]}><Text style={styles.pollOptionText}>{option.text}</Text><Text style={styles.pollVotes}>{option.votes || 0}{option.selected ? ' ✓' : ''}</Text></Pressable>)}{message.poll?.expires_at ? <Text style={styles.meta}>Expires {parseMessageTimestamp(message.poll.expires_at).toLocaleString()}</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}{profileAction}</View>;
  }
  if (message.type === 'location') { const location = parseSharedLocation(message.body); return location ? <View><Pressable onPress={() => Linking.openURL(location.url).catch(() => setError('Unable to open maps.'))} accessibilityRole="link"><Text style={[styles.link, actionTextStyle]}>📍 {location.label}</Text><Text style={messageTextStyle}>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</Text><Text style={[styles.link, actionTextStyle]}>Open in maps ↗</Text>{error ? <Text>{error}</Text> : null}</Pressable>{profileAction}</View> : <View><Text style={messageTextStyle}>Location unavailable</Text>{profileAction}</View>; }
  if (!attachment) return <Pressable onLongPress={canForward ? () => setForwardOpen(true) : undefined}><View>{message.type === 'forwarded_text' ? <Text style={[styles.forwardedLabel, { color: colors.secondary || '#64748b' }]}>Forwarded</Text> : null}<Text style={[styles.text, messageTextStyle]}>{message.body || ''}</Text>{showActions ? <View style={styles.inlineActions}>{profileAction}{canForward ? <Pressable accessibilityRole="button" accessibilityLabel="Forward message" hitSlop={8} style={styles.compactAction} onPress={() => setForwardOpen(true)}><Text style={[styles.compactActionIcon, actionTextStyle]}>↗</Text></Pressable> : null}</View> : null}<ForwardMessageModal visible={forwardOpen} message={message} onClose={() => setForwardOpen(false)} /><UserProfileModal visible={profileOpen} userId={message.sender_id} fallbackName={message.sender_name} onClose={() => setProfileOpen(false)} /></View></Pressable>;
  return <View>{error && kind !== 'video' ? <View><Text style={styles.error}>{error}</Text><Pressable onPress={() => { setSource(null); setError(''); setRequested(true); setReloadKey(value => value + 1); }} style={styles.control}><Text style={styles.link}>Try preview again</Text></Pressable></View> : source ? kind === 'audio' ? <AudioPreview source={source} /> : kind === 'image' ? <><Pressable accessibilityRole="button" accessibilityLabel="Open image full screen" onPress={() => setImageOpen(true)}><Image source={{ uri: source }} style={[styles.image, { width: mediaWidth, height: Math.min(mediaWidth * 1.25, width * 0.92) }]} resizeMode="contain" onError={() => setError('Image preview could not be displayed.')} /></Pressable><Modal visible={imageOpen} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setImageOpen(false)}><View style={styles.fullscreen}><Pressable onPress={() => setImageOpen(false)} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close image"><Text style={styles.closeText}>×</Text></Pressable><Image source={{ uri: source }} style={styles.fullscreenImage} resizeMode="contain" /></View></Modal></> : <View style={styles.documentCard}><Text style={styles.documentIcon}>▤</Text><Text numberOfLines={2} style={styles.documentName}>{attachment.name || 'Document'}</Text><Pressable style={styles.documentButton} onPress={() => setRequested(true)}><Text style={styles.link}>Preview document</Text></Pressable></View> : kind === 'video' ? <VideoPreview attachment={attachment} /> : kind ? <Pressable onPress={() => setRequested(true)} style={styles.previewPlaceholder}><Text style={styles.previewIcon}>{kind === 'audio' ? '♫' : '▤'}</Text><Text style={styles.previewLabel}>{kind === 'audio' ? 'Audio' : 'Document'}</Text></Pressable> : null}{profileAction}{kind ? <AttachmentApproval attachment={attachment} showActions={showActions} /> : null}</View>;
}

export default function MediaMessage({ message, autoDownload, colors, textScale, isVisible = true, showActions = false }) { return <ReadReceipt message={message} isVisible={isVisible} showStatus={showActions}><MediaMessageContent message={message} autoDownload={autoDownload} colors={colors} textScale={textScale} showActions={showActions} /></ReadReceipt>; }

const styles = StyleSheet.create({
  pollCard: { maxWidth: '100%' }, pollQuestion: { color: '#172033', fontWeight: '800', fontSize: 15, marginBottom: 8 }, pollOption: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 6, borderWidth: 1, borderColor: '#d8deea', borderRadius: 10, backgroundColor: '#fff' }, pollOptionSelected: { borderColor: '#3157d5', backgroundColor: '#eef2ff' }, pollOptionText: { color: '#172033', flex: 1 }, pollVotes: { color: '#3157d5', fontWeight: '800', marginLeft: 8 },
  approvalBox: { marginTop: 6 }, approvalActions: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' }, approvalAction: { minWidth: 34 }, approvalIconButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, approvalIcon: { color: '#3157d5', fontSize: 18, fontWeight: '800' }, approvalStatus: { color: '#166534', fontSize: 11, fontWeight: '800', marginBottom: 4 }, rejected: { color: '#b91c1c' }, senderApproval: { marginTop: 6, padding: 8, borderRadius: 8, backgroundColor: '#fff7ed' }, senderApprovalText: { color: '#7c2d12', fontSize: 11, marginBottom: 4 },
  error: { color: '#b91c1c', marginTop: 6 }, control: { paddingVertical: 12 }, link: { color: '#3157d5', fontWeight: '700' }, rejectLink: { color: '#b91c1c', fontWeight: '700' }, text: { color: '#172033', fontSize: 15 }, meta: { color: '#68748a', fontSize: 11, marginVertical: 6 }, forwardedLabel: { marginBottom: 3, color: '#64748b', fontSize: 10, fontWeight: '800' }, forwardLink: { marginTop: 5, alignSelf: 'flex-start' }, profileLink: { marginTop: 5, alignSelf: 'flex-start' }, profileLinkText: { color: '#3157d5', fontSize: 11, fontWeight: '700' }, inlineActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 }, compactAction: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, compactActionIcon: { color: '#3157d5', fontSize: 16, fontWeight: '800', lineHeight: 20 },
  audioCard: { minWidth: 210, maxWidth: 280, minHeight: 58, padding: 10, borderRadius: 12, backgroundColor: '#eef2ff', flexDirection: 'row', alignItems: 'center' }, audioButton: { width: 38, height: 38, borderRadius: 19, textAlign: 'center', textAlignVertical: 'center', backgroundColor: '#3157d5', color: '#fff', fontWeight: '800', fontSize: 18 }, audioCopy: { marginLeft: 10 }, audioTitle: { color: '#172033', fontWeight: '700' }, audioTime: { color: '#68748a', fontSize: 11, marginTop: 2 },
  videoShell: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#10131a', position: 'relative', alignSelf: 'flex-start' }, videoFallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }, videoFallbackIcon: { color: '#fff', fontSize: 36 }, videoFallbackText: { color: '#dbe3f5', fontWeight: '700', marginTop: 4 }, videoPlayOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }, videoPlay: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 2 }, videoPlayText: { color: '#172033', fontSize: 28, paddingLeft: 4 }, videoMetaOverlay: { position: 'absolute', left: 10, right: 10, bottom: 8, alignItems: 'flex-start' }, videoMeta: { color: '#fff', backgroundColor: 'rgba(0,0,0,.55)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, fontSize: 11, overflow: 'hidden' }, thumbnailLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#172033' }, videoErrorOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.72)', alignItems: 'center', justifyContent: 'center', padding: 14 }, videoError: { color: '#fff', textAlign: 'center', fontSize: 12 }, retryButton: { marginTop: 8, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 }, retryText: { color: '#172033', fontWeight: '800' }, fullscreen: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }, fullscreenVideo: { width: '100%', height: '100%' }, fullscreenImage: { width: '100%', height: '100%' }, closeButton: { position: 'absolute', top: 44, left: 18, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,.65)', alignItems: 'center', justifyContent: 'center' }, closeText: { color: '#fff', fontSize: 30, lineHeight: 34 },
  previewPlaceholder: { width: 230, height: 140, borderRadius: 10, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' }, previewIcon: { fontSize: 32, color: '#3157d5' }, previewLabel: { marginTop: 4, color: '#3157d5', fontWeight: '700' }, image: { borderRadius: 10, backgroundColor: '#f4f6fa' }, documentCard: { width: 230, minHeight: 100, padding: 12, borderRadius: 10, backgroundColor: '#f4f6fa' }, documentIcon: { fontSize: 28, color: '#3157d5' }, documentName: { color: '#172033', fontWeight: '700', marginVertical: 5 }, documentButton: { paddingVertical: 4 },
});
