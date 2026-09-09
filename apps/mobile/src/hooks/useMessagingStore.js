import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { createMessagingStore } from '@cloudcomai/chat-core';
import { platformApi, sessionManager } from '../services/platform';

const storage = {
  async getItem(key) {
    const file = new File(Paths.document, `${key}.json`);
    const backup = new File(Paths.document, `${key}.backup.json`);
    if (!file.exists) return backup.exists ? backup.text() : null;
    const value = await file.text();
    try { JSON.parse(value); return value; }
    catch (error) { if (backup.exists) return backup.text(); throw error; }
  },
  async setItem(key, value) {
    const file = new File(Paths.document, `${key}.json`);
    const backup = new File(Paths.document, `${key}.backup.json`);
    if (file.exists) {
      const previous = await file.text();
      try { JSON.parse(previous); backup.write(previous); } catch (error) { if (!(error instanceof SyntaxError)) throw error; }
    }
    file.write(value);
  },
};

export function useMessagingStore(userId, onDelivered) {
  const [store, setStore] = useState(null);
  const [state, setState] = useState({ drafts: {}, outbox: [] });
  const [error, setError] = useState('');
  const delivered = useRef(onDelivered); delivered.current = onDelivered;
  useEffect(() => {
    setStore(null); setState({ drafts: {}, outbox: [] }); setError('');
    if (!userId) return;
    let active = true;
    const instance = createMessagingStore({ userId, storage,
      send: async (input, options) => {
        const session = await sessionManager.getSession();
        if (Number(session?.user?.id) !== Number(userId)) throw Object.assign(new Error('Sign in to send queued messages.'), { status: 401 });
        return platformApi.sendMessage(input, { ...options, headers: { Authorization: `Bearer ${session.token}` } });
      },
      onDelivered: message => delivered.current?.(message),
    });
    const unsubscribe = instance.subscribe(next => { if (active) setState(next); });
    const flush = () => { if (active && AppState.currentState === 'active') instance.flush().catch(e => setError(e.message)); };
    instance.load().then(() => { if (active) { setStore(instance); flush(); } }).catch(e => { if (active) setError(e.message); });
    const timer = setInterval(flush, 5000);
    const subscription = AppState.addEventListener('change', next => { if (next === 'active') { instance.start(); flush(); } else instance.stop(); });
    return () => { active = false; instance.stop(); unsubscribe(); clearInterval(timer); subscription.remove(); };
  }, [userId]);
  return { store, state, error, setError };
}
