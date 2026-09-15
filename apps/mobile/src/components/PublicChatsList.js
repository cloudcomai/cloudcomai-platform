import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { platformApi } from '../services/platform';

const formatRoomStats = room => `👥 ${Number(room?.joined_count || 0)} Joined · 🟢 ${Number(room?.online_count || 0)} Online`;

export default function PublicChatsList({ onOpenChat }) {
  const [rooms, setRooms] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionRoomId, setActionRoomId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false, silent = false, search = query) => {
    if (!silent) refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const { data } = await platformApi.listPublicChats({ query: { q: search.trim() } });
      const nextRooms = Array.isArray(data.rooms) ? data.rooms : [];
      setRooms(nextRooms);
      setFavorites(Array.isArray(data.favorites) ? data.favorites : nextRooms.filter(room => room.joined));
      setSelected(current => current && nextRooms.some(room => Number(room.id) === Number(current.id))
        ? nextRooms.find(room => Number(room.id) === Number(current.id)) : current);
    } catch (e) {
      if (!silent) setError(e.message || 'Unable to load rooms');
    } finally {
      if (!silent) { setLoading(false); setRefreshing(false); }
    }
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => load(false, false, query), query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [query, load]);

  useEffect(() => {
    const timer = setInterval(() => load(false, true), 10000);
    return () => clearInterval(timer);
  }, [load]);

  const openRoom = room => {
    if (!room?.id || actionRoomId) return;
    if (!room.joined) return joinRoom(room);
    onOpenChat?.({ id: Number(room.id), type: 'public', name: room.name, isPublic: true, isGroup: false });
  };

  const joinRoom = async room => {
    if (!room?.id || actionRoomId) return;
    setActionRoomId(Number(room.id)); setError('');
    try {
      const { data } = await platformApi.joinPublicChat(Number(room.id));
      const joined = { ...room, joined: true };
      setRooms(current => current.map(item => Number(item.id) === Number(room.id) ? { ...item, joined: true } : item));
      setFavorites(current => [joined, ...current.filter(item => Number(item.id) !== Number(room.id))]);
      setSelected(joined); setOpen(false);
      onOpenChat?.({ ...(data.chat || joined), id: Number(room.id), type: 'public', isPublic: true, isGroup: false });
    } catch (e) { setError(e.message || 'Unable to join public chat room.'); }
    finally { setActionRoomId(null); }
  };

  const leaveRoom = room => {
    if (!room?.id || actionRoomId) return;
    Alert.alert('Leave this room?', 'Are you sure you want to leave this public chat room?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave Room', style: 'destructive', onPress: async () => {
        setActionRoomId(Number(room.id)); setError('');
        try {
          await platformApi.leavePublicChat(Number(room.id));
          const update = item => Number(item.id) === Number(room.id) ? { ...item, joined: false } : item;
          setRooms(current => current.map(update));
          setFavorites(current => current.filter(item => Number(item.id) !== Number(room.id)));
          if (Number(selected?.id) === Number(room.id)) { setSelected(null); setOpen(false); }
        } catch (e) { setError(e.message || 'Unable to leave public chat room.'); }
        finally { setActionRoomId(null); }
      } },
    ]);
  };

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? rooms.filter(room => String(room.name || '').toLowerCase().includes(term)) : rooms;
  }, [rooms, query]);

  const renderRoom = ({ item, favorite = false }) => <Pressable style={styles.roomRow} onPress={() => openRoom(item)} disabled={Boolean(actionRoomId)}>
    <View style={styles.cityIcon}><Text style={styles.cityIconText}>{item.name?.[0] || 'I'}</Text></View>
    <View style={styles.roomMeta}><Text style={styles.roomName}>{item.name}</Text><Text style={styles.roomSub}>{formatRoomStats(item)}</Text></View>
    {item.joined ? <Text style={styles.joined}>{favorite ? 'Joined' : 'Joined'}</Text> : <Text style={styles.roomAction}>Join</Text>}
  </Pressable>;

  if (loading) return <View style={styles.loadingWrap}><ActivityIndicator color="#3157d5" /><Text style={styles.loadingText}>Loading public chat rooms…</Text></View>;

  return <View style={styles.container}>
    <Text style={styles.heading}>Public Chats</Text>
    <Text style={styles.description}>Join an India city or town room. Public messages expire after 4 hours by default.</Text>
    <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search Public Chat Rooms" placeholderTextColor="#7f8aa3" autoCapitalize="none" returnKeyType="search" />
    {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text><Pressable onPress={() => load()}><Text style={styles.retry}>Retry</Text></Pressable></View> : null}

    <Text style={styles.sectionTitle}>Favorites</Text>
    {favorites.length ? <FlatList data={favorites} keyExtractor={item => `fav-${item.id}`} renderItem={({ item }) => renderRoom({ item, favorite: true })} style={styles.favoriteList} />
      : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No joined rooms yet</Text><Text style={styles.emptyText}>Join a public chat room and it will appear here for quick access.</Text></View>}

    <Text style={styles.sectionTitle}>Public Chat Rooms</Text>
    <Pressable style={styles.dropdown} onPress={() => setOpen(value => !value)} accessibilityRole="button">
      <View style={styles.dropdownText}><Text style={styles.dropdownLabel}>India city & town rooms</Text><Text style={styles.dropdownValue}>{selected?.name || 'Select a public chat room'}</Text>{selected ? <Text style={styles.selectedStats}>{formatRoomStats(selected)}</Text> : null}</View>
      <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
    </Pressable>
    {open ? <FlatList
      data={filtered}
      keyExtractor={item => String(item.id)}
      style={styles.menu}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      renderItem={renderRoom}
      ListEmptyComponent={<View style={styles.emptyCard}><Text style={styles.emptyTitle}>No rooms found</Text><Text style={styles.emptyText}>Try searching with a different room name.</Text></View>}
    /> : <View style={styles.selectedArea}>{selected
      ? <><Pressable style={styles.selectedRoom} onPress={() => openRoom(selected)} disabled={Boolean(actionRoomId)}><Text style={styles.selectedRoomName}>{selected.name}</Text><Text style={styles.selectedRoomSub}>{formatRoomStats(selected)}</Text></Pressable><Pressable style={styles.leaveButton} onPress={() => leaveRoom(selected)} disabled={Boolean(actionRoomId)}><Text style={styles.leaveButtonText}>{actionRoomId === Number(selected.id) ? 'Leaving…' : 'Leave Room'}</Text></Pressable></>
      : <FlatList data={filtered} keyExtractor={item => String(item.id)} renderItem={renderRoom} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />} ListEmptyComponent={<View style={styles.emptyCard}><Text style={styles.emptyTitle}>No rooms found</Text><Text style={styles.emptyText}>Try searching with a different room name.</Text></View>} />}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 14, backgroundColor: '#fff' }, loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }, loadingText: { color: '#68748a', fontSize: 12 },
  heading: { color: '#172033', fontSize: 20, fontWeight: '800', marginBottom: 4 }, description: { color: '#68748a', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  searchInput: { minHeight: 48, marginBottom: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#d8deea', borderRadius: 12, color: '#172033', backgroundColor: '#fbfcff' },
  errorCard: { marginBottom: 10, padding: 10, borderRadius: 8, backgroundColor: '#fee2e2' }, error: { color: '#b91c1c' }, retry: { marginTop: 7, color: '#3157d5', fontWeight: '800' },
  sectionTitle: { marginTop: 4, marginBottom: 7, color: '#172033', fontSize: 15, fontWeight: '800' }, favoriteList: { maxHeight: 150, marginBottom: 4 },
  emptyCard: { padding: 18, marginBottom: 8, borderRadius: 12, backgroundColor: '#f8faff', borderWidth: 1, borderColor: '#e2e7f0' }, emptyTitle: { color: '#172033', fontWeight: '800', textAlign: 'center' }, emptyText: { marginTop: 5, color: '#718096', textAlign: 'center', lineHeight: 19 },
  dropdown: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: '#d8deea', borderRadius: 12, backgroundColor: '#f8faff' }, dropdownText: { flex: 1, minWidth: 0 }, dropdownLabel: { color: '#68748a', fontSize: 10, fontWeight: '700' }, dropdownValue: { marginTop: 4, color: '#172033', fontSize: 15, fontWeight: '700' }, selectedStats: { marginTop: 4, color: '#5b6577', fontSize: 11, fontWeight: '700' }, chevron: { color: '#3157d5', fontSize: 24, paddingLeft: 10 },
  menu: { marginTop: 8, maxHeight: 300, borderWidth: 1, borderColor: '#e2e7f0', borderRadius: 12, backgroundColor: '#fff' }, roomRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#edf0f5' }, cityIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff' }, cityIconText: { color: '#3157d5', fontWeight: '800' }, roomMeta: { flex: 1, minWidth: 0, marginLeft: 10 }, roomName: { color: '#172033', fontSize: 14, fontWeight: '800' }, roomSub: { marginTop: 3, color: '#5b6577', fontSize: 11, fontWeight: '700' }, roomAction: { color: '#3157d5', fontWeight: '800', fontSize: 12 }, joined: { color: '#166534', fontWeight: '800', fontSize: 12 },
  selectedArea: { flex: 1, paddingTop: 8 }, selectedRoom: { padding: 16, borderRadius: 12, backgroundColor: '#f8faff', borderWidth: 1, borderColor: '#e2e7f0' }, selectedRoomName: { color: '#172033', fontSize: 16, fontWeight: '800' }, selectedRoomSub: { marginTop: 5, color: '#5b6577', fontSize: 12, fontWeight: '700' }, leaveButton: { marginTop: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff7f7' }, leaveButtonText: { color: '#b91c1c', fontSize: 13, fontWeight: '800' },
});
