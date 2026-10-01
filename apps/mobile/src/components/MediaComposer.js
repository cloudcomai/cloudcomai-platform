import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as ScreenCapture from 'expo-screen-capture';
import { File } from 'expo-file-system';
import { platformApi, uploadAttachmentAsset, cancelActiveAttachmentUpload } from '../services/platform';
import { withAppLockExternalActivity } from '../utils/appLockActivity';
import { AudioPreview, VideoPreview } from './MediaMessage';

const CHAT_SCREEN_CAPTURE_KEY = 'cloudcomai-chat';

export default function MediaComposer({ chat, onMessage }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);
  const [busy, setBusy] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [draft, setDraft] = useState(null);
  const cancelRequested = useRef(false);
  const active = useRef(true);
  const stopping = useRef(false);
  const recordingUri = useRef(null);
  const disabled = Boolean(chat.blocked || busy || state.isRecording || draft);
  const removeRecording = () => { if (recordingUri.current) { try { const file = new File(recordingUri.current); if (file.exists) file.delete(); } catch {} recordingUri.current = null; } };
  const stop = async () => {
    if (stopping.current) return;
    stopping.current = true;
    try { await recorder.stop(); await setAudioModeAsync({ allowsRecording: false }); if (active.current && recorder.uri) { recordingUri.current = recorder.uri; setDraft({ uri: recorder.uri, name: `voice-${Date.now()}.m4a`, mimeType: 'audio/mp4', type: 'voice' }); } }
    catch (error) { if (active.current) Alert.alert('Recording failed', error.message); }
    finally { stopping.current = false; }
  };
  useEffect(() => { if (state.isRecording && state.durationMillis >= 30000) stop(); }, [state.isRecording, state.durationMillis]);
  useEffect(() => { active.current = true; const subscription = AppState.addEventListener('change', next => { if (next !== 'active' && recorder.isRecording) stop(); }); return () => { active.current = false; subscription.remove(); removeRecording(); setAudioModeAsync({ allowsRecording: false }).catch(() => {}); }; }, [recorder]);

  useEffect(() => {
    let mounted = true;
    const enableProtection = async () => {
      try {
        // expo-screen-capture applies Android's native FLAG_SECURE and the
        // supported iOS capture prevention APIs before protected chat content
        // can be captured.
        await ScreenCapture.preventScreenCaptureAsync(CHAT_SCREEN_CAPTURE_KEY);
        if (Platform.OS === 'ios' && mounted) await ScreenCapture.enableAppSwitcherProtectionAsync(0.5);
      } catch {}
    };
    enableProtection();
    return () => {
      mounted = false;
      ScreenCapture.allowScreenCaptureAsync(CHAT_SCREEN_CAPTURE_KEY).catch(() => {});
      if (Platform.OS === 'ios') ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => {});
    };
  }, []);

  const recordVoice = async () => {
    if (disabled) return;
    setBusy('permission');
    setUploadError('');
    try { const permission = await AudioModule.requestRecordingPermissionsAsync(); if (!permission.granted) throw new Error('Allow microphone access to record voice messages.'); if (!active.current) return; await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }); await recorder.prepareToRecordAsync(); if (active.current) recorder.record(); }
    catch (error) { if (active.current) Alert.alert('Microphone unavailable', error.message); }
    finally { if (active.current) setBusy(''); }
  };

  const chooseVideo = async camera => {
    if (disabled) return;
    setBusy('video');
    setUploadError('');
    try {
      const result = await withAppLockExternalActivity(async () => {
        if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Allow camera access to record video.');
        const options = { mediaTypes: ['videos'], videoMaxDuration: 60, videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium };
        return camera ? ImagePicker.launchCameraAsync(options) : ImagePicker.launchImageLibraryAsync(options);
      });
      if (!active.current || result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize > 25 * 1024 * 1024) throw new Error('Videos must be 25 MB or smaller. Choose a shorter or lower-quality video.');
      const extension = asset.uri.split('.').pop()?.split('?')[0] || 'mp4';
      setDraft({ uri: asset.uri, name: asset.fileName || `video-${Date.now()}.${extension}`, mimeType: asset.mimeType || (extension === 'mov' ? 'video/quicktime' : 'video/mp4'), type: 'video', width: Number(asset.width || 0), height: Number(asset.height || 0), durationSeconds: Number(asset.duration || 0) > 0 ? Number(asset.duration) / 1000 : 0, fileSize: Number(asset.fileSize || 0) });
    } catch (error) { if (active.current) Alert.alert('Video unavailable', error.message); }
    finally { if (active.current) setBusy(''); }
  };

  const send = async () => {
    if (!draft || busy) return;
    setBusy('upload');
    cancelRequested.current = false;
    setUploadError('');
    setUploadProgress(0);
    try {
      const { data } = await uploadAttachmentAsset(draft, {
        chat_id: chat.id,
        message_type: draft.type,
        download_policy: 'APPROVAL_REQUIRED',
        video_width: draft.width || undefined,
        video_height: draft.height || undefined,
        video_duration_seconds: draft.durationSeconds || undefined,
        onProgress: setUploadProgress,
        onCancelAvailable: cancel => {
          if (cancelRequested.current && cancel) cancel();
        },
        multipartPartMode: 'native',
      });
      if (active.current) { setUploadProgress(1); onMessage(data.message); setDraft(null); removeRecording(); }
    } catch (error) {
      if (active.current) {
        if (error?.code === 'UPLOAD_CANCELLED') {
          setUploadProgress(0);
          setUploadError('');
          setDraft(null);
          removeRecording();
        } else {
          setUploadError(error?.message || 'The media upload failed. Please try again.');
        }
      }
    } finally { if (active.current) setBusy(''); }
  };

  const shareLocation = async () => {
    if (disabled) return;
    setBusy('location');
    try { if (!(await Location.requestForegroundPermissionsAsync()).granted) throw new Error('Allow location access to share your current location.'); const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); if (!active.current) return; const { data } = await platformApi.shareLocation(chat.id, position.coords.latitude, position.coords.longitude, 'Current location'); if (active.current) onMessage(data.message); }
    catch (error) { if (active.current) Alert.alert('Unable to share location', error.message); }
    finally { if (active.current) setBusy(''); }
  };

  return <View>
    <View style={styles.row}>
      <Pressable disabled={disabled && !state.isRecording} onPress={state.isRecording ? stop : recordVoice} style={styles.button}><Text style={styles.link}>{state.isRecording ? `Stop · ${Math.floor(state.durationMillis / 1000)}s` : 'Voice'}</Text></Pressable>
      <Pressable disabled={disabled} onPress={() => Alert.alert('Video message', 'Record or choose a video (up to 25 MB).', [{ text: 'Record', onPress: () => chooseVideo(true) }, { text: 'Choose video', onPress: () => chooseVideo(false) }, { text: 'Cancel', style: 'cancel' }])} style={styles.button}><Text style={styles.link}>Video</Text></Pressable>
      <Pressable disabled={disabled} onPress={shareLocation} style={styles.button}><Text style={styles.link}>{busy === 'location' ? 'Locating…' : 'Location'}</Text></Pressable>
    </View>
    <Modal visible={Boolean(draft)} transparent animationType="slide" onRequestClose={() => { if (!busy) { setDraft(null); setUploadError(''); removeRecording(); } }}>
      <View style={styles.overlay}><View style={styles.card}><Text style={styles.title}>Preview your message</Text>
        {draft && (draft.type === 'voice' ? <AudioPreview source={draft.uri} /> : <VideoPreview source={draft.uri} local />)}
        {busy === 'upload' ? <View style={styles.progressBox}><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(uploadProgress * 100)}%` }]} /></View><Text style={styles.progressText}>Sending media… {Math.round(uploadProgress * 100)}%</Text></View> : null}
        {uploadError ? <View style={styles.errorBox}><Text style={styles.errorText}>{uploadError}</Text><Pressable onPress={send} disabled={Boolean(busy)} style={styles.retryButton}><Text style={styles.retryText}>Retry</Text></Pressable></View> : null}
        <View style={styles.row}><Pressable disabled={Boolean(busy)} onPress={send} style={styles.button}><Text style={styles.link}>{busy === 'upload' ? 'Sending…' : 'Send'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={busy === 'upload' ? 'Cancel media upload' : 'Cancel media'} accessibilityState={{ disabled: false }} hitSlop={8} onPress={() => { if (busy === 'upload') { cancelRequested.current = true; cancelActiveAttachmentUpload(); } else { setDraft(null); setUploadError(''); removeRecording(); } }} style={styles.button}><Text style={[styles.link, busy === 'upload' && styles.cancelActive]}>Cancel</Text></Pressable></View>
      </View></View>
    </Modal>
  </View>;
}
