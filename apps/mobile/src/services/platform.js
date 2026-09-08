import * as SecureStore from 'expo-secure-store';
import { Directory, File, Paths } from 'expo-file-system';
import { ApiError, ApiRoute, createApiClient, createCloudComAiApi } from '@cloudcomai/api-client';
import { createAuthSessionManager } from '@cloudcomai/auth';
import {
  attachmentPreviewExtension,
  buildApiUrl,
  normalizeUploadAsset,
} from '../utils/media';

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
const sessionExpirationListeners = new Set();
export const subscribeToSessionExpiration = listener => {
  sessionExpirationListeners.add(listener);
  return () => sessionExpirationListeners.delete(listener);
};

const expireSession = async () => {
  await sessionManager.clearSession();
  for (const listener of sessionExpirationListeners) listener();
};

export const apiClient = createApiClient({
  baseUrl: API_BASE_URL,
  tokenProvider: () => sessionManager.getToken(),
  onUnauthorized: expireSession,
});

export const platformApi = createCloudComAiApi(apiClient);

const parseUploadResult = async result => {
  let data = null;
  try {
    data = result.body ? JSON.parse(result.body) : null;
  } catch {
    if (result.status >= 200 && result.status < 300) {
      throw new ApiError('The server returned an invalid upload response.', { status: result.status });
    }
  }

  if (result.status === 401) await expireSession();
  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(
      data?.error || data?.message || `Upload failed with status ${result.status}`,
      { status: result.status, code: data?.code || null, details: data },
    );
  }
  return { data, status: result.status, headers: result.headers };
};

export function createMobileMultipartBody(asset, {
  fieldName = 'file',
  parameters = {},
} = {}, FormDataCtor = globalThis.FormData) {
  if (typeof FormDataCtor !== 'function') throw new ApiError('Multipart upload is unavailable on this device.');
  const normalized = normalizeUploadAsset(asset, { fallbackName: 'attachment' });
  const form = new FormDataCtor();
  form.append(fieldName, {
    uri: normalized.uri,
    name: normalized.name,
    type: normalized.mimeType,
  });
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null) form.append(key, String(value));
  }
  return form;
}

export async function uploadMobileFile(route, asset, {
  fieldName = 'file',
  parameters = {},
  fallbackName = 'upload',
  fallbackMime = 'application/octet-stream',
  maxBytes = 25 * 1024 * 1024,
} = {}) {
  const normalized = normalizeUploadAsset(asset, { fallbackName, fallbackMime });
  const file = new File(normalized.uri);
  if (!file.exists) throw new ApiError('The selected file is no longer available.');
  const size = Number(file.size ?? normalized.size ?? 0);
  if (!Number.isFinite(size) || size <= 0) throw new ApiError('The selected file is empty.');
  if (size > maxBytes) throw new ApiError(`The selected file must be ${Math.floor(maxBytes / 1024 / 1024)} MB or smaller.`);

  const token = await sessionManager.getToken();
  const formData = createMobileMultipartBody(normalized, { fieldName, parameters: {
    ...parameters,
    original_filename: parameters.original_filename || normalized.name,
  } });
  const response = await fetch(buildApiUrl(API_BASE_URL, route), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const body = await response.text();
  return parseUploadResult({
    status: response.status,
    body,
    headers: Object.fromEntries(response.headers.entries()),
  });
}

export const uploadAttachmentAsset = (asset, parameters = {}) => uploadMobileFile(
  ApiRoute.UPLOAD_ATTACHMENT,
  asset,
  {
    fieldName: 'file',
    fallbackName: 'attachment',
    parameters: {
      ...parameters,
      original_filename: normalizeUploadAsset(asset, { fallbackName: 'attachment' }).name,
    },
  },
);

export const uploadMediaAsset = (asset, parameters = {}) => uploadMobileFile(
  ApiRoute.MEDIA_UPLOAD,
  asset,
  {
    fieldName: 'image',
    fallbackName: 'profile.jpg',
    fallbackMime: 'image/jpeg',
    maxBytes: 2 * 1024 * 1024,
    parameters,
  },
);

export async function downloadAttachmentPreview(attachment) {
  if (!attachment?.id) throw new ApiError('Attachment preview is unavailable.');
  const token = await sessionManager.getToken();
  if (!token) throw new ApiError('Authentication is required to preview this attachment.', { status: 401 });

  const directory = new Directory(Paths.cache, 'cloudcomai-attachment-previews');
  directory.create({ intermediates: true, idempotent: true });
  const file = new File(
    directory,
    `${Number(attachment.id)}-${Date.now()}.${attachmentPreviewExtension(attachment)}`,
  );
  try {
    return await File.downloadFileAsync(
      buildApiUrl(API_BASE_URL, ApiRoute.ATTACHMENT, { id: attachment.id, preview: 1 }),
      file,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch (error) {
    if (file.exists) {
      try { file.delete(); } catch {}
    }
    throw error;
  }
}

export const mediaUrl = (type, id) => {
  return buildApiUrl(API_BASE_URL, ApiRoute.MEDIA || 'v1/media', { type, id });
};
