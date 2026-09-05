import { ApiRoute, createApiClient, createCloudComAiApi } from '@cloudcomai/api-client';
import {
  createAuthSessionManager,
  createWebStorageAdapter,
} from '@cloudcomai/auth';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://cloudcomai.com/apiapp/api';

console.log('[CloudComAI] API base URL:', API_BASE_URL);

const storage = createWebStorageAdapter(window.localStorage);
export const sessionManager = createAuthSessionManager({ storage });

export const saveWebSession = async (session) => {
  await sessionManager.setSession(session);
  return session;
};

export const clearWebSession = async () => {
  await sessionManager.clearSession();
};

export const loadWebSession = () => sessionManager.getSession();

export const apiClient = createApiClient({
  baseUrl: API_BASE_URL,
  tokenProvider: () => sessionManager.getToken(),
  onUnauthorized: async () => {
    await clearWebSession();
    window.dispatchEvent(new CustomEvent('cloudcomai:unauthorized'));
  },
});

export const platformApi = createCloudComAiApi(apiClient);

export const requestApi = async (route, options = {}) => {
  const { method = 'GET', body, headers, ...requestOptions } = options;
  let normalizedBody = body;
  if (typeof body === 'string') {
    try {
      normalizedBody = JSON.parse(body);
    } catch {
      normalizedBody = body;
    }
  }

  const result = await apiClient.request(route, {
    ...requestOptions,
    method,
    body: normalizedBody,
    headers,
  });
  return result.data;
};

export const fetchApiBlob = async (route, query, options = {}) => {
  const result = await apiClient.get(route, { ...options, query, responseType: 'blob' });
  return result.data;
};

export const mediaUrl = (type, id) => {
  const url = new URL(ApiRoute.MEDIA, `${API_BASE_URL.replace(/\/$/, '')}/`);
  url.searchParams.set('type', type);
  url.searchParams.set('id', String(id ?? ''));
  return url.toString();
};
