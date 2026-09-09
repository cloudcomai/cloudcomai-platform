import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { apiClient } from '../services/platform';

export default function PublicChatsList({ onOpenChat }) {
  const [rooms, setRooms] = useState([]);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('v1/public-chats');
      const nextRooms = Array.isArray(data.rooms) ? data.rooms.slice(0, 50) : [];
      setRooms(nextRooms);
      setSelected(current => current && nextRooms.some(room => Number(room.id) === Number(current.id)) ? current : null);
    } catch (e) {
      setError(e.message || 'Unable to load public chat rooms.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openRoom = async room => {
    if (!room?.id || joining) return;
    setJoining(true);
    setError('');
    try {
      const { data } = await apiClient.post('v1/public-chats', { room_id: Number(room.id) });
      const chat = data.chat || { id: Number(room.id), type: 'public', name: room.name, isPublic: true };
      setSelected({ ...room, joined: true });
      setRooms(current => current.map(item => Number(item.id) === Number(room.id) ? { ...item, joined: true } : item));
      setOpen(false);
      onOpenChat?.({ ...chat, id: Number(chat.id), isPublic: true, isGroup: false });
    } catch (e) {
      setError(e.message || 'Unable to join public chat room.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <ActivityIndicator style={styles.loader} color="#3157d5" />;

  return <View style={styles.container}>
    <Text style={styles.heading}>Public Chats</Text>
    <Text style={styles.description}>Join an India city or town room. Public messages expire after 4 hours by default.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Pressable style={styles.dropdown} onPress={() => setOpen(value => !value)} accessibilityRole="button">
      <View style={styles.dropdownText}>
        <Text style={styles.dropdownLabel}>India city & town rooms</Text>
        <Text style={styles.dropdownValue}>{selected?.name || 'Select a public chat room'}</Text>
      </View>
      <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
    </Pressable>
    {open ? <FlatList
      data={rooms}
      keyExtractor={item => String(item.id)}
      style={styles.menu}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      renderItem={({ item }) => <Pressable style={styles.roomRow} onPress={() => openRoom(item)} disabled={joining}>
        <View style={styles.cityIcon}><Text style={styles.cityIconText}>{item.name?.[0] || 'I'}</Text></View>
        <View style={styles.roomMeta}><Text style={styles.roomName}>{item.name}</Text><Text style={styles.roomSub}>{item.joined ? 'Joined · tap to open' : 'Public room · tap to join'}</Text></View>
        <Text style={styles.roomAction}>{item.joined ? 'Open' : 'Join'}</Text>
      </Pressable>}
      ListEmptyComponent={<Text style={styles.empty}>No public city rooms are available.</Text>}
    /> : <View style={styles.selectedArea}>{selected
      ? <Pressable style={styles.selectedRoom} onPress={() => openRoom(selected)} disabled={joining}><Text style={styles.selectedRoomName}>{selected.name}</Text><Text style={styles.selectedRoomSub}>{joining ? 'Opening…' : 'Tap to open this public chat'}</Text></Pressable>
      : <Text style={styles.empty}>Choose a city or town above to join its public chat room.</Text>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 14, backgroundColor: '#fff' },
  loader: { marginTop: 50 },
  heading: { color: '#172033', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  description: { color: '#68748a', fontSize: 12, lineHeight: 18, marginBottom: 14 },
  error: { marginBottom: 10, padding: 10, borderRadius: 8, color: '#b91c1c', backgroundColor: '#fee2e2' },
  dropdown: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: '#d8deea', borderRadius: 12, backgroundColor: '#f8faff' },
  dropdownText: { flex: 1, minWidth: 0 }, dropdownLabel: { color: '#68748a', fontSize: 10, fontWeight: '700' },
  dropdownValue: { marginTop: 4, color: '#172033', fontSize: 15, fontWeight: '700' }, chevron: { color: '#3157d5', fontSize: 24, paddingLeft: 10 },
  menu: { marginTop: 8, borderWidth: 1, borderColor: '#e2e7f0', borderRadius: 12, backgroundColor: '#fff' },
  roomRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#edf0f5' },
  cityIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff' },
  cityIconText: { color: '#3157d5', fontWeight: '800' }, roomMeta: { flex: 1, minWidth: 0, marginLeft: 10 },
  roomName: { color: '#172033', fontSize: 14, fontWeight: '800' }, roomSub: { marginTop: 3, color: '#7a8497', fontSize: 11 },
  roomAction: { color: '#3157d5', fontWeight: '800', fontSize: 12 }, selectedArea: { flex: 1, paddingTop: 14 },
  selectedRoom: { padding: 16, borderRadius: 12, backgroundColor: '#f8faff', borderWidth: 1, borderColor: '#e2e7f0' },
  selectedRoomName: { color: '#172033', fontSize: 16, fontWeight: '800' }, selectedRoomSub: { marginTop: 5, color: '#68748a', fontSize: 12 },
  empty: { padding: 20, color: '#718096', textAlign: 'center', lineHeight: 20 },
});
