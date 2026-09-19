import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { legalDocuments } from '../content/legalDocuments';

export default function LegalLinks() {
  const [selected, setSelected] = useState(null);
  const document = selected ? legalDocuments[selected] : null;
  return <View style={styles.links}>
    {Object.entries(legalDocuments).map(([id, entry]) => <Pressable key={id} accessibilityRole="button" onPress={() => setSelected(id)} style={styles.link}><Text style={styles.linkText}>{entry.title}</Text></Pressable>)}
    <Modal visible={Boolean(document)} animationType="slide" onRequestClose={() => setSelected(null)}>
      <SafeAreaProvider><SafeAreaView style={styles.page} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>{document?.title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close legal document" onPress={() => setSelected(null)} style={styles.link}><Text style={styles.linkText}>Close</Text></Pressable></View>
        <ScrollView contentContainerStyle={styles.content}>{document?.text.trim().split(/\n\s*\n/).map((block, index) => <Text key={index} selectable style={/^\d+\. /.test(block) ? styles.heading : styles.body}>{block}</Text>)}</ScrollView>
      </SafeAreaView></SafeAreaProvider>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({ links: { gap: 2, marginVertical: 8 }, link: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 }, linkText: { color: '#2446ac', fontWeight: '700' }, page: { flex: 1, backgroundColor: '#fff' }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#d8deea' }, title: { flex: 1, color: '#172033', fontSize: 19, fontWeight: '700' }, content: { padding: 20, gap: 16 }, heading: { color: '#172033', fontWeight: '700', fontSize: 18 }, body: { color: '#172033', fontSize: 16, lineHeight: 25 } });
