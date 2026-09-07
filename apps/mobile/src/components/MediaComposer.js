import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { File } from 'expo-file-system';
import { platformApi } from '../services/platform';
import { AudioPreview, VideoPreview } from './MediaMessage';

export default function MediaComposer({ chat, onMessage }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);
  const [busy, setBusy] = useState('');
  const [draft, setDraft] = useState(null);
  const active = useRef(true);
  const stopping = useRef(false);
  const recordingUri = useRef(null);
  const disabled = Boolean(chat.blocked || busy || state.isRecording || draft);
  const removeRecording = () => {
    if (recordingUri.current) { try { const file = new File(recordingUri.current); if (file.exists) file.delete(); } catch {} recordingUri.current = null; }
  };
  const stop = async () => {
    if (stopping.current) return;
    stopping.current = true;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (active.current && recorder.uri) {
        recordingUri.current = recorder.uri;
        setDraft({ uri: recorder.uri, name: `voice-${Date.now()}.m4a`, mimeType: 'audio/mp4', type: 'voice' });
      }
    } catch (error) { if (active.current) Alert.alert('Recording failed', error.message); }
    finally { stopping.current = false; }
  };
  useEffect(() => { if (state.isRecording && state.durationMillis >= 30000) stop(); }, [state.isRecording, state.durationMillis]);
  useEffect(() => {
    active.current = true;
    const subscription = AppState.addEventListener('change', next => { if (next !== 'active' && recorder.isRecording) stop(); });
    return () => { active.current = false; subscription.remove(); removeRecording(); setAudioModeAsync({ allowsRecording: false }).catch(() => {}); };
  }, [recorder]);

  const recordVoice = async () => {
    if (disabled) return;
    setBusy('permission');
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error('Allow microphone access to record voice messages.');
      if (!active.current) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (active.current) recorder.record();
    } catch (error) { if (active.current) Alert.alert('Microphone unavailable', error.message); }
    finally { if (active.current) setBusy(''); }
  };
  const chooseVideo = async camera => {
    if (disabled) return;
    setBusy('video');
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Allow camera access to record video.');
      const options = { mediaTypes: ['videos'], videoMaxDuration: 60, videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!active.current || result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize > 25 * 1024 * 1024) throw new Error('Videos must be 25 MB or smaller.');
      const extension = asset.uri.split('.').pop()?.split('?')[0] || 'mp4';
      setDraft({ uri: asset.uri, name: asset.fileName || `video-${Date.now()}.${extension}`, mimeType: asset.mimeType || (extension === 'mov' ? 'video/quicktime' : 'video/mp4'), type: 'video' });
    } catch (error) { if (active.current) Alert.alert('Video unavailable', error.message); }
    finally { if (active.current) setBusy(''); }
  };
  const send = async () => {
    if (!draft || busy) return;
    setBusy('upload');
    try {
      const file = new File(draft.uri);
      if (file.size <= 0 || file.size > 25 * 1024 * 1024) throw new Error('Media must be between 1 byte and 25 MB.');
      const form = new FormData();
      form.append('chat_id', String(chat.id)); form.append('message_type', draft.type); form.append('download_policy', 'APPROVAL_REQUIRED');
      form.append('file', { uri: draft.uri, name: draft.name, type: draft.mimeType });
      const { data } = await platformApi.uploadAttachment(form);
      if (active.current) { onMessage(data.message); setDraft(null); removeRecording(); }
    } catch (error) { if (active.current) Alert.alert('Unable to send media', error.message); }
    finally { if (active.current) setBusy(''); }
  };
  const shareLocation = async () => {
    if (disabled) return;
    setBusy('location');
    try {
      if (!(await Location.requestForegroundPermissionsAsync()).granted) throw new Error('Allow location access to share your current location.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!active.current) return;
      const { data } = await platformApi.shareLocation(chat.id, position.coords.latitude, position.coords.longitude, 'Current location');
      if (active.current) onMessage(data.message);
    } catch (error) { if (active.current) Alert.alert('Unable to share location', error.message); }
    finally { if (active.current) setBusy(''); }
  };
  return <View>
    <View style={styles.row}>
      <Pressable disabled={disabled && !state.isRecording} onPress={state.isRecording ? stop : recordVoice} style={styles.button}><Text style={styles.link}>{state.isRecording ? `Stop · ${Math.floor(state.durationMillis / 1000)}s` : 'Voice'}</Text></Pressable>
      <Pressable disabled={disabled} onPress={() => Alert.alert('Video message', 'Record or choose a video (up to 25 MB).', [{ text: 'Record', onPress: () => chooseVideo(true) }, { text: 'Choose video', onPress: () => chooseVideo(false) }, { text: 'Cancel', style: 'cancel' }])} style={styles.button}><Text style={styles.link}>Video</Text></Pressable>
      <Pressable disabled={disabled} onPress={shareLocation} style={styles.button}><Text style={styles.link}>{busy === 'location' ? 'Locating…' : 'Location'}</Text></Pressable>
    </View>
    <Modal visible={Boolean(draft)} transparent animationType="slide" onRequestClose={() => { if (!busy) { setDraft(null); removeRecording(); } }}>
      <View style={styles.overlay}><View style={styles.card}><Text style={styles.title}>Preview your message</Text>
        {draft && (draft.type === 'voice' ? <AudioPreview source={draft.uri} /> : <VideoPreview source={draft.uri} />)}
        <View style={styles.row}><Pressable disabled={Boolean(busy)} onPress={send} style={styles.button}><Text style={styles.link}>{busy === 'upload' ? 'Sending…' : 'Send'}</Text></Pressable><Pressable disabled={Boolean(busy)} onPress={() => { setDraft(null); removeRecording(); }} style={styles.button}><Text style={styles.link}>Cancel</Text></Pressable></View>
      </View></View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 10, justifyContent: 'center', backgroundColor: '#fff' }, button: { padding: 12 }, link: { color: '#3157d5', fontWeight: '700' }, overlay: { flex: 1, backgroundColor: '#0008', alignItems: 'center', justifyContent: 'center' }, card: { backgroundColor: '#fff', padding: 24, borderRadius: 18, maxWidth: '95%' }, title: { fontSize: 18, fontWeight: '700', color: '#172033', marginBottom: 12 } });
