import React, { useEffect, useState } from 'react';

export default function AttachmentActions({ attachment, message, user, apiBridge }) {
  const [status, setStatus] = useState(attachment?.download_status || '');
  const [requestId, setRequestId] = useState(attachment?.download_request_id || null);
  const [busy, setBusy] = useState(false);

  const isSender = Number(message?.sender_id) === Number(user?.id) || Number(message?.user_id) === Number(user?.id) || message?.mine === true;
  const policy = attachment?.download_policy || 'APPROVAL_REQUIRED';
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://cloudcomai.com/apiapp/api';

  useEffect(() => {
    setStatus(attachment?.download_status || '');
    setRequestId(attachment?.download_request_id || null);
  }, [attachment?.download_status, attachment?.download_request_id, attachment?.id]);

  useEffect(() => {
    if (!isSender || !attachment?.id || !apiBridge) return;
    let cancelled = false;
    const loadPendingRequest = async () => {
      try {
        const result = await apiBridge(`/attachment_download_requests.php?chat_id=${encodeURIComponent(message?.chat_id || '')}`, { method: 'GET' });
        const request = (result?.requests || []).find(item => Number(item.attachment_id) === Number(attachment.id));
        if (!cancelled && request) {
          setRequestId(Number(request.request_id));
          setStatus(request.status);
        }
      } catch (err) {
        console.error('Unable to load attachment download request:', err);
      }
    };
    loadPendingRequest();
    return () => { cancelled = true; };
  }, [apiBridge, attachment?.id, isSender, message?.chat_id]);

  const download = async () => {
    setBusy(true);
    try {
      const token = localStorage.getItem('cc_token');
      const response = await fetch(`${apiBase}/attachment.php?id=${encodeURIComponent(attachment.id)}`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Unable to download attachment.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.name || 'attachment';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Unable to download attachment.');
    } finally {
      setBusy(false);
    }
  };

  const requestDownload = async () => {
    setBusy(true);
    try {
      const result = await apiBridge('/request_attachment_download.php', { method: 'POST', body: JSON.stringify({ attachment_id: Number(attachment.id) }) });
      setStatus(result?.status || 'PENDING');
    } catch (err) {
      alert(err.message || 'Unable to request download.');
    } finally {
      setBusy(false);
    }
  };

  const respond = async nextStatus => {
    if (!requestId) return;
    setBusy(true);
    try {
      const result = await apiBridge('/respond_attachment_download.php', { method: 'POST', body: JSON.stringify({ request_id: Number(requestId), status: nextStatus }) });
      setStatus(result?.status || nextStatus);
      setRequestId(null);
    } catch (err) {
      alert(err.message || 'Unable to update download request.');
    } finally {
      setBusy(false);
    }
  };

  if (!attachment?.id) return null;
  if (isSender && requestId && status === 'PENDING') return <span style={{ display: 'inline-flex', gap: '5px' }}><button type="button" className="composer-addon-btn" onClick={() => respond('APPROVED')} disabled={busy}>Approve</button><button type="button" className="composer-addon-btn" onClick={() => respond('DENIED')} disabled={busy}>Deny</button></span>;
  if (isSender || policy === 'ALLOW') return <button type="button" className="composer-addon-btn" onClick={download} disabled={busy}>Download</button>;
  if (policy === 'VIEW_ONLY') return <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>View only</span>;
  if (status === 'APPROVED') return <button type="button" className="composer-addon-btn" onClick={download} disabled={busy}>Download</button>;
  if (status === 'PENDING') return <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Download request pending</span>;
  return <button type="button" className="composer-addon-btn" onClick={requestDownload} disabled={busy}>Request download</button>;
}
