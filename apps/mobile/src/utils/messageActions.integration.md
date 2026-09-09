## Integration checklist

- Call `getMessageLongPressActions()` from the message long-press handler.
- Render the returned actions in the existing dropdown/action sheet.
- On `forward`, open the existing chat/user picker and call the chat send endpoint with `buildForwardPayload(message, destinationChatId)`.
- Keep delete-for-me/delete-for-all permission checks supplied by the caller.
