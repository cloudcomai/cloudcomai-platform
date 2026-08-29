export function formatMessageTime(value) {
  if (!value) return 'Just Now';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });
}
