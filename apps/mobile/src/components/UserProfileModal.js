import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mediaUrl, platformApi } from '../services/platform';

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

export default function UserProfileModal({ visible, userId, fallbackName, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);

  useEffect(() => {
    if (!visible || !userId) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    setImageFailed(false);
    setImagePreviewVisible(false);
    platformApi.getUserProfile(userId)
      .then(({ data }) => { if (active) setProfile(data.user || null); })
      .catch(loadError => { if (active) setError(loadError.message || 'Unable to load this profile.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible, userId, reloadKey]);

  useEffect(() => {
    if (!visible) {
      setProfile(null);
      setError('');
      setImageFailed(false);
      setImagePreviewVisible(false);
    }
  }, [visible]);

  const name = profile?.name || fallbackName || 'CloudComAI user';
  const imageSource = profile?.id
    ? `${mediaUrl('user', profile.id)}&v=${profile.image_version || ''}`
    : '';
  const canPreviewImage = Boolean(imageSource && !imageFailed);

  return (
    <Modal visible={Boolean(visible)} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.page} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close profile">
            <Text style={styles.headerLink}>‹ Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>User profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? <ActivityIndicator style={styles.loader} color="#3157d5" /> : error ? (
          <View style={styles.errorCard}>
            <Text style={styles.error}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => setReloadKey(value => value + 1)}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : profile ? (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.profileCard}>
              <Pressable
                style={({ pressed }) => [styles.avatar, pressed && canPreviewImage && styles.avatarPressed]}
                onPress={() => { if (canPreviewImage) setImagePreviewVisible(true); }}
                disabled={!canPreviewImage}
                accessibilityRole={canPreviewImage ? 'button' : undefined}
                accessibilityLabel={canPreviewImage ? `View ${name}'s profile picture` : undefined}
              >
                {!imageFailed && imageSource ? (
                  <Image source={{ uri: imageSource }} style={styles.avatarImage} onError={() => setImageFailed(true)} />
                ) : null}
                <Text style={styles.avatarFallback}>{name[0]?.toUpperCase() || 'U'}</Text>
              </Pressable>
              <Text style={styles.name}>{name}</Text>
              {profile.user_id ? <Text style={styles.userId}>@{profile.user_id}</Text> : null}
            </View>

            <View style={styles.detailsCard}>
              <DetailRow label="Age" value={profile.hidden_fields?.includes('age') ? 'Private' : profile.age == null ? 'Not set' : String(profile.age)} />
              <DetailRow label="Gender" value={profile.hidden_fields?.includes('gender') ? 'Private' : profile.gender || 'Not set'} />
              {profile.email ? <DetailRow label="Email" value={profile.email} /> : null}
              {profile.mobile ? <DetailRow label="Contact" value={profile.mobile} /> : null}
              {!profile.email && !profile.mobile ? (
                <Text style={styles.optionalNote}>Email and contact details are not shared.</Text>
              ) : null}
            </View>
          </ScrollView>
        ) : null}

        <Modal
          visible={imagePreviewVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setImagePreviewVisible(false)}
        >
          <View style={styles.previewBackdrop}>
            <Pressable
              style={styles.previewCloseArea}
              onPress={() => setImagePreviewVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Close profile picture preview"
            >
              <Text style={styles.previewClose}>×</Text>
            </Pressable>
            {canPreviewImage ? (
              <Image
                source={{ uri: imageSource }}
                style={styles.previewImage}
                resizeMode="contain"
                accessibilityLabel={`${name}'s profile picture`}
              />
            ) : null}
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f7fb' },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, backgroundColor: '#3157d5' },
  headerLink: { color: '#fff', fontWeight: '700', minWidth: 54 },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSpacer: { width: 54 },
  loader: { marginTop: 60 },
  content: { padding: 18, gap: 14 },
  profileCard: { alignItems: 'center', padding: 24, borderRadius: 18, backgroundColor: '#fff' },
  avatar: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#e5eaff' },
  avatarPressed: { opacity: 0.8 },
  avatarImage: { ...StyleSheet.absoluteFillObject, width: 112, height: 112, zIndex: 2 },
  avatarFallback: { color: '#3157d5', fontSize: 38, fontWeight: '900' },
  name: { marginTop: 14, color: '#172033', fontSize: 23, fontWeight: '900', textAlign: 'center' },
  userId: { marginTop: 4, color: '#64748b', fontSize: 13 },
  detailsCard: { paddingHorizontal: 18, borderRadius: 18, backgroundColor: '#fff' },
  detailRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#edf0f5' },
  detailLabel: { width: 82, color: '#64748b', fontSize: 13, fontWeight: '700' },
  detailValue: { flex: 1, color: '#172033', fontSize: 15, fontWeight: '600' },
  optionalNote: { paddingVertical: 18, color: '#64748b', lineHeight: 19, textAlign: 'center' },
  errorCard: { margin: 18, padding: 18, alignItems: 'center', borderRadius: 14, backgroundColor: '#fff' },
  error: { color: '#b91c1c', textAlign: 'center' },
  retryButton: { marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: '#eef2ff' },
  retryText: { color: '#3157d5', fontWeight: '800' },
  previewBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.92)', padding: 18 },
  previewImage: { width: '100%', height: '82%' },
  previewCloseArea: { position: 'absolute', top: 22, right: 18, zIndex: 2, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  previewClose: { color: '#fff', fontSize: 38, lineHeight: 42, fontWeight: '300' },
});
