<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit("CLI only\n"); }
require __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/account_backup.php';

if (!backup_configured()) { fwrite(STDERR, "Cloud backup encryption is not configured\n"); exit(1); }
$rows = db()->query("SELECT s.user_id,s.automatic_frequency,s.include_videos,b.last_backup_at FROM account_backup_settings s INNER JOIN users u ON u.id=s.user_id AND u.account_status='active' LEFT JOIN account_backups b ON b.user_id=s.user_id WHERE s.automatic_frequency<>'off' AND u.email_verified=1 AND u.email IS NOT NULL")->fetchAll();
$completed = 0; $failed = 0;
foreach ($rows as $row) {
    if (!backup_due($row['last_backup_at'], $row['automatic_frequency'])) continue;
    try { create_backup((int)$row['user_id'], (bool)$row['include_videos']); $completed++; }
    catch (Throwable $error) { $failed++; fwrite(STDERR, 'Backup failed for account ' . (int)$row['user_id'] . ': ' . $error->getMessage() . "\n"); }
}
echo "CloudComAI account backups completed: $completed; failed: $failed\n";
exit($failed ? 1 : 0);
