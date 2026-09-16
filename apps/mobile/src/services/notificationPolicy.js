export const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({
  enabled: true,
  message: true,
  group: true,
  attachment: true,
  system: true,
  sound: true,
  vibration: true,
  preview: true,
});

export function notificationChannelId(preferences = DEFAULT_NOTIFICATION_PREFERENCES) {
  if (!preferences.sound && !preferences.vibration) return 'messages_silent_v2';
  if (preferences.sound && preferences.vibration) return 'messages_alerts_v2';
  if (preferences.sound) return 'messages_sound_v2';
  return 'messages_vibration_v2';
}

export function notificationPreview(messageType, body, previewEnabled) {
  if (!previewEnabled) return 'New message';
  const type = String(messageType || 'text').toLowerCase();
  if (type === 'image' || type === 'photo') return 'Photo';
  if (type === 'video') return 'Video';
  if (type === 'voice' || type === 'audio') return 'Voice message';
  if (type === 'file' || type === 'document') return 'File';
  if (type !== 'text') return 'Attachment';
  const text = String(body || '').trim().replace(/\s+/g, ' ');
  return text.length > 120 ? `${text.slice(0, 119)}…` : (text || 'New message');
}

export function shouldSuppressSameChat({ appState, activeChatId, notificationChatId, category }) {
  const chatId = Number(notificationChatId);
  return appState === 'active'
    && ['message', 'group', 'attachment'].includes(category)
    && Number.isSafeInteger(chatId)
    && chatId > 0
    && chatId === Number(activeChatId);
}
