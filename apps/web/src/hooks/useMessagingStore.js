import { useEffect, useRef, useState } from 'react';
import { createMessagingStore } from '@cloudcomai/chat-core';
import { platformApi, sessionManager } from '../services/platform';

export function useMessagingStore(userId, onDelivered) {
  const [store, setStore] = useState(null);
  const [state, setState] = useState({ drafts: {}, outbox: [] });
  const [error, setError] = useState('');
  const delivered = useRef(onDelivered); delivered.current = onDelivered;
  useEffect(() => {
    setStore(null); setState({ drafts: {}, outbox: [] }); setError('');
    if (!userId) return;
    const instance = createMessagingStore({
      userId,
      storage: {
        getItem: key => localStorage.getItem(key),
        setItem: (key, value) => localStorage.setItem(key, value),
        withLock: (key, run) => navigator.locks ? navigator.locks.request(key, run) : run(),
      },
      send: async (input, options) => {
        const session = await sessionManager.getSession();
        if (Number(session?.user?.id) !== Number(userId)) throw Object.assign(new Error('Sign in to send queued messages.'), { status: 401 });
        return platformApi.sendMessage(input, { ...options, headers: { Authorization: `Bearer ${session.token}` } });
      },
      onDelivered: message => delivered.current?.(message),
    });
    let active = true;
    const unsubscribe = instance.subscribe(next => { if (active) setState(next); });
    const flush = () => { if (active && document.visibilityState !== 'hidden') instance.flush().catch(e => setError(e.message)); };
    instance.load().then(() => { if (active) { setStore(instance); flush(); } }).catch(e => { if (active) setError(e.message); });
    const timer = setInterval(flush, 5000);
    window.addEventListener('online', flush);
    document.addEventListener('visibilitychange', flush);
    return () => { active = false; instance.stop(); unsubscribe(); clearInterval(timer); window.removeEventListener('online', flush); document.removeEventListener('visibilitychange', flush); };
  }, [userId]);
  return { store, state, error, setError };
}
