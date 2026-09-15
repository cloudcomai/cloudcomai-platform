<?php
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/account_backup.php';

$user = auth_user();
$userId = (int)$user['id'];
$method = $_SERVER['REQUEST_METHOD'];
header('Cache-Control: private, no-store');
try {
    if ($method === 'GET') {
        if (($_GET['status'] ?? '') === '1') out(['backup' => backup_status($userId)]);
        // Preserve the existing JSON export for older clients and explicit export=1 requests.
        $payload = build_backup_payload($userId);
        $payload['format'] = 'cloudcomai-account-backup'; $payload['version'] = 1;
        $payload['exported_at'] = $payload['created_at'];
        header('Content-Disposition: attachment; filename="cloudcomai-account-backup-' . gmdate('Ymd-His') . '.json"');
        out($payload);
    }
    if ($method === 'PUT') out(['backup' => update_backup_settings($userId, input())]);
    if ($method === 'POST') {
        $input = input(); $action = $input['action'] ?? 'backup';
        if ($action === 'backup') {
            if (array_key_exists('include_videos', $input) && !is_bool($input['include_videos'])) fail('include_videos must be true or false', 422);
            $settings = backup_status($userId);
            out(['message' => 'Backup completed', 'backup' => create_backup($userId, $input['include_videos'] ?? $settings['include_videos'])]);
        }
        if ($action === 'restore') out(['message' => 'Backup restored', 'restore' => restore_backup($userId)]);
        fail('Unsupported backup action', 422);
    }
    fail('Method not allowed', 405);
} catch (AccountBackupException $error) {
    fail($error->getMessage(), $error->getCode());
}
