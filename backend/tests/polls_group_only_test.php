<?php
declare(strict_types=1);

$handler=(string)file_get_contents(__DIR__.'/../api/polls.php');
foreach([
    '$d[\'chat_ids\']',
    'if ($id > 0 && !in_array($id, $normalizedChatIds, true))',
    'Polls can only be created for groups',
    '$chatRow[\'type\'] !== \'group\'',
    'count($cleanOptions) < 3',
    'Please enter at least 3 poll options.',
    'foreach ($destinations as $destination)',
    'poll_ids',
    'messages',
    'poll_expiry.php',
] as $needle) {
    assert(str_contains($handler,$needle),$needle);
}

$fresh=(string)file_get_contents(__DIR__.'/../database/fresh-install.sql');
foreach(['CREATE TABLE IF NOT EXISTS polls','CREATE TABLE IF NOT EXISTS poll_options','CREATE TABLE IF NOT EXISTS poll_votes'] as $needle){
    assert(str_contains($fresh,$needle),$needle);
}

// Poll creation is intentionally implemented without a schema migration: each
// selected group receives its own existing poll row, options, message and votes.
assert(!file_exists(__DIR__.'/../database/migrations/025_group_only_polls.sql'));

echo "polls_group_only_test.php passed\n";
