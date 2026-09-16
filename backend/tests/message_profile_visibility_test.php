<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$handler = (string)file_get_contents($root . '/api/messages.php');
$payload = (string)file_get_contents($root . '/lib/message_payload.php');
$mobile = (string)file_get_contents(dirname($root) . '/apps/mobile/src/components/MediaMessage.js');

assert(str_contains($handler, 'INNER JOIN chats c ON c.id=m.chat_id'));
assert(str_contains($handler, 'c.type="public" AND m.sender_id<>?'));
assert(str_contains($handler, 'fr.status="accepted"'));
assert(str_contains($handler, 'fr.requester_id=? AND fr.recipient_id=m.sender_id'));
assert(str_contains($handler, 'fr.requester_id=m.sender_id AND fr.recipient_id=?'));
assert(str_contains($handler, 'END AS show_profile'));
assert(str_contains($handler, '$user[\'id\'], $user[\'id\'], $user[\'id\'], $clearedThrough'));

assert(str_contains($payload, 'c.type=\"group\" AND m.sender_id<>?'));
assert(str_contains($payload, 'fr.status=\"accepted\"'));
assert(str_contains($payload, 'if (isset($groupProfileIds')));
assert(str_contains($payload, '$message[\'show_profile\']=1;'));
assert(str_contains($payload, 'array_key_exists(\'show_profile\', $message)'));

assert(str_contains($mobile, 'Number(message.show_profile) === 1 && message.sender_id'));
assert(substr_count($mobile, '{profileAction}') >= 4);
assert(!str_contains($mobile, "{message.sender_id ? <Pressable style={styles.profileLink}"));

echo "message_profile_visibility_test.php passed\n";
