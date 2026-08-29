import { createApiClient, createCloudComAiApi } from '@cloudcomai/api-client';
import {
  createAuthSessionManager,
  createWebStorageAdapter,
} from '@cloudcomai/auth';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://cloudcomai.com/apiapp/api';

const storage = createWebStorageAdapter(window.localStorage);
export const sessionManager = createAuthSessionManager({ storage });

const syncLegacyKeys = (session) => {
  if (session) {
    window.localStorage.setItem('cc_token', session.token);
    window.localStorage.setItem('cc_user', JSON.stringify(session.user));
  } else {
    window.localStorage.removeItem('cc_token');
    window.localStorage.removeItem('cc_user');
  }
};

export const saveWebSession = async (session) => {
  await sessionManager.setSession(session);
  syncLegacyKeys(session);
  return session;
};

export const clearWebSession = async () => {
  await sessionManager.clearSession();
  syncLegacyKeys(null);
};

export const loadWebSession = async () => {
  const session = await sessionManager.getSession();
  if (session) {
    syncLegacyKeys(session);
    return session;
  }

  const token = window.localStorage.getItem('cc_token');
  const rawUser = window.localStorage.getItem('cc_user');
  if (!token || !rawUser) return null;

  try {
    const legacySession = { token, user: JSON.parse(rawUser) };
    await saveWebSession(legacySession);
    return legacySession;
  } catch {
    await clearWebSession();
    return null;
  }
};

export const apiClient = createApiClient({
  baseUrl: API_BASE_URL,
  tokenProvider: () => sessionManager.getToken(),
  onUnauthorized: async () => {
    await clearWebSession();
    window.dispatchEvent(new CustomEvent('cloudcomai:unauthorized'));
  },
});

export const platformApi = createCloudComAiApi(apiClient);

// Compatibility bridge for web features that will move to platformApi during
// the Web phase. It centralizes auth/error behavior without changing their
// existing request and response shapes in the authentication phase.
export const legacyApi = async (path, options = {}) => {
  const { method = 'GET', body, headers, ...requestOptions } = options;
  let normalizedBody = body;
  if (typeof body === 'string') {
    try {
      normalizedBody = JSON.parse(body);
    } catch {
      normalizedBody = body;
    }
  }

  const result = await apiClient.request(String(path).replace(/^\//, ''), {
    ...requestOptions,
    method,
    body: normalizedBody,
    headers,
  });
  return result.data;
};
