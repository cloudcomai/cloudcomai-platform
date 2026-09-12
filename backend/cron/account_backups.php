<?php

declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';

if (PHP_SAPI !== 'cli') { http_response_code(403); exit("CLI only\n"); }
$secret = trim((string)($config['app']['backup_cron_secret'] ?? ''));
if ($secret === '' || str_contains($secret, 'GENERATE')) exit("Backup cron secret is not configured\n");
$baseUrl = rtrim((string)($config['app']['base_url'] ?? ''), '/');
if ($baseUrl === '') exit("API base URL is not configured\n");

$pdo = db();
$rows = $pdo->query("SELECT s.user_id,s.automatic_frequency,s.include_videos,b.last_backup_at FROM account_backup_settings s INNER JOIN users u ON u.id=s.user_id AND u.account_status='active' LEFT JOIN account_backups b ON b.user_id=s.user_id WHERE s.automatic_frequency<>'off' AND u.email_verified=1 AND u.email IS NOT NULL")->fetchAll();
$now = time(); $completed = 0;
foreach ($rows as $row) {
    $last = $row['last_backup_at'] ? strtotime((string)$row['last_backup_at'] . ' UTC') : 0;
    $interval = ['daily'=>86400,'weekly'=>604800,'monthly'=>2592000][(string)$row['automatic_frequency']] ?? PHP_INT_MAX;
    if ($last > 0 && ($now - $last) < $interval) continue;
    $context = stream_context_create(['http'=>[
        'method'=>'POST',
        'header'=>"Content-Type: application/json\r\nX-CLOUCOMAI-BACKUP-CRON: {$secret}\r\nX-CLOUCOMAI-BACKUP-USER: ".(int)$row['user_id']."\r\n",
        'content'=>json_encode(['action'=>'backup','include_videos'=>(bool)$row['include_videos']]),
        'ignore_errors'=>true,
        'timeout'=>120,
    ]]);
    $response=@file_get_contents($baseUrl.'/v1/users/backup',false,$context);
    if ($response !== false && str_contains($response,'"message":"Backup completed"')) $completed++;
}
echo "CloudComAI account backups completed: {$completed}\n";
