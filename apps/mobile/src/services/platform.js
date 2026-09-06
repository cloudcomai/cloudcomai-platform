import * as SecureStore from 'expo-secure-store';
import { ApiRoute, createApiClient, createCloudComAiApi } from '@cloudcomai/api-client';
import { createAuthSessionManager } from '@cloudcomai/auth';

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

if (!configuredApiBaseUrl) {
  throw new Error(
    'EXPO_PUBLIC_API_BASE_URL is required. Configure it in the local .env file or selected EAS environment.',
  );
}

export const API_BASE_URL = configuredApiBaseUrl.replace(/\/+$/, '');

const secureStorage = {
  getItem: key => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: key => SecureStore.deleteItemAsync(key),
};

export const sessionManager = createAuthSessionManager({ storage: secureStorage });

export const apiClient = createApiClient({
  baseUrl: API_BASE_URL,
  tokenProvider: () => sessionManager.getToken(),
  onUnauthorized: () => sessionManager.clearSession(),
});

export const platformApi = createCloudComAiApi(apiClient);


export const mediaUrl = (type, id) => {
  const base = `${API_BASE_URL.replace(/\/$/, '')}/`;
  const route = String(ApiRoute.MEDIA || 'v1/media').replace(/^\//, '');
  const url = new URL(route, base);
  url.searchParams.set('type', type);
  url.searchParams.set('id', String(id ?? ''));
  return url.toString();
};
