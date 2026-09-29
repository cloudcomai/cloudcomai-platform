import { useCallback, useRef, useState } from 'react';
import { cancelActiveAttachmentUpload, uploadAttachmentAsset } from '../services/platform';

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export function useAttachmentUpload({ chatId, blocked, replyToMessageId, onMessage, onReplyConsumed }) {
  const [uploading, setUploading] = useState(false);
  const [attachmentProgress, setAttachmentProgress] = useState(0);
  const [attachmentError, setAttachmentError] = useState('');
  const cancelRequestedRef = useRef(false);

  const uploadAttachment = useCallback((asset, setAttachmentDraft) => {
    if (!asset || uploading || blocked) return;
    const size = Number(asset.fileSize ?? asset.size ?? 0);
    if (size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError('Files must be 25 MB or smaller.');
      return;
    }
    cancelRequestedRef.current = false;
    setAttachmentError('');
    setAttachmentProgress(0);
    setAttachmentDraft(asset);
  }, [blocked, uploading]);

  const sendAttachment = useCallback(async (attachmentDraft, clearDraft) => {
    if (!attachmentDraft || uploading || blocked) return;
    cancelRequestedRef.current = false;
    setUploading(true);
    setAttachmentError('');
    setAttachmentProgress(0);
    try {
      const { data } = await uploadAttachmentAsset(attachmentDraft, {
        chat_id: chatId,
        download_policy: 'APPROVAL_REQUIRED',
        reply_to_message_id: replyToMessageId || undefined,
        multipartPartMode: attachmentDraft.multipartPartMode || 'expo-file',
        onProgress: progress => setAttachmentProgress(progress),
        onCancelAvailable: cancel => {
          if (cancelRequestedRef.current && cancel) cancel();
        },
      });
      if (data.message) onMessage?.(data.message);
      clearDraft?.();
      onReplyConsumed?.();
      setAttachmentProgress(1);
    } catch (error) {
      if (error?.code === 'UPLOAD_CANCELLED') {
        setAttachmentProgress(0);
        setAttachmentError('');
        clearDraft?.();
        return;
      }
      setAttachmentError(error?.message || 'Unable to upload attachment. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [blocked, chatId, onMessage, onReplyConsumed, replyToMessageId, uploading]);

  const cancelUpload = useCallback(() => {
    if (!uploading) return false;
    cancelRequestedRef.current = true;
    return cancelActiveAttachmentUpload();
  }, [uploading]);

  return {
    uploading,
    attachmentProgress,
    attachmentError,
    setAttachmentError,
    setAttachmentProgress,
    uploadAttachment,
    sendAttachment,
    cancelUpload,
  };
}
