import { API_BASE_URL, sessionManager } from './platform';

export async function uploadHubMedia(postId, asset) {
  if (!postId || !asset?.uri) throw new Error('A post and media asset are required.');
  const token = await sessionManager.getToken();
  if (!token) throw new Error('Authentication is required to upload Hubs media.');
  const form = new FormData();
  form.append('media', { uri: asset.uri, name: asset.fileName || `hub-${postId}`, type: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg') });
  form.append('post_id', String(postId));
  const response = await fetch(`${API_BASE_URL}/v1/hubs/media`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Unable to upload Hubs media.');
  return data;
}
