import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  InteractionManager,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { platformApi } from '../services/platform';
import { setApplicationBadge } from '../services/notifications';
import { getNotificationChatId } from '../utils/notificationNavigation';
import { loadMobileContacts } from '../utils/contacts';

export function ContactsList({ onOpenChat }) {
  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const [contacts, friendRequests] = await Promise.all([
        loadMobileContacts(platformApi, 1, 500),
        platformApi.listFriendRequests(),
      ]);
      setItems(contacts);
      setRequests(friendRequests.data?.incoming || []);
    } catch (e) {
      setError(e.message || 'Unable to load People & Contacts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const respond = async (request, action) => {
    if (!request?.id || actionId !== null) return;
    setActionId(Number(request.id));
    setError('');
    try {
      await platformApi.respondToFriendRequest(Number(request.id), action);
      setRequests(current => current.filter(item => Number(item.id) !== Number(request.id)));
    } catch (e) {
      setError(e.message || 'Unable to update friend request.');
    } finally {
      setActionId(null);
    }
  };

  const openContact = async contact => {
    try {
      const { data } = await platformApi.createPrivateChat(contact.registered_user_id);
      if (data.chat) onOpenChat?.({ ...data.chat, id: Number(data.chat.id), isGroup: false });
    } catch (e) {
      setError(e.message || 'Unable to start private chat.');
    }
  };

  if (loading) return <ActivityIndicator style={styles.loader} color="#3157d5" />;

  return (
    <>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {requests.length ? (
        <View style={styles.requestsCard}>
          <View style={styles.requestsHeader}>
            <Text style={styles.requestsTitle}>Friend requests</Text>
            <Text style={styles.requestsCount}>{requests.length}</Text>
          </View>
          {requests.map(request => {
            const busy = Number(request.id) === actionId;
            const title = request.name || request.username || 'CloudComAI user';
            return (
              <View key={request.id} style={styles.requestRow}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{title[0]?.toUpperCase() || 'U'}</Text></View>
                <View style={styles.meta}>
                  <Text style={styles.title}>{title}</Text>
                  <Text style={styles.sub}>{request.username ? `@${request.username}` : 'Wants to add you as a friend/contact'}</Text>
                </View>
                <View style={styles.requestActions}>
                  <Pressable disabled={actionId !== null} onPress={() => respond(request, 'accept')} style={styles.acceptButton}><Text style={styles.acceptText}>{busy ? '…' : 'Accept'}</Text></Pressable>
                  <Pressable disabled={actionId !== null} onPress={() => respond(request, 'decline')} style={styles.declineButton}><Text style={styles.declineText}>Decline</Text></Pressable>
                  <Pressable disabled={actionId !== null} onPress={() => respond(request, 'block')} style={styles.blockButton}><Text style={styles.blockText}>Block</Text></Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
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
  const [openingId, setOpeningId] = useState(null);
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

  const setRead = async (item, read = true) => {
    const { data } = await platformApi.markNotificationsRead({ notification_ids: [Number(item.id)], read });
    setItems(current => current.map(entry => Number(entry.id) === Number(item.id) ? { ...entry, read_at: read ? new Date().toISOString() : null } : entry));
    setUnread(Number(data.unread_count || 0));
    setApplicationBadge(data.unread_count);
  };

  const markAllRead = async () => {
    try {
      const { data } = await platformApi.markNotificationsRead({ all: true });
      setItems(current => current.map(item => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
      setUnread(Number(data.unread_count || 0));
      setApplicationBadge(data.unread_count);
    } catch (e) {
      setError(e.message || 'Unable to mark notifications as read.');
    }
  };

  const openNotification = async item => {
    const chatId = getNotificationChatId(item);
    if (openingId !== null) return;
    setError('');
    setOpeningId(Number(item.id));
    try {
      if (!item.read_at) {
        await setRead(item);
      }
      if (!chatId) {
        setError('This notification does not contain a conversation to open.');
        return;
      }
      // Wait until the native list press interaction has completed before replacing
      // the dashboard with ChatDetail. This avoids navigating during a FlatList
      // touch transition, which can leave Android with a blank native surface.
      await new Promise(resolve => InteractionManager.runAfterInteractions(resolve));
      await onOpenChat?.(chatId);
    } catch (e) {
      setError(e.message || 'Unable to open notification chat.');
    } finally {
      setOpeningId(null);
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
        renderItem={({ item }) => {
          const opening = Number(item.id) === openingId;
          return (
            <Pressable
              style={[styles.notificationRow, !item.read_at && styles.unreadRow]}
              onPress={() => openNotification(item)}
              onLongPress={() => setRead(item, Boolean(item.read_at)).catch(e => setError(e.message))}
              accessibilityHint="Tap to open. Long press to toggle read or unread."
              disabled={openingId !== null}
              accessibilityRole="button"
              accessibilityLabel={item.title || 'Notification'}
              accessibilityState={{ busy: opening }}
            >
              <View style={[styles.notificationDot, item.read_at && styles.notificationDotRead]} />
              <View style={styles.meta}>
                <Text style={styles.title}>{item.title || 'CloudComAI'}</Text>
                <Text style={styles.sub}>{item.body || item.category || 'Notification'}</Text>
                <Text style={styles.timeText}>{formatTime(item.created_at)} · {item.read_at ? 'Read' : 'New'}</Text>
              </View>
              {opening ? <ActivityIndicator size="small" color="#3157d5" /> : null}
            </Pressable>
          );
        }}
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
  list: { paddingHorizontal: 12, paddingBottom: 24 },
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
  requestsCard: { margin: 12, padding: 12, borderRadius: 14, backgroundColor: '#f8faff', borderWidth: 1, borderColor: '#dbe4ff' },
  requestsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  requestsTitle: { color: '#172033', fontWeight: '900', fontSize: 15 },
  requestsCount: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3157d5', color: '#fff', textAlign: 'center', fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  requestRow: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  requestActions: { width: 102, marginLeft: 8, gap: 4 },
  acceptButton: { minHeight: 28, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: '#3157d5' },
  acceptText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  declineButton: { minHeight: 28, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: '#e5eaf4' },
  declineText: { color: '#475569', fontSize: 10, fontWeight: '800' },
  blockButton: { minHeight: 28, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: '#fee2e2' },
  blockText: { color: '#b91c1c', fontSize: 10, fontWeight: '800' },
  notificationHeader: { minHeight: 48, flexWrap: 'wrap', gap: 8, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#edf0f5' },
  notificationTitle: { color: '#172033', fontWeight: '800' },
  link: { color: '#3157d5', fontWeight: '700', fontSize: 12 },
  notificationRow: { minHeight: 78, flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderBottomWidth: 1, borderBottomColor: '#edf0f5', backgroundColor: '#fff' },
  unreadRow: { backgroundColor: '#f6f8ff' },
  notificationDot: { width: 9, height: 9, marginTop: 6, borderRadius: 5, backgroundColor: '#3157d5' },
  notificationDotRead: { backgroundColor: '#cbd5e1' },
  timeText: { marginTop: 5, color: '#94a3b8', fontSize: 10 },
});
