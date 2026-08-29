import * as SecureStore from 'expo-secure-store';
import { createApiClient, createCloudComAiApi } from '@cloudcomai/api-client';
import { createAuthSessionManager } from '@cloudcomai/auth';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || 'https://www.cloudcomai.com/apiapp/api';

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
