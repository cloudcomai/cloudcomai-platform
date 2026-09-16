<?php
declare(strict_types=1);
$root = dirname(__DIR__);
$fresh = (string)file_get_contents($root . '/database/fresh-install.sql');
$schema = (string)file_get_contents($root . '/sql/schema.sql');
foreach ([$fresh, $schema] as $sql) {
    assert(str_contains($sql, 'thumbnail_filename'));
    assert(str_contains($sql, 'duration_seconds'));
}
assert(str_contains($schema, 'story_views'));
echo "consolidated_schema_test.php passed\n";
