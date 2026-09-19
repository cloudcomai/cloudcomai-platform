<?php
declare(strict_types=1);

$cron = file_get_contents(__DIR__ . '/../cron_cleanup.php');
$retention = file_get_contents(__DIR__ . '/../lib/retention.php');
$example = file_get_contents(__DIR__ . '/../cron/daily-cleanup.cron.example');

$checks = [
    'CLI accepts --dry-run' => str_contains($cron, "'--dry-run'"),
    'dry-run reaches cleanup service' => str_contains($cron, '$dryRun'),
    'retention exposes dry-run mode' => str_contains($retention, 'bool $dryRun = false'),
    'dry-run counts expired messages' => str_contains($retention, 'COUNT(DISTINCT m.id)'),
    'dry-run reports attachment bytes' => str_contains($retention, "'attachment_bytes'"),
    'daily schedule remains 02:15 UTC' => str_contains($example, '15 2 * * *'),
    'GoDaddy docs include safe preview' => str_contains($example, '--dry-run'),
];
foreach ($checks as $name => $passed) {
    if (!$passed) { fwrite(STDERR, "FAIL: $name\n"); exit(1); }
}
echo "retention cleanup CLI checks passed\n";
