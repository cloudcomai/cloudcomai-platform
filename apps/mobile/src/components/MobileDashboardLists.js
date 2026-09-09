import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { platformApi } from '../services/platform';
import { setApplicationBadge } from '../services/notifications';
import { loadMobileContacts } from '../utils/contacts';

export function ContactsList({ onOpenChat }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const contacts = await loadMobileContacts(platformApi, 1, 500);
      setItems(contacts);
    } catch (e) {
      setError(e.message || 'Unable to load People & Contacts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openContact = async contact => {
    try {
      const { data } = await platformApi.createPrivateChat(contact.registered_user_id);
      if (data.chat) onOpenChat?.({ ...data.chat, id: Number(data.chat.id), isGroup: false });
    } catch (e) {
      setError(e.message || 'Unable to start private chat.');
    }
  };

  const openNotification = async item => {
    try {
      if (!item.read_at) {
        await platformApi.markNotificationsRead({ notification_ids: [Number(item.id)] });
        setItems(current => current.map(entry => Number(entry.id) === Number(item.id) ? { ...entry, read_at: new Date().toISOString() } : entry));
        const next = Math.max(0, unread - 1);
        setUnread(next);
        setApplicationBadge(next);
      }
      if (item.data?.chat_id) onOpenChat?.(Number(item.data.chat_id));
    } catch (e) {
      setError(e.message || 'Unable to open notification.');
    }
  };

  if (loading) return <ActivityIndicator style={styles.loader} color="#3157d5" />;

  return (
    <>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={item => String(item.registered_user_id || item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        contentContainerStyle={items.length ? styles.list : styles.empty}
        ListEmptyComponent={<Text style={styles.emptyText}>No registered CloudComAI contacts found. Connect and sync Google Contacts from the menu or Settings.</Text>}
        renderItem={({ item }) => {
          const title = item.display_name || item.registered_name || item.email || item.phone || 'CloudComAI contact';
          return (
            <Pressable style={styles.row} onPress={() => openContact(item)}>
              <View style={styles.avatar}>
                {item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.avatarImage} /> : null}
                <Text style={styles.avatarText}>{title[0]?.toUpperCase() || 'C'}</Text>
              </View>
              <View style={styles.meta}>
                <Text style={styles.title}>{title}</Text>
                <Text numberOfLines={1} style={styles.sub}>{item.registered_user_id_text ? `@${item.registered_user_id_text}` : (item.email || item.phone || 'Registered contact')}</Text>
              </View>
              {item.online ? <View style={styles.onlineDot} /> : null}
            </Pressable>
          );
        }}
      />
    </>
  );
}

export function NotificationsList({ onOpenChat }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const { data } = await platformApi.listNotifications({ query: { limit: 100 } });
      setItems(data.notifications || []);
      const count = Number(data.unread_count || 0);
      setUnread(count);
      setApplicationBadge(count);
    } catch (e) {
      setError(e.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markAllRead = async () => {
    try {
      await platformApi.markNotificationsRead({ all: true });
      setItems(current => current.map(item => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
      setUnread(0);
      setApplicationBadge(0);
    } catch (e) {
      setError(e.message || 'Unable to mark notifications as read.');
    }
  };

  if (loading) return <ActivityIndicator style={styles.loader} color="#3157d5" />;

  return (
    <>
      <View style={styles.notificationHeader}>
        <Text style={styles.notificationTitle}>Notifications{unread ? ` · ${unread} unread` : ''}</Text>
        {unread > 0 ? <Pressable onPress={markAllRead}><Text style={styles.link}>Mark all read</Text></Pressable> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        contentContainerStyle={items.length ? styles.list : styles.empty}
        ListEmptyComponent={<Text style={styles.emptyText}>No notifications yet.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.notificationRow, !item.read_at && styles.unreadRow]}
            onPress={() => openNotification(item)}
          >
            <View style={[styles.notificationDot, item.read_at && styles.notificationDotRead]} />
            <View style={styles.meta}>
              <Text style={styles.title}>{item.title || 'CloudComAI'}</Text>
              <Text style={styles.sub}>{item.body || item.category || 'Notification'}</Text>
              <Text style={styles.timeText}>{formatTime(item.created_at)} · {item.read_at ? 'Read' : 'New'}</Text>
            </View>
          </Pressable>
        )}
      />
    </>
  );
}

function formatTime(value) {
  if (!value) return '';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

const styles = StyleSheet.create({
  loader: { marginTop: 50 },
  list: { paddingHorizontal: 12, paddingBottom: 110 },
  empty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: '#718096', textAlign: 'center', lineHeight: 20 },
  error: { margin: 12, padding: 10, borderRadius: 8, color: '#b91c1c', backgroundColor: '#fee2e2' },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#edf0f5', backgroundColor: '#fff' },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#eef2ff' },
  avatarImage: { ...StyleSheet.absoluteFillObject, width: 48, height: 48, zIndex: 2 },
  avatarText: { color: '#3157d5', fontWeight: '800', fontSize: 18 },
  meta: { flex: 1, minWidth: 0, marginLeft: 12 },
  title: { color: '#172033', fontWeight: '800', fontSize: 15 },
  sub: { marginTop: 4, color: '#6b7280', fontSize: 12 },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e' },
  notificationHeader: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#edf0f5' },
  notificationTitle: { color: '#172033', fontWeight: '800' },
  link: { color: '#3157d5', fontWeight: '700', fontSize: 12 },
  notificationRow: { minHeight: 78, flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderBottomWidth: 1, borderBottomColor: '#edf0f5', backgroundColor: '#fff' },
  unreadRow: { backgroundColor: '#f6f8ff' },
  notificationDot: { width: 9, height: 9, marginTop: 6, borderRadius: 5, backgroundColor: '#3157d5' },
  notificationDotRead: { backgroundColor: '#cbd5e1' },
  timeText: { marginTop: 5, color: '#94a3b8', fontSize: 10 },
});
