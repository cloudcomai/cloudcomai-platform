<?php
declare(strict_types=1);

final class AccountBackupException extends RuntimeException {}

function backup_account(int $userId, bool $requireVerified = false): array {
    $st = db()->prepare('SELECT id,email,email_verified,account_status FROM users WHERE id=?');
    $st->execute([$userId]);
    $account = $st->fetch();
    if (!$account || $account['account_status'] !== 'active') throw new AccountBackupException('Account unavailable', 404);
    if ($requireVerified && (!$account['email_verified'] || trim((string)$account['email']) === '')) {
        throw new AccountBackupException('A verified registered email address is required for cloud backup and restore', 422);
    }
    return $account;
}

function backup_configured(): bool {
    global $config;
    $key = trim((string)($config['app']['backup_encryption_key'] ?? ''));
    return strlen($key) >= 32 && !str_contains($key, 'GENERATE');
}

function backup_key(): string {
    global $config;
    if (!backup_configured()) throw new AccountBackupException('Cloud backup encryption is not configured on the server', 503);
    return hash('sha256', trim((string)$config['app']['backup_encryption_key']), true);
}

function backup_dir(): string {
    global $config;
    $dir = (string)($config['app']['backup_dir'] ?? dirname(__DIR__) . '/storage/backups');
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) throw new AccountBackupException('Backup storage is unavailable', 500);
    @chmod($dir, 0700);
    $resolved = realpath($dir);
    if ($resolved === false) throw new AccountBackupException('Backup storage is unavailable', 500);
    return $resolved;
}

function encrypt_backup(string $plain, int $userId): string {
    $iv = random_bytes(12); $tag = '';
    $cipher = openssl_encrypt($plain, 'aes-256-gcm', backup_key(), OPENSSL_RAW_DATA, $iv, $tag, 'cloudcomai-backup:' . $userId, 16);
    if ($cipher === false) throw new AccountBackupException('Unable to encrypt backup', 500);
    return "CCAI-BACKUP-1\0" . $iv . $tag . $cipher;
}

function decrypt_backup(string $payload, int $userId): string {
    $prefix = "CCAI-BACKUP-1\0";
    if (!str_starts_with($payload, $prefix) || strlen($payload) <= strlen($prefix) + 28) throw new AccountBackupException('Backup format is invalid', 422);
    $offset = strlen($prefix);
    $plain = openssl_decrypt(substr($payload, $offset + 28), 'aes-256-gcm', backup_key(), OPENSSL_RAW_DATA, substr($payload, $offset, 12), substr($payload, $offset + 12, 16), 'cloudcomai-backup:' . $userId);
    if ($plain === false) throw new AccountBackupException('Backup could not be decrypted', 422);
    return $plain;
}

function backup_status(int $userId): array {
    $account = backup_account($userId);
    $st = db()->prepare('SELECT automatic_frequency,include_videos,wifi_only FROM account_backup_settings WHERE user_id=?');
    $st->execute([$userId]); $settings = $st->fetch() ?: [];
    $st = db()->prepare('SELECT version,backup_size,last_backup_at FROM account_backups WHERE user_id=?');
    $st->execute([$userId]); $backup = $st->fetch() ?: [];
    return [
        'configured' => backup_configured(), 'available' => (bool)$backup,
        'restore_available' => (bool)$backup && backup_configured() && (bool)$account['email_verified'] && trim((string)$account['email']) !== '',
        'backup_account_email' => strtolower(trim((string)$account['email'])), 'email_verified' => (bool)$account['email_verified'],
        'automatic_frequency' => $settings['automatic_frequency'] ?? 'off',
        'include_videos' => (bool)($settings['include_videos'] ?? false), 'wifi_only' => (bool)($settings['wifi_only'] ?? true),
        'version' => (int)($backup['version'] ?? 0), 'backup_size' => (int)($backup['backup_size'] ?? 0),
        'last_backup_at' => isset($backup['last_backup_at']) ? str_replace(' ', 'T', $backup['last_backup_at']) . 'Z' : null,
    ];
}

