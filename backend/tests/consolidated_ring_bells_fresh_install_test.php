<?php
declare(strict_types=1);
$root = dirname(__DIR__);
$fresh = (string)file_get_contents($root . '/database/fresh-install.sql');
$companion = (string)file_get_contents($root . '/database/fresh-install-ring-bells.sql');
assert(str_contains($fresh, 'message_attachments'));
assert(str_contains($fresh, 'thumbnail_filename'));
assert(str_contains($companion, 'story_views'));
assert(str_contains($companion, 'LONGTEXT'));
echo "consolidated_ring_bells_fresh_install_test.php passed\n";
