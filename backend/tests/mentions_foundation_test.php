<?php
declare(strict_types=1);

$contract = json_decode((string)file_get_contents(__DIR__ . '/../api-contract.json'), true, 512, JSON_THROW_ON_ERROR);
assert(isset($contract['routes']['v1/mentions']));
assert($contract['routes']['v1/mentions']['handler'] === 'mentions.php');
assert(in_array('GET', $contract['routes']['v1/mentions']['methods'], true));
assert(in_array('POST', $contract['routes']['v1/mentions']['methods'], true));

$handler = (string)file_get_contents(__DIR__ . '/../api/mentions.php');
assert(str_contains($handler, "action === 'candidates'"));
assert(str_contains($handler, "!== 'open'"));
assert(str_contains($handler, "mm.removed_at IS NULL"));
assert(str_contains($handler, "cm.status=\"active\""));
assert(str_contains($handler, "m.deleted_for_everyone=0"));
assert(str_contains($handler, "COALESCE(mus.hidden,0)=0"));

$helper = (string)file_get_contents(__DIR__ . '/../lib/mentions.php');
assert(str_contains($helper, "['group', 'public']"));
assert(str_contains($helper, "retained mention: do not re-notify"));
assert(str_contains($helper, "removed_at=UTC_TIMESTAMP()"));
assert(str_contains($helper, "'event'=>'mention'"));

$migration = (string)file_get_contents(__DIR__ . '/../database/migrations/027_message_mentions.sql');
assert(str_contains($migration, 'CREATE TABLE IF NOT EXISTS message_mentions'));
assert(str_contains($migration, 'idx_message_mentions_recipient_unread'));
assert(str_contains($migration, 'removed_at DATETIME NULL'));
assert(str_contains($migration, 'notification_id BIGINT UNSIGNED NULL'));

$fresh = (string)file_get_contents(__DIR__ . '/../database/fresh-install.sql');
$schema = (string)file_get_contents(__DIR__ . '/../sql/schema.sql');
assert(str_contains($fresh, "('027_message_mentions.sql', UTC_TIMESTAMP())"));
assert(str_contains($fresh, 'CREATE TABLE IF NOT EXISTS message_mentions'));
assert(str_contains($schema, 'CREATE TABLE IF NOT EXISTS message_mentions'));

$endpoints = (string)file_get_contents(__DIR__ . '/../../packages/api-client/src/endpoints.js');
$client = (string)file_get_contents(__DIR__ . '/../../packages/api-client/src/cloudcomai-api.js');
assert(str_contains($endpoints, "MENTIONS: 'v1/mentions'"));
assert(str_contains($client, 'searchMentionCandidates'));
assert(str_contains($client, 'openMention'));

echo "mentions_foundation_test.php passed\n";
