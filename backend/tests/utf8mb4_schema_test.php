<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$freshInstall = file_get_contents($root . '/database/fresh-install.sql');
$migration = file_get_contents($root . '/database/migrations/009_utf8mb4_chat_content.sql');
$configExample = file_get_contents($root . '/config/config.example.php');

$failures = [];

if ($freshInstall === false || stripos($freshInstall, 'DEFAULT CHARSET=utf8mb4') === false) {
    $failures[] = 'Fresh-install schema must default tables to utf8mb4.';
}

if ($freshInstall === false || strpos($freshInstall, "('009_utf8mb4_chat_content.sql', UTC_TIMESTAMP())") === false) {
    $failures[] = 'Fresh-install schema must baseline migration 009 so new installations do not replay it.';
}

if ($configExample === false || strpos($configExample, "'charset' => 'utf8mb4'") === false) {
    $failures[] = 'Database connection example must use utf8mb4.';
}

foreach (['messages', 'notification_history', 'polls', 'poll_options'] as $table) {
    if ($migration === false || stripos($migration, "ALTER TABLE {$table} CONVERT TO CHARACTER SET utf8mb4") === false) {
        $failures[] = "Migration must convert {$table} to utf8mb4.";
    }
}

if ($failures) {
    fwrite(STDERR, implode(PHP_EOL, $failures) . PHP_EOL);
    exit(1);
}

echo "utf8mb4 schema checks passed\n";
