<?php
declare(strict_types=1);

$source = file_get_contents(__DIR__ . '/../api/chats.php');
if ($source === false) {
    throw new RuntimeException('Unable to read chats.php');
}

// Expiry controls message visibility and unread counts, not whether an active
// private conversation itself exists in the chat list.
if (strpos($source, 'AND (c.type <> "private" OR EXISTS (') !== false) {
    throw new RuntimeException('Private chats must remain listed when all their messages have expired.');
}

foreach ([
    'COALESCE(cus.hidden,0) = 0 OR EXISTS',
    'm.expires_at IS NULL OR m.expires_at > UTC_TIMESTAMP()',
    'um.expires_at IS NULL OR um.expires_at > UTC_TIMESTAMP()',
    'hm.expires_at IS NULL OR hm.expires_at > UTC_TIMESTAMP()',
    'ORDER BY COALESCE(last_message_at, c.created_at) DESC, c.id DESC',
] as $expected) {
    if (strpos($source, $expected) === false) {
        throw new RuntimeException('Chat list visibility/ordering regression: missing ' . $expected);
    }
}

echo "Private chat expiry list regression tests passed\n";
