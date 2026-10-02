<?php
declare(strict_types=1);

$source = file_get_contents(__DIR__ . '/../lib/message_payload.php');
if ($source === false) throw new RuntimeException('Unable to read message_payload.php');

assert(str_contains($source, 'Legacy poll messages can exist in private chats'), 'private poll compatibility guard must be documented');
assert(str_contains($source, "$message['type'] = 'text';"), 'legacy private polls must become text messages');
assert(str_contains($source, "$message['body'] = 'Poll';"), 'legacy private polls must display Poll');
assert(str_contains($source, "$message['poll_id'] = null;"), 'private poll renderer must not receive poll id');
assert(str_contains($source, "$message['poll'] = null;"), 'private poll renderer must not receive poll payload');
assert(str_contains($source, "(string)$row['type'] !== 'group' && (string)$row['type'] !== 'public'"), 'only group/public messages may retain poll rendering');

echo "private-poll-render-safety.test.php passed\n";
