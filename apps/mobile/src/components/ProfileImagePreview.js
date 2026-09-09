import React, { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export default function ProfileImagePreview({ source, fallback, label = 'Profile photo', size = 96, imageStyle, onPreviewChange }) {
  const [visible, setVisible] = useState(false);
  const open = () => {
    if (!source) return;
    setVisible(true);
    onPreviewChange?.(true);
  };
  const close = () => {
    setVisible(false);
    onPreviewChange?.(false);
  };

  return (
    <>
      <Pressable
        disabled={!source}
        onPress={open}
        accessibilityRole={source ? 'button' : undefined}
        accessibilityLabel={source ? `Preview ${label}` : label}
        style={[styles.thumbnail, { width: size, height: size, borderRadius: size / 2 }]}
      >
        {source ? <Image source={{ uri: source }} style={[StyleSheet.absoluteFillObject, { width: size, height: size, borderRadius: size / 2 }, imageStyle]} /> : null}
        {fallback ? <Text style={styles.fallback}>{fallback}</Text> : null}
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={close} accessibilityLabel="Close photo preview" />
          <Image source={{ uri: source }} style={styles.preview} resizeMode="contain" />
          <Pressable style={styles.close} onPress={close} accessibilityRole="button">
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  thumbnail: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#e5eaff' },
  fallback: { color: '#3157d5', fontSize: 30, fontWeight: '900' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000e' },
  preview: { width: '92%', height: '72%' },
  close: { position: 'absolute', top: 50, right: 20, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: '#fff' },
  closeText: { color: '#172033', fontWeight: '800' },
});
