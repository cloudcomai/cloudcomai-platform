const MESSAGE_CATEGORIES = new Set(['message', 'group', 'attachment']);

export function shouldNotifyWithFeedback(notification, preferences) {
  const category = notification?.request?.content?.data?.category || 'system';
  return Boolean(
    preferences?.enabled !== false &&
    preferences?.[category] !== false &&
    MESSAGE_CATEGORIES.has(category),
  );
}
