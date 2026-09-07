const MIME_BY_EXTENSION = Object.freeze({
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  webm: 'video/webm',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  '3gp': 'video/3gpp',
});

const EXTENSION_BY_MIME = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
});

const extensionFromName = name => {
  const clean = String(name || '').split(/[?#]/, 1)[0];
  const match = clean.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : '';
};

export function safeUploadName(asset, fallbackName = 'upload') {
  const candidate = String(asset?.fileName || asset?.name || fallbackName)
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  return candidate || fallbackName;
}

export function inferAssetMimeType(asset, fallbackMime = 'application/octet-stream') {
  const reported = [asset?.mimeType, asset?.type]
    .find(value => typeof value === 'string' && value.includes('/'));
  if (reported) return reported.toLowerCase();
  const extension = extensionFromName(safeUploadName(asset, asset?.uri || '')) || extensionFromName(asset?.uri);
  return MIME_BY_EXTENSION[extension] || fallbackMime;
}

export function normalizeUploadAsset(asset, {
  fallbackName = 'upload',
  fallbackMime = 'application/octet-stream',
} = {}) {
  const uri = String(asset?.uri || '').trim();
  if (!uri) throw new TypeError('The selected file is unavailable.');
  const mimeType = inferAssetMimeType(asset, fallbackMime);
  const originalName = safeUploadName(asset, fallbackName);
  const inferredExtension = EXTENSION_BY_MIME[mimeType];
  return {
    uri,
    name: !extensionFromName(originalName) && inferredExtension
      ? `${originalName}.${inferredExtension}`
      : originalName,
    mimeType,
    size: Number(asset?.fileSize ?? asset?.size ?? 0),
  };
}

export function attachmentKind(messageType, attachment) {
  const mime = String(attachment?.mime_type || '').toLowerCase();
  const extension = extensionFromName(attachment?.name);
  if (messageType === 'voice' || mime.startsWith('audio/') || ['mp3', 'm4a', 'aac', 'wav', 'ogg'].includes(extension)) return 'audio';
  if (mime.startsWith('video/') || ['mp4', 'mov', 'webm', '3gp'].includes(extension)) return 'video';
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)) return 'image';
  return '';
}

export function attachmentPreviewExtension(attachment) {
  return EXTENSION_BY_MIME[String(attachment?.mime_type || '').toLowerCase()]
    || extensionFromName(attachment?.name)
    || 'bin';
}

export function buildApiUrl(baseUrl, route, query = {}) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const path = String(route || '').replace(/^\/+/, '');
  const entries = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return `${base}/${path}${entries.length ? `?${entries.join('&')}` : ''}`;
}
