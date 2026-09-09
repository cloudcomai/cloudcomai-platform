export const getMessageLongPressActions = ({
  canDeleteForAll = false,
  canEdit = false,
  canForward = true,
}) => {
  const actions = [
    { key: 'reply', label: 'Reply' },
    { key: 'copy', label: 'Copy text' },
  ];

  if (canForward) actions.push({ key: 'forward', label: 'Forward' });
  if (canEdit) actions.push({ key: 'edit', label: 'Edit' });
  actions.push({ key: 'delete_for_me', label: 'Delete for me' });
  if (canDeleteForAll) actions.push({ key: 'delete_for_all', label: 'Delete for all' });

  return actions;
};

export const buildForwardPayload = (message, destinationChatId) => ({
  chat_id: destinationChatId,
  content: message?.content ?? '',
  attachment_id: message?.attachment_id ?? null,
  attachment_type: message?.attachment_type ?? null,
  reply_to_id: null,
  forwarded_from_id: message?.id ?? null,
});
