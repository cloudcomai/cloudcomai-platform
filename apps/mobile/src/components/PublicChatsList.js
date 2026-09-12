import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { platformApi } from '../services/platform';

const formatRoomStats = room => `👥 ${Number(room?.joined_count || 0)} Joined · 🟢 ${Number(room?.online_count || 0)} Online`;

export default function PublicChatsList({ onOpenChat }) {
  const [rooms, setRooms] = useState([]);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false, silent = false) => {
    if (!silent) refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const { data } = await platformApi.listPublicChats();
      const nextRooms = Array.isArray(data.rooms) ? data.rooms.slice(0, 50) : [];
      setRooms(nextRooms);
      setSelected(current => current && nextRooms.some(room => Number(room.id) === Number(current.id)) ? nextRooms.find(room => Number(room.id) === Number(current.id)) : current);
    } catch (e) {
      if (!silent) setError(e.message || 'Unable to load public chat rooms.');
    } finally {
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(false, true), 5000);
    return () => clearInterval(timer);
  }, [load]);

  const openRoom = async room => {
    if (!room?.id || joining || leaving) return;
    setJoining(true);
    setError('');
    try {
      const { data } = await platformApi.joinPublicChat(Number(room.id));
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

  const leaveRoom = room => {
    if (!room?.id || leaving || joining) return;
    Alert.alert(
      'Leave public chat room?',
      `You will leave ${room.name || 'this public chat room'}. Your previous messages will remain subject to the room retention policy, but you will no longer receive new room messages until you join again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave room',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            setError('');
            try {
              await platformApi.leavePublicChat(Number(room.id));
              setRooms(current => current.map(item => Number(item.id) === Number(room.id) ? { ...item, joined: false } : item));
              setSelected(null);
              setOpen(false);
            } catch (e) {
              setError(e.message || 'Unable to leave public chat room.');
            } finally {
              setLeaving(false);
            }
          },
        },
      ],
    );
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
        {selected ? <Text style={styles.selectedStats}>{formatRoomStats(selected)}</Text> : null}
      </View>
      <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
    </Pressable>
    {open ? <FlatList
      data={rooms}
      keyExtractor={item => String(item.id)}
      style={styles.menu}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      renderItem={({ item }) => <Pressable style={styles.roomRow} onPress={() => openRoom(item)} disabled={joining || leaving}>
        <View style={styles.cityIcon}><Text style={styles.cityIconText}>{item.name?.[0] || 'I'}</Text></View>
        <View style={styles.roomMeta}><Text style={styles.roomName}>{item.name}</Text><Text style={styles.roomSub}>{formatRoomStats(item)}</Text></View>
        <Text style={styles.roomAction}>{item.joined ? 'Open' : 'Join'}</Text>
      </Pressable>}
      ListEmptyComponent={<Text style={styles.empty}>No public city rooms are available.</Text>}
    /> : <View style={styles.selectedArea}>{selected
      ? <>
        <Pressable style={styles.selectedRoom} onPress={() => openRoom(selected)} disabled={joining || leaving}><Text style={styles.selectedRoomName}>{selected.name}</Text><Text style={styles.selectedRoomSub}>{joining ? 'Opening…' : formatRoomStats(selected)}</Text></Pressable>
        <Pressable style={styles.leaveButton} onPress={() => leaveRoom(selected)} disabled={joining || leaving} accessibilityRole="button" accessibilityLabel={`Leave ${selected.name || 'public chat room'}`}>
          <Text style={styles.leaveButtonText}>{leaving ? 'Leaving…' : 'Leave room'}</Text>
        </Pressable>
      </>
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
  dropdownValue: { marginTop: 4, color: '#172033', fontSize: 15, fontWeight: '700' }, selectedStats: { marginTop: 4, color: '#5b6577', fontSize: 11, fontWeight: '700' }, chevron: { color: '#3157d5', fontSize: 24, paddingLeft: 10 },
  menu: { marginTop: 8, borderWidth: 1, borderColor: '#e2e7f0', borderRadius: 12, backgroundColor: '#fff' },
  roomRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#edf0f5' },
  cityIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff' },
  cityIconText: { color: '#3157d5', fontWeight: '800' }, roomMeta: { flex: 1, minWidth: 0, marginLeft: 10 },
  roomName: { color: '#172033', fontSize: 14, fontWeight: '800' }, roomSub: { marginTop: 3, color: '#5b6577', fontSize: 11, fontWeight: '700' },
  roomAction: { color: '#3157d5', fontWeight: '800', fontSize: 12 }, selectedArea: { flex: 1, paddingTop: 14 },
  selectedRoom: { padding: 16, borderRadius: 12, backgroundColor: '#f8faff', borderWidth: 1, borderColor: '#e2e7f0' },
  selectedRoomName: { color: '#172033', fontSize: 16, fontWeight: '800' }, selectedRoomSub: { marginTop: 5, color: '#5b6577', fontSize: 12, fontWeight: '700' },
  leaveButton: { marginTop: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff7f7' },
  leaveButtonText: { color: '#b91c1c', fontSize: 13, fontWeight: '800' },
  empty: { padding: 20, color: '#718096', textAlign: 'center', lineHeight: 20 },
});
