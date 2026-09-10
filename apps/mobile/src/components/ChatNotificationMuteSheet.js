import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CHAT_MUTE_OPTIONS } from '../utils/chatMute';
import { platformApi } from '../services/platform';

export default function ChatNotificationMuteSheet({ visible, chatId, muted = false, mutedUntil = null, onClose, onChanged }) {
  const [selected, setSelected] = useState('10_hours');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) { setSelected('10_hours'); setError(''); }
  }, [visible]);

  const save = async muteFor => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { data } = await platformApi.updateChatNotificationState(chatId, { mute_for: muteFor });
      onChanged?.(data);
      onClose?.();
    } catch (e) { setError(e.message || 'Unable to update notification mute.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>{muted ? 'Muted notifications' : 'Mute notifications'}</Text>
          {muted && mutedUntil ? <Text style={styles.subtitle}>Muted until {new Date(`${mutedUntil.replace(' ', 'T')}Z`).toLocaleString()}</Text> : null}
          {!muted ? <>
            <Text style={styles.subtitle}>Choose how long this chat should stay quiet. Other members cannot see this setting.</Text>
            {CHAT_MUTE_OPTIONS.map(option => <Pressable key={option.key} disabled={busy} onPress={() => setSelected(option.key)} style={styles.option} accessibilityRole="radio" accessibilityState={{ selected: selected === option.key }}>
              <View style={[styles.radio, selected === option.key && styles.radioSelected]} />
              <Text style={styles.optionText}>{option.label}</Text>
            </Pressable>)}
            <Pressable disabled={busy} style={styles.primary} onPress={() => save(selected)}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Confirm</Text>}</Pressable>
          </> : <Pressable disabled={busy} style={styles.primary} onPress={() => save('off')}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Unmute notifications</Text>}</Pressable>}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable disabled={busy} onPress={onClose} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: { width: '100%', maxWidth: 380, padding: 20, borderRadius: 18, backgroundColor: '#fff' },
  title: { color: '#172033', fontSize: 19, fontWeight: '800' },
  subtitle: { marginTop: 8, marginBottom: 12, color: '#68748a', lineHeight: 19 },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#edf0f5' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#94a3b8' },
  radioSelected: { borderColor: '#3157d5', backgroundColor: '#3157d5' },
  optionText: { color: '#172033', fontSize: 15, fontWeight: '600' },
  primary: { minHeight: 46, marginTop: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#3157d5' },
  primaryText: { color: '#fff', fontWeight: '800' },
  cancel: { minHeight: 42, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#3157d5', fontWeight: '700' },
  error: { marginTop: 10, color: '#b91c1c' },
});
