import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, LayoutAnimation, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { platformApi } from '../services/platform';

const formatRoomStats = room => `👥 ${Number(room?.joined_count || 0)} Joined · 🟢 ${Number(room?.online_count || 0)} Online`;
const searchableRoomText = room => [room?.name, room?.city, room?.category, room?.group_category, room?.description, room?.keywords].filter(Boolean).join(' ').toLowerCase();

export default function PublicChatsList({ onOpenChat }) {
  const [rooms, setRooms] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [query, setQuery] = useState('');
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [publicRoomsOpen, setPublicRoomsOpen] = useState(true);
  const [languageRoomsOpen, setLanguageRoomsOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionRoomId, setActionRoomId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false, silent = false, search = query) => {
    if (!silent) refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const { data } = await platformApi.listPublicChats({ query: { q: search.trim() } });
      setRooms(Array.isArray(data.rooms) ? data.rooms : []);
      setFavorites(Array.isArray(data.favorites) ? data.favorites : []);
    } catch (e) {
      if (!silent) setError(e.message || 'Unable to load public chat rooms');
    } finally {
      if (!silent) { setLoading(false); setRefreshing(false); }
    }
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => load(false, false, query), query ? 200 : 0);
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
      setRooms(current => current.map(item => Number(item.id) === Number(room.id) ? joined : item));
      setFavorites(current => [joined, ...current.filter(item => Number(item.id) !== Number(room.id))]);
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
          setRooms(current => current.map(item => Number(item.id) === Number(room.id) ? { ...item, joined: false } : item));
          setFavorites(current => current.filter(item => Number(item.id) !== Number(room.id)));
        } catch (e) { setError(e.message || 'Unable to leave public chat room.'); }
        finally { setActionRoomId(null); }
      } },
    ]);
  };

  const filteredRooms = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rooms;
    return rooms.filter(room => searchableRoomText(room).includes(term));
  }, [rooms, query]);

  const cityRooms = useMemo(() => filteredRooms.filter(room => (room.room_type || 'city') === 'city'), [filteredRooms]);
  const languageRooms = useMemo(() => filteredRooms.filter(room => room.room_type === 'language'), [filteredRooms]);
  const toggleSection = setter => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setter(value => !value);
  };

  const renderRoom = ({ item, favorite = false }) => (
    <Pressable style={styles.roomRow} onPress={() => openRoom(item)} disabled={Boolean(actionRoomId)} accessibilityRole="button">
      <View style={styles.roomIcon}><Text style={styles.roomIconText}>{item.name?.[0]?.toUpperCase() || 'P'}</Text></View>
      <View style={styles.roomMeta}>
        <Text numberOfLines={1} style={styles.roomName}>{item.name}</Text>
        <Text numberOfLines={1} style={styles.roomSub}>{formatRoomStats(item)}</Text>
      </View>
      {item.joined ? <Text style={styles.joined}>{favorite ? 'Joined' : 'Joined'}</Text> : <Text style={styles.roomAction}>{actionRoomId === Number(item.id) ? 'Joining…' : 'Join'}</Text>}
    </Pressable>
  );

  if (loading && !rooms.length && !query) {
    return <View style={styles.loadingWrap}><ActivityIndicator color="#3157d5" /><Text style={styles.loadingText}>Loading public chat rooms…</Text></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <View style={styles.titleMeta}>
          <Text style={styles.heading}>Public Chats</Text>
          <Text style={styles.description}>Browse city, town and language rooms</Text>
        </View>
        <Text style={styles.roomCount}>{filteredRooms.length}</Text>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search room, city, language, category or keyword"
          placeholderTextColor="#7f8aa3"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Search public chat rooms"
        />
      </View>

      {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text><Pressable onPress={() => load()}><Text style={styles.retry}>Retry</Text></Pressable></View> : null}

      <Pressable style={[styles.favoritesControl, favoritesOpen && styles.favoritesControlOpen]} onPress={() => setFavoritesOpen(value => !value)} accessibilityRole="button" accessibilityState={{ expanded: favoritesOpen }}>
        <View style={styles.favoriteIcon}><Text style={styles.favoriteIconText}>★</Text></View>
        <View style={styles.favoriteMeta}><Text style={styles.favoriteTitle}>Favorites</Text><Text style={styles.favoriteCount}>{favorites.length} {favorites.length === 1 ? 'room' : 'rooms'}</Text></View>
        <Text style={styles.chevron}>{favoritesOpen ? '⌃' : '⌄'}</Text>
      </Pressable>

      {favoritesOpen ? (
        <View style={styles.favoritesPanel}>
          {favorites.length ? <FlatList
            data={favorites}
            keyExtractor={item => `fav-${item.id}`}
            renderItem={({ item }) => renderRoom({ item, favorite: true })}
            style={styles.favoritesList}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          /> : <View style={styles.emptyFavorite}><Text style={styles.emptyTitle}>No favorite rooms yet</Text><Text style={styles.emptyText}>Join a public room and it will appear here for quick access.</Text></View>}
        </View>
      ) : null}

      <Pressable
        style={[styles.sectionHeader, publicRoomsOpen && styles.sectionHeaderOpen]}
        onPress={() => toggleSection(setPublicRoomsOpen)}
        accessibilityRole="button"
        accessibilityState={{ expanded: publicRoomsOpen }}
      >
        <Text style={styles.roomsTitle}>Public Chat Rooms</Text>
        <Text style={styles.sectionChevron}>{publicRoomsOpen ? '⌃' : '⌄'}</Text>
      </Pressable>

      {publicRoomsOpen ? (
        <View style={styles.sectionPanel}>
          <Text style={styles.roomsHint}>{cityRooms.length ? 'Tap a room to open' : 'No matching city rooms'}</Text>
          <FlatList
            data={cityRooms}
            keyExtractor={item => String(item.id)}
            renderItem={renderRoom}
            style={styles.roomList}
            contentContainerStyle={styles.roomListContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
            ListEmptyComponent={<View style={styles.emptyCard}><Text style={styles.emptyTitle}>No city rooms found</Text><Text style={styles.emptyText}>Try a different room name, city, category, or keyword.</Text></View>}
          />
        </View>
      ) : null}

      <Pressable
        style={[styles.sectionHeader, languageRoomsOpen && styles.sectionHeaderOpen, styles.languageSectionHeader]}
        onPress={() => toggleSection(setLanguageRoomsOpen)}
        accessibilityRole="button"
        accessibilityState={{ expanded: languageRoomsOpen }}
      >
        <Text style={styles.roomsTitle}>Language Chat Rooms</Text>
        <Text style={styles.sectionChevron}>{languageRoomsOpen ? '⌃' : '⌄'}</Text>
      </Pressable>

      {languageRoomsOpen ? (
        <View style={styles.sectionPanel}>
          <FlatList
            data={languageRooms}
            keyExtractor={item => String(item.id)}
            renderItem={renderRoom}
            style={styles.languageRoomList}
            contentContainerStyle={styles.roomListContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<View style={styles.emptyCard}><Text style={styles.emptyTitle}>No language rooms found</Text><Text style={styles.emptyText}>Try a language name such as Telugu or French.</Text></View>}
          />
        </View>
      ) : null}

      {!filteredRooms.length ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No rooms found</Text><Text style={styles.emptyText}>Try a different room name, city, language, category, or keyword.</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, position: 'absolute', top: -166, bottom: 0, left: 0, right: 0, zIndex: 20, elevation: 20, paddingHorizontal: 12, paddingTop: 8, backgroundColor: '#fff' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#68748a', fontSize: 12 },
  titleRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  titleMeta: { flex: 1, minWidth: 0 },
  heading: { color: '#172033', fontSize: 20, fontWeight: '800' },
  description: { marginTop: 2, color: '#68748a', fontSize: 11 },
  sectionHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: '#e1e6ef', borderRadius: 12, backgroundColor: '#fff' },
  sectionHeaderOpen: { borderColor: '#cbd6f6', backgroundColor: '#f8faff' },
  languageSectionHeader: { marginTop: 10 },
  sectionChevron: { paddingHorizontal: 7, color: '#3157d5', fontSize: 22, fontWeight: '700' },
  sectionPanel: { marginTop: 6, overflow: 'hidden', borderWidth: 1, borderColor: '#e1e6ef', borderRadius: 12, backgroundColor: '#fff' },
  roomCount: { minWidth: 30, height: 30, paddingHorizontal: 8, borderRadius: 15, textAlign: 'center', textAlignVertical: 'center', color: '#3157d5', backgroundColor: '#eef2ff', fontSize: 11, fontWeight: '800' },
  searchWrap: { minHeight: 46, flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#d5dceb', borderRadius: 12, backgroundColor: '#f8faff' },
  searchIcon: { marginRight: 8, color: '#3157d5', fontSize: 22, fontWeight: '700' },
  searchInput: { flex: 1, minWidth: 0, minHeight: 44, paddingVertical: 0, color: '#172033', fontSize: 13 },
  errorCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: 9, borderRadius: 9, backgroundColor: '#fee2e2' },
  error: { flex: 1, color: '#b91c1c', fontSize: 12 },
  retry: { marginLeft: 10, color: '#3157d5', fontWeight: '800' },
  favoritesControl: { minHeight: 48, flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#e1e6ef', borderRadius: 12, backgroundColor: '#fff' },
  favoritesControlOpen: { borderColor: '#cbd6f6', backgroundColor: '#f8faff' },
  favoriteIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff' },
  favoriteIconText: { color: '#3157d5', fontSize: 14 },
  favoriteMeta: { flex: 1, minWidth: 0, marginLeft: 9 },
  favoriteTitle: { color: '#172033', fontSize: 13, fontWeight: '800' },
  favoriteCount: { marginTop: 1, color: '#68748a', fontSize: 10 },
  chevron: { paddingHorizontal: 7, color: '#3157d5', fontSize: 22, fontWeight: '700' },
  favoritesPanel: { maxHeight: 230, marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e1e6ef', borderRadius: 12, backgroundColor: '#fff' },
  favoritesList: { flexGrow: 0 },
  emptyFavorite: { padding: 14 },
  roomsHeader: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roomsTitle: { color: '#172033', fontSize: 14, fontWeight: '800' },
  roomsHint: { color: '#7a8497', fontSize: 10 },
  roomList: { maxHeight: 330, minHeight: 0 },
  languageRoomList: { maxHeight: 520, minHeight: 0 },
  roomListContent: { paddingBottom: 12 },
  roomRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, borderBottomWidth: 1, borderBottomColor: '#edf0f5', backgroundColor: '#fff' },
  roomIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff' },
  roomIconText: { color: '#3157d5', fontSize: 15, fontWeight: '800' },
  roomMeta: { flex: 1, minWidth: 0, marginLeft: 10 },
  roomName: { color: '#172033', fontSize: 14, fontWeight: '800' },
  roomSub: { marginTop: 3, color: '#5b6577', fontSize: 10, fontWeight: '700' },
  roomAction: { minWidth: 42, textAlign: 'right', color: '#3157d5', fontSize: 12, fontWeight: '800' },
  joined: { minWidth: 48, textAlign: 'right', color: '#166534', fontSize: 11, fontWeight: '800' },
  emptyCard: { marginTop: 10, padding: 20, borderRadius: 12, backgroundColor: '#f8faff', borderWidth: 1, borderColor: '#e2e7f0' },
  emptyTitle: { color: '#172033', fontWeight: '800', textAlign: 'center' },
  emptyText: { marginTop: 5, color: '#718096', fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
