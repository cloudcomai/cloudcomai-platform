<?php
declare(strict_types=1);

$contract=json_decode((string)file_get_contents(__DIR__.'/../api-contract.json'),true,512,JSON_THROW_ON_ERROR);
assert(isset($contract['routes']['v1/messages/forward']));
assert($contract['routes']['v1/messages/forward']['handler']==='forward_message.php');
assert(in_array('POST',$contract['routes']['v1/messages/forward']['methods'],true));

$handler=(string)file_get_contents(__DIR__.'/../api/forward_message.php');
assert(str_contains($handler,"source['type'] !== 'text'"));
assert(str_contains($handler,'c.type IN ("private","group")'));
assert(str_contains($handler,'forwarded_text'));
assert(str_contains($handler,'assert_chat_allows_messages'));
assert(str_contains($handler,'create_chat_notifications'));
assert(str_contains($handler,'count($chatIds) > 50'));

echo "forward_message_test.php passed\n";
