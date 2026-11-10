import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { getAvatarInitial, getAvatarPalette } from '@cloudcomai/chat-core';

export default function ContactAvatar({ userId, name, username, imageUri, size = 48 }) {
  const [failedUri, setFailedUri] = useState(null);
  const palette = getAvatarPalette(userId || username || name);
  const showImage = Boolean(imageUri) && failedUri !== imageUri;

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: palette.backgroundColor }]}>
      {showImage ? (
        <Image
          key={imageUri}
          source={{ uri: imageUri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
          onError={() => setFailedUri(imageUri)}
        />
      ) : (
        <Text style={[styles.initial, { color: palette.textColor, fontSize: Math.round(size * 0.38) }]}>
          {getAvatarInitial(name, username)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { fontWeight: '800', textAlign: 'center' },
});