function update_backup_settings(int $userId, array $input): array {
    $account = backup_account($userId, true);
    $current = backup_status($userId);
    $frequency = $input['automatic_frequency'] ?? $current['automatic_frequency'];
    if (!in_array($frequency, ['off','daily','weekly','monthly'], true)) throw new AccountBackupException('Invalid backup frequency', 422);
    foreach (['include_videos','wifi_only'] as $key) {
        if (array_key_exists($key, $input) && !is_bool($input[$key])) throw new AccountBackupException($key . ' must be true or false', 422);
    }
    $st = db()->prepare('INSERT INTO account_backup_settings(user_id,backup_account_email,automatic_frequency,include_videos,wifi_only,updated_at) VALUES(?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE backup_account_email=VALUES(backup_account_email),automatic_frequency=VALUES(automatic_frequency),include_videos=VALUES(include_videos),wifi_only=VALUES(wifi_only),updated_at=UTC_TIMESTAMP()');
    $st->execute([$userId, strtolower($account['email']), $frequency, (int)($input['include_videos'] ?? $current['include_videos']), (int)($input['wifi_only'] ?? $current['wifi_only'])]);
    return backup_status($userId);
}

function backup_rows(string $sql, array $params): array {
    $st = db()->prepare($sql); $st->execute($params); return $st->fetchAll();
}

function backup_attachment_path(string $relative): ?string {
    $root = realpath(dirname(__DIR__) . '/storage/attachments');
    if (!$root || !preg_match('#^storage/attachments/[^/\\\\]+$#D', $relative)) return null;
    $path = $root . '/' . basename($relative);
    if (is_link($path)) return null;
    $resolved = realpath($path);
    return $resolved === false ? $path : (str_starts_with($resolved, $root . DIRECTORY_SEPARATOR) ? $resolved : null);
}

function backup_attachment_allowed(array $attachment, int $userId): bool {
    if ((int)$attachment['sender_id'] === $userId || $attachment['download_policy'] === 'ALLOW') return true;
    if ($attachment['download_policy'] !== 'APPROVAL_REQUIRED') return false;
    $st = db()->prepare("SELECT 1 FROM attachment_download_requests WHERE attachment_id=? AND requester_id=? AND request_type='DOWNLOAD' AND status='APPROVED'");
    $st->execute([$attachment['id'], $userId]); return (bool)$st->fetchColumn();
}

function build_backup_payload(int $userId, bool $includeVideos = false, bool $includeFiles = false): array {
    global $config;
    $profile = backup_rows('SELECT id,user_id,name,email,mobile,dob,gender,email_verified,mobile_verified,account_status,created_at,updated_at FROM users WHERE id=?', [$userId])[0];
    $visible = <<<'SQL'
        FROM messages m INNER JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=? AND cm.status='active'
        LEFT JOIN chat_user_states cus ON cus.chat_id=m.chat_id AND cus.user_id=cm.user_id
        LEFT JOIN message_user_states mus ON mus.message_id=m.id AND mus.user_id=cm.user_id
        WHERE COALESCE(cus.hidden,0)=0 AND m.id>COALESCE(cus.cleared_through_message_id,0) AND m.deleted_for_everyone=0
          AND COALESCE(mus.hidden,0)=0 AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP())
    SQL;
    $messages = backup_rows('SELECT m.id,m.chat_id,m.sender_id,m.type,m.body,m.reply_to_message_id,m.edit_count,m.edited_at,m.expires_at,m.created_at ' . $visible . ' ORDER BY m.chat_id,m.id', [$userId]);
    $attachments = backup_rows('SELECT a.*,m.chat_id,m.sender_id FROM message_attachments a INNER JOIN messages m ON m.id=a.message_id WHERE m.id IN (SELECT m.id ' . $visible . ') ORDER BY a.id', [$userId]);
    $bytes = 0; $maxBytes = (int)($config['app']['backup_max_bytes'] ?? 25 * 1024 * 1024);
    foreach ($attachments as &$attachment) {
        $path = backup_attachment_path((string)$attachment['storage_path']);
        $isVideo = str_starts_with(strtolower($attachment['mime_type']), 'video/');
        if ($includeFiles && (!$isVideo || $includeVideos) && backup_attachment_allowed($attachment, $userId) && $path && is_file($path)) {
            $bytes += (int)filesize($path);
            if ($bytes > $maxBytes) throw new AccountBackupException('Backup media exceeds the server backup size limit; exclude videos or contact the administrator', 413);
            $contents = file_get_contents($path);
            if ($contents === false) throw new AccountBackupException('Unable to read backup media', 500);
            $attachment['file_data_base64'] = base64_encode($contents);
            $attachment['sha256'] = hash('sha256', $contents);
        }
        unset($attachment['storage_path'], $attachment['stored_filename'], $attachment['sender_id']);
    }
    unset($attachment);
    return [
        'format' => 'cloudcomai-chat-backup', 'version' => 2, 'account_id' => $userId, 'created_at' => gmdate('Y-m-d\TH:i:s\Z'),
        'profile' => $profile, 'privacy_settings' => user_privacy_settings($userId),
        'preferences' => backup_rows('SELECT interest,display_order,pinned,hidden,updated_at FROM user_interests WHERE user_id=? ORDER BY display_order,interest', [$userId]),
        'blocked_contacts' => backup_rows('SELECT blocked_user_id,created_at FROM user_blocks WHERE user_id=? ORDER BY created_at', [$userId]),
        'phone_contacts' => backup_rows('SELECT contact_key,display_name,email,phone,created_at,updated_at FROM phone_contacts WHERE user_id=? ORDER BY id', [$userId]),
        'google_contacts' => backup_rows('SELECT display_name,given_name,family_name,email,phone,resource_name,updated_at FROM google_contacts WHERE user_id=? AND deleted_at IS NULL ORDER BY id', [$userId]),
        'chats' => backup_rows("SELECT c.id,c.type,c.name,c.group_category,c.owner_id,c.retention_seconds,c.created_at,cm.role,cm.joined_at,COALESCE(cus.cleared_through_message_id,0) AS cleared_through_message_id FROM chats c INNER JOIN chat_members cm ON cm.chat_id=c.id AND cm.user_id=? AND cm.status='active' LEFT JOIN chat_user_states cus ON cus.chat_id=c.id AND cus.user_id=cm.user_id WHERE COALESCE(cus.hidden,0)=0 ORDER BY c.id", [$userId]),
        'messages' => $messages, 'attachments' => $attachments,
        'notes' => ['Restore preserves current membership, original senders and deletion/expiration rules. Attachment bytes are included only when the account can download them.'],
    ];
}

