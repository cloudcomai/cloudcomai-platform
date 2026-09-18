import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { platformApi } from '../services/platform';

const GREEN = '#16a34a';

export default function ReadReceipt({ message, children, isVisible = true, showStatus = false }) {
  const targetRef = useRef(null);
  const markedRef = useRef(false);
  const visibleRef = useRef(isVisible);
  visibleRef.current = isVisible;
  const messageIdRef = useRef(message?.id);
  messageIdRef.current = message?.id;
  const [eligible, setEligible] = useState(false);
  const [isSender, setIsSender] = useState(false);
  const [readBy, setReadBy] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [readMarked, setReadMarked] = useState(false);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  const loadStatus = useCallback(async () => {
    if (!message?.id || !visibleRef.current || AppState.currentState !== 'active') return null;
    try {
      const { data } = await platformApi.getMessageReadStatus(Number(message.id));
      if (messageIdRef.current !== message.id || !visibleRef.current) return null;
      setEligible(Boolean(data?.eligible));
      setIsSender(Boolean(data?.is_sender));
      setReadBy(Array.isArray(data?.read_by) ? data.read_by : []);
      setLoaded(true);
      return data;
    } catch {
      return null;
    }
  }, [message?.id]);

  const markIfVisible = useCallback(() => {
    if (!visibleRef.current || markedRef.current || !eligible || isSender || readMarked || AppState.currentState !== 'active' || !targetRef.current) return;
    targetRef.current.measureInWindow((x, y, width, height) => {
      if (!visibleRef.current || messageIdRef.current !== message.id || AppState.currentState !== 'active') return;
      const horizontallyVisible = x + width > 0 && x < windowWidth;
      const verticallyVisible = y + height > 0 && y < windowHeight;
      if (!horizontallyVisible || !verticallyVisible || width <= 0 || height <= 0) return;
      markedRef.current = true;
      platformApi.markMessagesRead([Number(message.id)]).then(() => {
        if (messageIdRef.current === message.id) setReadMarked(true);
      }).catch(() => { if (messageIdRef.current === message.id) markedRef.current = false; });
    });
  }, [eligible, isSender, message?.id, readMarked, windowHeight, windowWidth]);

  useEffect(() => {
    markedRef.current = false;
    setEligible(false);
    setLoaded(false);
    setIsSender(false);
    setReadBy([]);
    setReadMarked(false);
  }, [loadStatus]);

  useEffect(() => { if (isVisible) loadStatus(); }, [isVisible, loadStatus]);

  useEffect(() => {
    if (!isVisible || !loaded || !eligible || isSender || readMarked) return undefined;
    const timer = setInterval(markIfVisible, 350);
    const subscription = AppState.addEventListener('change', nextState => { if (nextState === 'active') markIfVisible(); });
    markIfVisible();
    return () => { clearInterval(timer); subscription.remove(); };
  }, [isVisible, loaded, eligible, isSender, readMarked, markIfVisible]);

  useEffect(() => {
    if (!isVisible || !loaded || !eligible || !isSender) return undefined;
    const timer = setInterval(loadStatus, 3000);
    return () => clearInterval(timer);
  }, [isVisible, loaded, eligible, isSender, loadStatus]);

  const receipt = showStatus && eligible && isSender && readBy.length ? (
    <Pressable style={styles.receipt} onPress={() => Alert.alert('Read by', readBy.map(item => item.name || 'Member').join('\n'))} accessibilityRole="button" accessibilityLabel={readBy.length === 1 ? 'Read' : `Read by ${readBy.length}`}>
      <Text style={styles.readIcon}>✓✓</Text>
    </Pressable>
  ) : null;

  return <View ref={targetRef} collapsable={false}>{children}{receipt}</View>;
}

const styles = StyleSheet.create({
  receipt: { alignSelf: 'flex-end', width: 30, height: 24, alignItems: 'center', justifyContent: 'center', marginTop: 2, borderRadius: 12 },
  readIcon: { color: GREEN, fontSize: 13, fontWeight: '800', letterSpacing: -3, paddingRight: 3 },
});
