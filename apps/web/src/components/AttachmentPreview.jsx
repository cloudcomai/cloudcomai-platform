import React, { useEffect, useState } from 'react';
import { ApiRoute } from '@cloudcomai/api-client';
import { fetchApiBlob } from '../services/platform';

export default function AttachmentPreview({ attachment, messageType, autoDownload = false }) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [requested, setRequested] = useState(false);
  const mime = String(attachment?.mime_type || '');
  const kind = messageType === 'voice' || mime.startsWith('audio/') ? 'audio' : mime.startsWith('video/') ? 'video' : mime.startsWith('image/') ? 'image' : '';
  useEffect(() => { setRequested(false); setPreviewUrl(''); setError(''); }, [attachment?.id]);
  useEffect(() => {
    if (!attachment?.id || !kind || (!requested && !autoDownload)) return undefined;
    let cancelled = false;
    let url = '';
    const controller = new AbortController();
    fetchApiBlob(ApiRoute.ATTACHMENT, { id: attachment.id, preview: 1 }, { signal: controller.signal }).then(blob => {
      if (cancelled) return;
      url = URL.createObjectURL(blob); setPreviewUrl(url); setError('');
    }).catch(error => { if (!cancelled && error.name !== 'AbortError') setError(error.message || 'Preview unavailable'); });
    return () => { cancelled = true; controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [attachment?.id, kind, requested, autoDownload]);
  if (!kind) return null;
  return <div className="attachment-preview-wrap">
    {previewUrl ? kind === 'image' ? <img src={previewUrl} alt={attachment.name || 'Attachment'} /> : kind === 'audio' ? <audio src={previewUrl} controls controlsList="nodownload" /> : <video src={previewUrl} controls playsInline controlsList="nodownload" /> : error ? <span role="alert">{error}</span> : requested || autoDownload ? <span>Loading media…</span> : <button onClick={() => setRequested(true)}>Load {kind === 'audio' ? 'voice/audio' : kind} · {Math.ceil(Number(attachment.file_size || 0) / 1024)} KB</button>}
  </div>;
}
