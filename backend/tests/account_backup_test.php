<?php
declare(strict_types=1);
require __DIR__ . '/../lib/account_backup.php';

$config = ['app' => ['backup_encryption_key' => 'unit-test-key-with-at-least-32-characters']];
function backup_check(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
$plain = json_encode(['account_id' => 1, 'messages' => [['body' => 'Encrypted message 😀']]], JSON_THROW_ON_ERROR);
$encrypted = encrypt_backup($plain, 1);
backup_check(decrypt_backup($encrypted, 1) === $plain, 'Encrypted backup did not round-trip');
backup_check(!str_contains($encrypted, 'Encrypted message'), 'Backup contains plaintext');
backup_check(encrypt_backup($plain, 1) !== $encrypted, 'Backup reused encryption nonce');
$tampered = $encrypted; $tampered[strlen($tampered)-1] = chr(ord($tampered[strlen($tampered)-1]) ^ 1);
foreach ([[$encrypted, 2], [$tampered, 1], [substr($encrypted, 0, 30), 1]] as [$payload, $userId]) {
    try { decrypt_backup($payload, $userId); throw new RuntimeException('Invalid or cross-account backup decrypted'); }
    catch (AccountBackupException $error) { backup_check($error->getCode() === 422, 'Unexpected decryption failure'); }
}
$config['app']['backup_encryption_key'] = 'GENERATE_A_RANDOM_SECRET';
backup_check(!backup_configured(), 'Placeholder encryption key was accepted');
try { encrypt_backup($plain, 1); throw new RuntimeException('Missing backup key accepted'); }
catch (AccountBackupException $error) { backup_check($error->getCode() === 503, 'Missing backup key should fail clearly'); }
$now = strtotime('2026-09-15 12:00:00 UTC');
foreach (['daily'=>86400,'weekly'=>604800,'monthly'=>2592000] as $frequency=>$interval) {
    backup_check(backup_due(null, $frequency, $now), 'Initial scheduled backup is not due');
    backup_check(!backup_due(gmdate('Y-m-d H:i:s', $now-$interval+1), $frequency, $now), 'Scheduled backup ran early');
    backup_check(backup_due(gmdate('Y-m-d H:i:s', $now-$interval), $frequency, $now), 'Scheduled backup missed boundary');
}
backup_check(!backup_due(null, 'off', $now), 'Disabled schedule ran');
backup_check(backup_attachment_path('../config/config.php') === null, 'Attachment path escaped storage');
echo "Account backup encryption, account binding, corruption detection, configuration and scheduling tests passed\n";
