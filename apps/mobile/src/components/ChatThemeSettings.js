import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CHAT_THEMES, resetChatThemeSettings, setChatThemeSettings } from '../services/chatTheme';

const PREVIEW_MESSAGES = [
  { mine: false, text: 'Hello! How are you?' },
  { mine: true, text: 'I am doing great 😊' },
];
const ACCENTS = ['#3157d5', '#1675ad', '#347a4b', '#e96b58', '#7047b8', '#5b46d6', '#242424'];

export default function ChatThemeSettings({ value, onChange, onBack }) {
  const [settings, setSettings] = useState(value || { id: 'system', wallpaperOpacity: 0.35, textScale: 1 });
  const [busy, setBusy] = useState(false);

  useEffect(() => setSettings(value || { id: 'system', wallpaperOpacity: 0.35, textScale: 1 }), [value]);

  const save = async next => {
    setBusy(true);
    try {
      const persisted = await setChatThemeSettings(next);
      setSettings(persisted);
      onChange?.(persisted);
    } catch (error) {
      Alert.alert('Unable to save theme', error.message || 'Try again.');
    } finally { setBusy(false); }
  };

  const chooseWallpaper = async () => {
    if (busy) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.85 });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await save({ ...settings, id: 'wallpaper', wallpaperUri: result.assets[0].uri });
  };

  const reset = async () => {
    const next = await resetChatThemeSettings();
    setSettings(next);
    onChange?.(next);
  };

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back"><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.title}>Chat Theme</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>Choose how conversations look. Chat layout and features stay the same across every theme.</Text>
        <View style={styles.grid}>
          {Object.values(CHAT_THEMES).map(theme => {
            const selected = settings.id === theme.id;
            const c = theme.colors;
            return (
              <Pressable key={theme.id} style={[styles.card, selected && styles.cardSelected]} onPress={() => theme.id === 'wallpaper' ? chooseWallpaper() : save({ ...settings, id: theme.id })} disabled={busy}>
                <View style={[styles.preview, { backgroundColor: c.background }]}>
                  <View style={[styles.previewHeader, { backgroundColor: c.header }]} />
                  {PREVIEW_MESSAGES.map((message, index) => <View key={index} style={[styles.previewBubble, { alignSelf: message.mine ? 'flex-end' : 'flex-start', backgroundColor: message.mine ? c.outgoing : c.incoming }]}><Text style={{ color: c.text, fontSize: 8, fontWeight: '600' }}>{message.text}</Text></View>)}
                </View>
                <Text style={styles.cardLabel}>{theme.label}</Text>
                {selected ? <Text style={[styles.selected, { color: settings.accentColor || c.accent }]}>✓ Selected</Text> : null}
              </Pressable>
            );
          })}
        </View>
        {settings.id === 'wallpaper' && settings.wallpaperUri ? <View style={styles.wallpaperSection}>
          <Text style={styles.sectionTitle}>Current wallpaper</Text>
          <Image source={{ uri: settings.wallpaperUri }} style={styles.wallpaper} />
          <Text style={styles.sectionHelp}>Wallpaper overlay: {Math.round(Number(settings.wallpaperOpacity ?? 0.35) * 100)}%</Text>
          <View style={styles.adjustRow}>
            <Pressable style={styles.adjustButton} onPress={() => save({ ...settings, wallpaperOpacity: Math.max(0.1, Number(settings.wallpaperOpacity ?? 0.35) - 0.1) })}><Text style={styles.adjustText}>Brighter</Text></Pressable>
            <Pressable style={styles.adjustButton} onPress={() => save({ ...settings, wallpaperOpacity: Math.min(0.8, Number(settings.wallpaperOpacity ?? 0.35) + 0.1) })}><Text style={styles.adjustText}>Darker</Text></Pressable>
            <Pressable style={styles.adjustButton} onPress={chooseWallpaper}><Text style={styles.adjustText}>Change</Text></Pressable>
          </View>
        </View> : null}
        <View style={styles.options}>
          <Text style={styles.sectionTitle}>Additional settings</Text>
          <Text style={styles.sectionHelp}>Accent color changes outgoing bubbles and key chat controls.</Text>
          <View style={styles.accentRow}>{ACCENTS.map(accent => <Pressable key={accent} accessibilityLabel={`Use accent ${accent}`} onPress={() => save({ ...settings, accentColor: accent })} style={[styles.accentButton, { backgroundColor: accent }, settings.accentColor === accent && styles.accentSelected]} />)}</View>
          <View style={styles.optionRow}><Text style={styles.optionLabel}>Text size</Text><View style={styles.adjustRow}><Pressable style={styles.smallButton} onPress={() => save({ ...settings, textScale: Math.max(0.9, Number(settings.textScale || 1) - 0.1) })}><Text>−</Text></Pressable><Text style={styles.scale}>{Math.round(Number(settings.textScale || 1) * 100)}%</Text><Pressable style={styles.smallButton} onPress={() => save({ ...settings, textScale: Math.min(1.2, Number(settings.textScale || 1) + 0.1) })}><Text>＋</Text></Pressable></View></View>
          <Pressable style={styles.resetButton} onPress={reset}><Text style={styles.resetText}>Reset to Default</Text></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f7fb' },
  header: { minHeight: 62, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#3157d5' },
  back: { color: '#fff', fontWeight: '800', width: 58 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSpacer: { width: 58 },
  content: { padding: 16, paddingBottom: 32 },
  intro: { color: '#5f6b80', lineHeight: 20, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  card: { width: '48%', padding: 8, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e1e6ef' },
  cardSelected: { borderWidth: 2, borderColor: '#3157d5' },
  preview: { height: 94, borderRadius: 9, padding: 7, overflow: 'hidden' },
  previewHeader: { height: 10, borderRadius: 5, marginBottom: 8 },
  previewBubble: { maxWidth: '80%', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5, marginBottom: 5 },
  cardLabel: { color: '#172033', fontSize: 13, fontWeight: '800', marginTop: 8 },
  selected: { fontSize: 10, fontWeight: '800', marginTop: 3 },
  wallpaperSection: { marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: '#fff' },
  wallpaper: { width: '100%', height: 160, borderRadius: 10, marginVertical: 10 },
  sectionTitle: { color: '#172033', fontSize: 15, fontWeight: '800', marginBottom: 8 },
  sectionHelp: { color: '#536078', fontSize: 12, marginBottom: 8 },
  adjustRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  adjustButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 9, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  adjustText: { color: '#3157d5', fontWeight: '700', fontSize: 12 },
  options: { marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: '#fff' },
  accentRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 10 },
  accentButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#fff' },
  accentSelected: { borderColor: '#172033', transform: [{ scale: 1.12 }] },
  optionRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#edf0f5' },
  optionLabel: { color: '#172033', fontWeight: '700' },
  smallButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#eef2ff' },
  scale: { width: 50, textAlign: 'center', color: '#526078', fontWeight: '700' },
  resetButton: { minHeight: 44, marginTop: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#d8deea' },
  resetText: { color: '#b91c1c', fontWeight: '800' },
});
