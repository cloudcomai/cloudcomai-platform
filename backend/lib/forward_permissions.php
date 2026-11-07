<?php
declare(strict_types=1);

/**
 * Forwarding is restricted to accepted friends/contacts.
 *
 * A private destination must have an active recipient who is an accepted
 * friend. For a group destination every active, writable member other than
 * the sender must be an accepted friend. A block in either direction always
 * overrides an accepted friend record.
 */
function assert_forward_destination_contacts(int $chatId, int $senderId, string $chatType): void
{
    if (!in_array($chatType, ['private', 'group'], true)) {
        fail('Forwarding is available only to private chats and groups', 403);
    }

    $recipients = db()->prepare('
        SELECT
            COUNT(*) AS recipient_count,
            SUM(CASE WHEN
                NOT EXISTS (
                    SELECT 1
                    FROM friend_requests fr
                    WHERE fr.status="accepted"
                      AND ((fr.requester_id=? AND fr.recipient_id=cm.user_id)
                        OR (fr.requester_id=cm.user_id AND fr.recipient_id=?))
                )
                OR EXISTS (
                    SELECT 1
                    FROM user_blocks b
                    WHERE (b.user_id=? AND b.blocked_user_id=cm.user_id)
                       OR (b.user_id=cm.user_id AND b.blocked_user_id=?)
                )
            THEN 1 ELSE 0 END) AS unauthorized_count
        FROM chat_members cm
        WHERE cm.chat_id=?
          AND cm.user_id<>?
          AND cm.status="active"
    ');
    $recipients->execute([$senderId, $senderId, $senderId, $senderId, $chatId, $senderId]);
    $result = $recipients->fetch() ?: [];
    $recipientCount = (int)($result['recipient_count'] ?? 0);
    if ($recipientCount < 1) {
        fail('Select a private chat or group with at least one active recipient', 403);
    }
    if ($chatType === 'private' && $recipientCount !== 1) {
        fail('Private chat forwarding is limited to one added contact', 403);
    }
    if ((int)($result['unauthorized_count'] ?? 0) > 0) {
        fail('Forwarding is limited to contacts/friends you have added. Every active group member must be your accepted friend.', 403);
    }
}
