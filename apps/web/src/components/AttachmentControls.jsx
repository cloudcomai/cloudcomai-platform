import React, { useRef, useState } from 'react';
import { ApiRoute } from '@cloudcomai/api-client';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ACCEPT = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
].join(',');

export default function AttachmentControls({ selectedChat, apiBridge, onUploaded }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const openPicker = () => {
    if (!selectedChat || busy) return;
    inputRef.current?.click();
  };

  const upload = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !selectedChat || !apiBridge) return;

    if (file.size <= 0) {
      alert('The selected file is empty.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert('File size cannot exceed 25 MB.');
      return;
    }

    setBusy(true);

    try {
      const form = new FormData();
      form.append('chat_id', String(selectedChat.id));
      form.append('file', file);
      // Attachments are protected by sender approval by default. The approval
      // action is handled inside the message bubble, not in the composer.
      form.append('download_policy', 'APPROVAL_REQUIRED');

      const result = await apiBridge(ApiRoute.UPLOAD_ATTACHMENT, {
        method: 'POST',
        body: form
      });

      if (!result?.message) {
        throw new Error('Attachment upload completed without a message response.');
      }

      onUploaded?.(result.message);
    } catch (err) {
      alert(err?.message || 'Unable to upload attachment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="attachment-control-group">
      <button
        type="button"
        className="composer-addon-btn attachment-picker-btn"
        onClick={openPicker}
        disabled={!selectedChat || busy}
        title={busy ? 'Uploading attachment...' : 'Attach image or document'}
        aria-label={busy ? 'Uploading attachment' : 'Attach image or document'}
      >
        {busy ? '…' : '📎'}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={upload}
        disabled={!selectedChat || busy}
        style={{ display: 'none' }}
      />
    </div>
  );
}
