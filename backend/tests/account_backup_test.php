<?php
declare(strict_types=1);

$contract=json_decode((string)file_get_contents(__DIR__.'/../api-contract.json'),true,512,JSON_THROW_ON_ERROR);
$route=$contract['routes']['v1/users/backup']??null;
assert($route !== null);
assert($route['handler']==='backup.php');
foreach(['GET','POST','PUT'] as $method) assert(in_array($method,$route['methods'],true));

$handler=(string)file_get_contents(__DIR__.'/../api/backup.php');
foreach(['aes-256-gcm','account_backup_settings','account_backups','account_backup_versions','email_verified','backup_cron_secret','include_videos','restore_backup'] as $needle) assert(str_contains($handler,$needle));
assert(str_contains($handler,'CCAI-BACKUP-1'));
assert(str_contains($handler,"0600"));
assert(str_contains($handler,"action==='restore'"));

$schema=(string)file_get_contents(__DIR__.'/../sql/schema.sql');
$migration=(string)file_get_contents(__DIR__.'/../sql/migrations/20260912_account_backup.sql');
foreach(['account_backup_settings','account_backups','account_backup_versions'] as $table){assert(str_contains($schema,"CREATE TABLE {$table}"));assert(str_contains($migration,"CREATE TABLE IF NOT EXISTS {$table}"));}

$cron=(string)file_get_contents(__DIR__.'/../cron/account_backups.php');
assert(str_contains($cron,'automatic_frequency'));
assert(str_contains($cron,"'daily'=>86400"));
assert(str_contains($cron,"'weekly'=>604800"));
assert(str_contains($cron,"'monthly'=>2592000"));

$mobile=(string)file_get_contents(__DIR__.'/../../apps/mobile/src/components/PrivacySettings.js');
foreach(['Chat Backup','BACK UP NOW','Automatic backup','Include videos','Backup over Wi-Fi only','Restore backup','Export account data','Preparing backup','Uploading encrypted backup','Backup completed'] as $needle) assert(str_contains($mobile,$needle));

echo "account_backup_test.php passed\n";
