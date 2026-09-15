<?php
declare(strict_types=1);

$contract=json_decode((string)file_get_contents(__DIR__.'/../api-contract.json'),true,512,JSON_THROW_ON_ERROR);
assert(isset($contract['routes']['v1/messages/read']));
assert($contract['routes']['v1/messages/read']['handler']==='message_read_receipts.php');
assert(in_array('GET',$contract['routes']['v1/messages/read']['methods'],true));
assert(in_array('POST',$contract['routes']['v1/messages/read']['methods'],true));

$handler=(string)file_get_contents(__DIR__.'/../api/message_read_receipts.php');
assert(str_contains($handler,'message_read_receipts'));
assert(str_contains($handler,"!in_array($message['type'], ['private', 'group'], true)"));
assert(str_contains($handler,'$message[\'sender_id\']'));
assert(str_contains($handler,'read_by'));
assert(str_contains($handler,'cm.status=\'active\''));

$migration=(string)file_get_contents(__DIR__.'/../database/migrations/017_message_read_receipts.sql');
assert(str_contains($migration,'CREATE TABLE IF NOT EXISTS message_read_receipts'));
assert(str_contains($migration,'PRIMARY KEY (message_id, user_id)'));
assert(str_contains($migration,'read_at'));

$schema=(string)file_get_contents(__DIR__.'/../sql/schema.sql');
assert(str_contains($schema,'CREATE TABLE message_read_receipts'));
assert(str_contains($schema,'PRIMARY KEY(message_id,user_id)'));

echo "message_read_receipts_feature_test.php passed\n";
