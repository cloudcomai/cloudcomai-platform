export function getNotificationChatId(item) {
  const value = item?.data?.chat_id;
  if (value === undefined || value === null || value === '') return null;
  const chatId = Number(value);
  return Number.isSafeInteger(chatId) && chatId > 0 ? chatId : null;
}

export function canOpenNotification(item) {
  return getNotificationChatId(item) !== null;
}
