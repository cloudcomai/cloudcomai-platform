import * as SecureStore from 'expo-secure-store';
import { createApiClient, createCloudComAiApi } from '@cloudcomai/api-client';
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