function with_backup_lock(int $userId, callable $action): array {
    global $config;
    $lock = 'ccai-backup-' . hash('sha256', $config['db']['name'] . ':' . $userId);
    $lock = substr($lock, 0, 64);
    $st = db()->prepare('SELECT GET_LOCK(?,0)'); $st->execute([$lock]);
    if ((int)$st->fetchColumn() !== 1) throw new AccountBackupException('A backup or restore is already running for this account', 409);
    try { return $action(); }
    finally { $st = db()->prepare('SELECT RELEASE_LOCK(?)'); $st->execute([$lock]); }
}

function create_backup(int $userId, bool $includeVideos): array {
    backup_account($userId, true); backup_key();
    return with_backup_lock($userId, static function () use ($userId, $includeVideos): array {
        global $config;
        $pdo = db();
        $payload = json_encode(build_backup_payload($userId, $includeVideos, true), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        if (strlen($payload) > (int)($config['app']['backup_max_bytes'] ?? 25 * 1024 * 1024)) throw new AccountBackupException('Backup exceeds the server backup size limit', 413);
        $encrypted = encrypt_backup($payload, $userId); unset($payload);
        $dir = backup_dir(); $final = $dir . '/' . bin2hex(random_bytes(16)) . '.backup'; $tmp = $final . '.tmp';
        if (file_put_contents($tmp, $encrypted, LOCK_EX) !== strlen($encrypted)) { @unlink($tmp); throw new AccountBackupException('Unable to store backup', 500); }
        @chmod($tmp, 0600);
        if (!rename($tmp, $final)) { @unlink($tmp); throw new AccountBackupException('Unable to finalize backup', 500); }
        try {
            $pdo->beginTransaction();
            $old = backup_rows('SELECT file_path FROM account_backups WHERE user_id=?', [$userId]);
            $st = $pdo->prepare('SELECT COALESCE(MAX(version),0)+1 FROM account_backup_versions WHERE user_id=?'); $st->execute([$userId]); $version = (int)$st->fetchColumn();
            $pdo->prepare('INSERT INTO account_backup_versions(user_id,version,file_path,backup_size,created_at) VALUES(?,?,?,?,UTC_TIMESTAMP())')->execute([$userId, $version, $final, strlen($encrypted)]);
            $pdo->prepare('INSERT INTO account_backups(user_id,version,file_path,backup_size,last_backup_at,created_at) VALUES(?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE version=VALUES(version),file_path=VALUES(file_path),backup_size=VALUES(backup_size),last_backup_at=UTC_TIMESTAMP()')->execute([$userId, $version, $final, strlen($encrypted)]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            @unlink($final); throw $error;
        }
        $oldPath = isset($old[0]) ? realpath($old[0]['file_path']) : false;
        if ($oldPath && str_starts_with($oldPath, $dir . DIRECTORY_SEPARATOR) && $oldPath !== $final) @unlink($oldPath);
        return backup_status($userId);
    });
}

function restore_backup(int $userId): array {
    backup_account($userId, true); backup_key();
    return with_backup_lock($userId, static function () use ($userId): array {
        $pdo = db();
        $rows = backup_rows('SELECT file_path FROM account_backups WHERE user_id=?', [$userId]);
        $path = isset($rows[0]) ? realpath($rows[0]['file_path']) : false;
        if (!$path || !str_starts_with($path, backup_dir() . DIRECTORY_SEPARATOR) || !is_file($path)) throw new AccountBackupException('No cloud backup is available', 404);
        $decoded = json_decode(decrypt_backup((string)file_get_contents($path), $userId), true, 512, JSON_THROW_ON_ERROR);
        if (($decoded['format'] ?? '') !== 'cloudcomai-chat-backup' || (int)($decoded['account_id'] ?? 0) !== $userId) throw new AccountBackupException('Backup account does not match', 422);
        $counts = ['chats'=>0, 'messages'=>0, 'contacts'=>0, 'preferences'=>0, 'files'=>0, 'skipped_messages'=>0];
        $restoredMessages = []; $createdFiles = [];
        $pdo->beginTransaction();
        try {
            foreach ($decoded['preferences'] ?? [] as $preference) {
                $pdo->prepare('INSERT INTO user_interests(user_id,interest,display_order,pinned,hidden,updated_at) VALUES(?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE display_order=VALUES(display_order),pinned=VALUES(pinned),hidden=VALUES(hidden),updated_at=UTC_TIMESTAMP()')->execute([$userId, $preference['interest'], $preference['display_order'], $preference['pinned'], $preference['hidden']]);
                $counts['preferences']++;
            }
            foreach ($decoded['phone_contacts'] ?? [] as $contact) {
                $pdo->prepare('INSERT INTO phone_contacts(user_id,contact_key,display_name,email,phone,created_at,updated_at) VALUES(?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),email=VALUES(email),phone=VALUES(phone),updated_at=UTC_TIMESTAMP()')->execute([$userId, $contact['contact_key'], $contact['display_name'] ?? null, $contact['email'] ?? null, $contact['phone'] ?? null]);
                $counts['contacts']++;
            }
            $privacy = $decoded['privacy_settings'] ?? [];
            $pdo->prepare('INSERT INTO user_privacy_settings(user_id,hide_online_status,media_auto_download,screenshot_alerts) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE hide_online_status=VALUES(hide_online_status),media_auto_download=VALUES(media_auto_download),screenshot_alerts=VALUES(screenshot_alerts)')->execute([$userId, (int)($privacy['hide_online_status'] ?? false), (int)($privacy['media_auto_download'] ?? false), (int)($privacy['screenshot_alerts'] ?? true)]);
            $pdo->prepare('INSERT INTO profile_visibility(user_id,share_email,share_mobile,share_age,share_gender) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE share_email=VALUES(share_email),share_mobile=VALUES(share_mobile),share_age=VALUES(share_age),share_gender=VALUES(share_gender)')->execute([$userId, (int)($privacy['share_email'] ?? false), (int)($privacy['share_mobile'] ?? false), (int)($privacy['share_age'] ?? true), (int)($privacy['share_gender'] ?? true)]);
            foreach ($decoded['blocked_contacts'] ?? [] as $block) {
                $pdo->prepare('INSERT IGNORE INTO user_blocks(user_id,blocked_user_id) SELECT ?,id FROM users WHERE id=? AND id<>?')->execute([$userId, $block['blocked_user_id'], $userId]);
            }
            foreach ($decoded['chats'] ?? [] as $chat) {
                $chatId = (int)$chat['id'];
                $member = $pdo->prepare("SELECT role FROM chat_members WHERE chat_id=? AND user_id=? AND status='active' FOR UPDATE");
                $member->execute([$chatId, $userId]);
                if (!$member->fetchColumn()) continue;
                $valid = [];
                foreach ($decoded['messages'] ?? [] as $message) {
                    if ((int)$message['chat_id'] !== $chatId) continue;
                    // Never recreate global rows or rewrite sender, content, poll, reply or membership identities.
                    $st = $pdo->prepare('SELECT id FROM messages WHERE id=? AND chat_id=? AND sender_id=? AND deleted_for_everyone=0 AND (expires_at IS NULL OR expires_at>UTC_TIMESTAMP()) FOR UPDATE');
                    $st->execute([$message['id'], $chatId, $message['sender_id']]);
                    if ($id = $st->fetchColumn()) $valid[] = (int)$id;
                }
                $pdo->prepare('INSERT INTO chat_user_states(chat_id,user_id,hidden,updated_at) VALUES(?,?,0,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE hidden=0,updated_at=UTC_TIMESTAMP()')->execute([$chatId, $userId]);
                if ($valid) {
                    $st = $pdo->prepare('SELECT cleared_through_message_id FROM chat_user_states WHERE chat_id=? AND user_id=? FOR UPDATE'); $st->execute([$chatId, $userId]); $oldCutoff = (int)$st->fetchColumn();
                    $newCutoff = min($oldCutoff, min($valid) - 1);
                    // Lowering a cleared-chat watermark must not reveal messages absent from this backup.
                    if ($newCutoff < $oldCutoff) {
                        $pdo->prepare('INSERT INTO message_user_states(message_id,user_id,hidden) SELECT id,?,1 FROM messages WHERE chat_id=? AND id>? AND id<=? ON DUPLICATE KEY UPDATE hidden=1')->execute([$userId, $chatId, $newCutoff, $oldCutoff]);
                    }
                    $pdo->prepare('UPDATE chat_user_states SET cleared_through_message_id=? WHERE chat_id=? AND user_id=?')->execute([$newCutoff, $chatId, $userId]);
                    $unhide = $pdo->prepare('UPDATE message_user_states SET hidden=0 WHERE user_id=? AND message_id=?');
                    foreach ($valid as $id) { $unhide->execute([$userId, $id]); $restoredMessages[$id] = true; }
                }
                $counts['chats']++;
            }
            $mediaRoot = dirname(__DIR__) . '/storage/attachments';
            if (!is_dir($mediaRoot) && !mkdir($mediaRoot, 0700, true) && !is_dir($mediaRoot)) throw new AccountBackupException('Attachment storage is unavailable', 500);
            foreach ($decoded['attachments'] ?? [] as $attachment) {
                if (!isset($restoredMessages[(int)$attachment['message_id']]) || !isset($attachment['file_data_base64'])) continue;
                $live = backup_rows('SELECT a.*,m.sender_id FROM message_attachments a INNER JOIN messages m ON m.id=a.message_id WHERE a.id=? AND a.message_id=?', [$attachment['id'], $attachment['message_id']]);
                if (!$live || !backup_attachment_allowed($live[0], $userId)) continue;
                $target = backup_attachment_path($live[0]['storage_path']);
                if (!$target || is_file($target)) continue;
                $contents = base64_decode($attachment['file_data_base64'], true);
                if ($contents === false || !hash_equals((string)($attachment['sha256'] ?? ''), hash('sha256', $contents))) throw new AccountBackupException('Backup attachment is invalid', 422);
                $handle = fopen($target, 'x');
                if (!$handle) throw new AccountBackupException('Unable to restore backup media', 500);
                $createdFiles[] = $target; @chmod($target, 0600);
                try { if (fwrite($handle, $contents) !== strlen($contents)) throw new AccountBackupException('Unable to restore backup media', 500); }
                finally { fclose($handle); }
                $counts['files']++;
            }
            $counts['messages'] = count($restoredMessages);
            $counts['skipped_messages'] = count($decoded['messages'] ?? []) - count($restoredMessages);
            $pdo->commit();
            return $counts;
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            foreach ($createdFiles as $file) @unlink($file);
            throw $error;
        }
    });
}

function backup_due(?string $lastBackup, string $frequency, ?int $now = null): bool {
    $interval = ['daily'=>86400, 'weekly'=>604800, 'monthly'=>2592000][$frequency] ?? null;
    if ($interval === null) return false;
    $last = $lastBackup ? strtotime($lastBackup . ' UTC') : false;
    return $last === false || ($now ?? time()) - $last >= $interval;
}
