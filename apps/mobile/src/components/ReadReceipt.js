import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { platformApi } from '../services/platform';

const GREEN = '#16a34a';

export default function ReadReceipt({ message }) {
  const targetRef = useRef(null);
  const markedRef = useRef(false);
  const [isSender, setIsSender] = useState(false);
  const [readBy, setReadBy] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  const loadStatus = useCallback(async () => {
    if (!message?.id) return null;
    try {
      const { data } = await platformApi.getMessageReadStatus(Number(message.id));
      setIsSender(Boolean(data?.is_sender));
      setReadBy(Array.isArray(data?.read_by) ? data.read_by : []);
      setLoaded(true);
      return data;
    } catch {
      return null;
    }
  }, [message?.id]);

  const markIfVisible = useCallback(() => {
    if (markedRef.current || isSender || AppState.currentState !== 'active' || !targetRef.current) return;
    targetRef.current.measureInWindow((x, y, width, height) => {
      const horizontallyVisible = x + width > 0 && x < windowWidth;
      const verticallyVisible = y + height > 0 && y < windowHeight;
      if (!horizontallyVisible || !verticallyVisible || width <= 0 || height <= 0) return;
      markedRef.current = true;
      platformApi.markMessagesRead([Number(message.id)]).catch(() => { markedRef.current = false; });
    });
  }, [isSender, message?.id, windowHeight, windowWidth]);

  useEffect(() => {
    markedRef.current = false;
    setLoaded(false);
    setIsSender(false);
    setReadBy([]);
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!loaded || isSender) return undefined;
    const timer = setInterval(markIfVisible, 350);
    const subscription = AppState.addEventListener('change', nextState => { if (nextState === 'active') markIfVisible(); });
    markIfVisible();
    return () => { clearInterval(timer); subscription.remove(); };
  }, [loaded, isSender, markIfVisible]);

  useEffect(() => {
    if (!loaded || !isSender) return undefined;
    const timer = setInterval(loadStatus, 3000);
    return () => clearInterval(timer);
  }, [loaded, isSender, loadStatus]);

  if (!isSender || !readBy.length) return <View ref={targetRef} style={styles.anchor} />;
  const label = readBy.length === 1 ? 'Read' : `Read by ${readBy.length}`;
  return (
    <Pressable ref={targetRef} style={styles.receipt} onPress={() => Alert.alert('Read by', readBy.map(item => item.name || 'Member').join('\n'))} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.dot}>●</Text><Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  anchor: { width: 1, height: 1, opacity: 0 },
  receipt: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', marginTop: 3, paddingVertical: 1 },
  dot: { color: GREEN, fontSize: 8, marginRight: 4 },
  label: { color: GREEN, fontSize: 10, fontWeight: '700' },
});
