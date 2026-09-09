import { buildForwardPayload, getMessageLongPressActions } from './messageActions';

describe('message long-press actions', () => {
  test('includes forward between copy and delete', () => {
    expect(getMessageLongPressActions({ canDeleteForAll: true }).map((a) => a.key)).toEqual([
      'reply', 'copy', 'forward', 'delete_for_me', 'delete_for_all',
    ]);
  });

  test('builds a forward payload for text and attachments', () => {
    expect(buildForwardPayload({ id: 12, content: 'hello', attachment_id: 8, attachment_type: 'video' }, 44)).toEqual({
      chat_id: 44,
      content: 'hello',
      attachment_id: 8,
      attachment_type: 'video',
      reply_to_id: null,
      forwarded_from_id: 12,
    });
  });
});
