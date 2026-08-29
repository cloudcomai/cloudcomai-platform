import React, { useEffect, useState } from 'react';

export default function AttachmentPreview({ attachment }) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://cloudcomai.com/apiapp/api';
  const isImage = String(attachment?.mime_type || '').startsWith('image/');

  useEffect(() => {
    if (!attachment?.id || !isImage) return undefined;

    let cancelled = false;
    let objectUrl = '';
    const controller = new AbortController();

    const loadPreview = async () => {
      try {
        setError('');
        const token = localStorage.getItem('cc_token');
        const response = await fetch(
          `${apiBase}/attachment.php?id=${encodeURIComponent(attachment.id)}&preview=1`,
          {
            method: 'GET',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: controller.signal
          }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || 'Unable to load image preview.');
        }

        const blob = await response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      } catch (err) {
        if (!cancelled && err?.name !== 'AbortError') {
          console.error('Unable to load attachment preview:', err);
          setError('Preview unavailable');
        }
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [apiBase, attachment?.id, isImage]);

  if (!isImage) return null;

  return (
    <div
      className="attachment-preview-wrap"
      style={{
        width: '100%',
        maxWidth: '340px',
        maxHeight: '300px',
        borderRadius: '10px',
        overflow: 'hidden',
        background: 'var(--bg-directory)',
        border: '1px solid var(--border-color)'
      }}
    >
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={attachment?.name || 'Attachment'}
          className="attachment-image-preview"
          style={{
            display: 'block',
            width: '100%',
            maxHeight: '300px',
            objectFit: 'contain'
          }}
        />
      ) : (
        <div
          className="attachment-preview-placeholder"
          style={{
            minHeight: '100px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px',
            fontSize: '11px',
            color: 'var(--text-muted)'
          }}
        >
          {error || 'Loading image...'}
        </div>
      )}
    </div>
  );
}
