import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { createMessagingStore } from '@cloudcomai/chat-core';
import { platformApi, sessionManager } from '../services/platform';

const storageFileUri = (key, suffix = '.json') => {
  const directory = FileSystem.documentDirectory;
  if (typeof directory !== 'string' || !directory) throw new Error('Local message storage is unavailable on this device.');
  const safeKey = String(key).replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${directory}${safeKey}${suffix}`;
};

const readStoredValue = async uri => {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists ? FileSystem.readAsStringAsync(uri) : null;
};

const storageLocks = new Map();

const storage = {
  async withLock(key, operation) {
    const lockKey = String(key);
    const previous = storageLocks.get(lockKey) || Promise.resolve();
    let release;
    const current = new Promise(resolve => { release = resolve; });
    storageLocks.set(lockKey, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (storageLocks.get(lockKey) === current) storageLocks.delete(lockKey);
    }
  },
  async getItem(key) {
    const fileUri = storageFileUri(key);
    const backupUri = storageFileUri(key, '.backup.json');
    const value = await readStoredValue(fileUri);
    if (value === null) return readStoredValue(backupUri);
    try {
      JSON.parse(value);
      return value;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      const backup = await readStoredValue(backupUri);
      if (backup !== null) return backup;
      throw error;
    }
  },
  async setItem(key, value) {
    const fileUri = storageFileUri(key);
    const backupUri = storageFileUri(key, '.backup.json');
    const previous = await readStoredValue(fileUri);
    if (previous !== null) {
      try {
        JSON.parse(previous);
        await FileSystem.writeAsStringAsync(backupUri, previous);
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
    }
    await FileSystem.writeAsStringAsync(fileUri, value);
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
