const SESSION_KEY = 'cloudcomai.auth.session';

const assertStorage = (storage) => {
  for (const method of ['getItem', 'setItem', 'removeItem']) {
    if (typeof storage?.[method] !== 'function') {
      throw new TypeError(`Auth storage must implement ${method}()`);
    }
  }
};

export const createMemoryStorage = () => {
  const values = new Map();
  return {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => void values.set(key, value),
    removeItem: async (key) => void values.delete(key),
  };
};

export const createWebStorageAdapter = (storage) => {
  assertStorage(storage);
  return {
    getItem: async (key) => storage.getItem(key),
    setItem: async (key, value) => storage.setItem(key, value),
    removeItem: async (key) => storage.removeItem(key),
  };
};

export const createAuthSessionManager = ({ storage, storageKey = SESSION_KEY }) => {
  assertStorage(storage);

  const getSession = async () => {
    const raw = await storage.getItem(storageKey);
    if (!raw) return null;
    try {
      const session = JSON.parse(raw);
      return typeof session?.token === 'string' && session.token ? session : null;
    } catch {
      await storage.removeItem(storageKey);
      return null;
    }
  };

  return {
    getSession,
    getToken: async () => (await getSession())?.token ?? null,
    setSession: async (session) => {
      if (!session?.token || !session?.user) {
        throw new TypeError('A token and user are required to save a session');
      }
      await storage.setItem(storageKey, JSON.stringify(session));
      return session;
    },
    clearSession: async () => storage.removeItem(storageKey),
  };
};

export { SESSION_KEY };
