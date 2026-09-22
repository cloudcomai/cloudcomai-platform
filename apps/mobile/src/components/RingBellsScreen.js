import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import RingBellsStatus from './RingBellsStatus';

export default function RingBellsScreen({ onBack }) {
  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to chats" style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
          <Text style={styles.backLabel}>Chats</Text>
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Ring Bells</Text>
          <Text style={styles.subtitle}>Temporary updates</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <RingBellsStatus />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0F172A' },
  header: { minHeight: 64, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#0B1B33', borderBottomWidth: 1, borderBottomColor: '#1e3a5f' },
  backButton: { width: 76, flexDirection: 'row', alignItems: 'center' },
  backText: { color: '#F8FAFC', fontSize: 32, lineHeight: 32 },
  backLabel: { marginLeft: 2, color: '#A9BCE0', fontSize: 13, fontWeight: '700' },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { color: '#F8FAFC', fontSize: 18, fontWeight: '900' },
  subtitle: { marginTop: 2, color: '#A9BCE0', fontSize: 10, fontWeight: '600' },
  headerSpacer: { width: 76 },
  body: { flex: 1, backgroundColor: '#0F172A' },
  content: { paddingBottom: 28 },
});
