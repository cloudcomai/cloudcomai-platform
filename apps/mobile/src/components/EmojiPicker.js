import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { EMOJI_CATEGORIES, searchEmojiItems } from '@cloudcomai/chat-core';

export default function EmojiPicker({ theme, onSelect, onDelete, onClose }) {
  const [category, setCategory] = useState('smileys');
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState([]);
  const active = EMOJI_CATEGORIES.find(item => item.id === category) || EMOJI_CATEGORIES[1];
  const items = useMemo(() => searchEmojiItems(query ? EMOJI_CATEGORIES.slice(1).flatMap(item => item.emojis) : (category === 'recent' ? recent : active.emojis), query), [active, category, query, recent]);
  const colors = theme?.colors || {};
  const background = colors.composer || '#171b29';
  const border = colors.border || '#343b4e';
  const text = colors.text || '#f4f6fb';
  const secondary = colors.secondary || '#aab2c4';
  return <View style={[styles.panel, { backgroundColor: background, borderColor: border }]}>
    <View style={styles.top}>
      <Text style={{ color: secondary, fontSize: 19 }}>⌕</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search emoji" placeholderTextColor={secondary} style={[styles.search, { color: text }]} accessibilityLabel="Search emoji" />
      <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel="Delete last character" style={styles.utility}><Text style={{ color: secondary, fontSize: 20 }}>⌫</Text></Pressable>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close emoji picker" style={styles.utility}><Text style={{ color: secondary, fontSize: 24 }}>×</Text></Pressable>
    </View>
    <FlatList data={items} keyExtractor={item => item[0] + item[1]} numColumns={8} keyboardShouldPersistTaps="always" style={styles.grid} contentContainerStyle={styles.gridContent} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={item[1]} onPress={() => { onSelect?.(item[0]); setRecent(current => [[item[0], item[1]], ...current.filter(entry => entry[0] !== item[0])].slice(0, 32)); }} style={({ pressed }) => [styles.cell, pressed && { backgroundColor: colors.background || '#252c3c' }]}><Text style={styles.emoji}>{item[0]}</Text></Pressable>} ListEmptyComponent={<Text style={{ color: secondary, padding: 18 }}>No matching emoji found.</Text>} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
      {EMOJI_CATEGORIES.map(item => <Pressable key={item.id} onPress={() => { setCategory(item.id); setQuery(''); }} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: category === item.id && !query }} style={[styles.category, category === item.id && !query && { borderBottomColor: colors.accent || '#758cff', borderBottomWidth: 3 }]}><Text style={styles.categoryIcon}>{item.icon}</Text></Pressable>)}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  panel: { width: '100%', height: 290, borderTopWidth: 1, borderBottomWidth: 1, overflow: 'hidden' },
  top: { height: 46, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#4b5264', gap: 7 },
  search: { flex: 1, minWidth: 0, paddingVertical: 7, fontSize: 14 },
  utility: { width: 32, height: 38, alignItems: 'center', justifyContent: 'center' },
  grid: { flex: 1 },
  gridContent: { paddingHorizontal: 5, paddingVertical: 7 },
  cell: { width: '12.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  emoji: { fontSize: 27 },
  categories: { height: 48, alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 3, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#4b5264' },
  category: { minWidth: 39, height: 46, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  categoryIcon: { fontSize: 20 },
});
