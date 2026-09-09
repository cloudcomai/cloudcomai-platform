<?php
declare(strict_types=1);

function cleanup_expired_content(PDO $pdo, string $backendRoot, int $batchSize = 500, int $maxBatches = 100): array {
    $batchSize = max(1, min(1000, $batchSize));
    $counts = ['messages'=>0, 'files'=>0, 'file_failures'=>0, 'skipped'=>false];
    $lockName = substr((string)$pdo->query('SELECT DATABASE()')->fetchColumn(), 0, 40) . ':retention';
    $lock = $pdo->prepare('SELECT GET_LOCK(?,0)');
    $lock->execute([$lockName]);
    if (!(int)$lock->fetchColumn()) { $counts['skipped'] = true; return $counts; }
    try {
        for ($batch=0; $batch<$maxBatches; $batch++) {
            $pdo->beginTransaction();
            $rows = $pdo->query("SELECT id,chat_id,type,body FROM messages WHERE expires_at IS NOT NULL AND expires_at<=UTC_TIMESTAMP() ORDER BY expires_at,id LIMIT $batchSize FOR UPDATE")->fetchAll();
            if (!$rows) { $pdo->commit(); break; }
            $ids = array_column($rows, 'id');
            $marks = implode(',', array_fill(0, count($ids), '?'));
            $execute = static function(string $sql, array $parameters) use ($pdo): void { $pdo->prepare($sql)->execute($parameters); };
            $execute("INSERT IGNORE INTO file_cleanup_queue(storage_path) SELECT storage_path FROM message_attachments WHERE message_id IN ($marks)", $ids);
            $execute("DELETE FROM attachment_download_requests WHERE attachment_id IN (SELECT id FROM message_attachments WHERE message_id IN ($marks))", $ids);
            $execute("DELETE FROM message_attachments WHERE message_id IN ($marks)", $ids);
            $execute("DELETE q FROM notification_delivery_queue q INNER JOIN notification_history n ON n.id=q.notification_id WHERE CAST(JSON_UNQUOTE(JSON_EXTRACT(n.data_json,'$.message_id')) AS UNSIGNED) IN ($marks)", $ids);
            $execute("DELETE FROM notification_history WHERE CAST(JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.message_id')) AS UNSIGNED) IN ($marks)", $ids);
            $execute("DELETE FROM message_user_states WHERE message_id IN ($marks)", $ids);
            $execute("DELETE FROM saved_messages WHERE message_id IN ($marks)", $ids);
            foreach ($rows as $row) {
                if ($row['type'] !== 'poll') continue;
                $pollId = (int)(json_decode((string)$row['body'], true)['poll_id'] ?? 0);
                // Only remove a poll owned by this conversation.
                $execute('DELETE v FROM poll_votes v INNER JOIN polls p ON p.id=v.poll_id WHERE p.id=? AND p.chat_id=?', [$pollId,$row['chat_id']]);
                $execute('DELETE o FROM poll_options o INNER JOIN polls p ON p.id=o.poll_id WHERE p.id=? AND p.chat_id=?', [$pollId,$row['chat_id']]);
                $execute('DELETE FROM polls WHERE id=? AND chat_id=?', [$pollId,$row['chat_id']]);
            }
            $execute("INSERT IGNORE INTO message_deletions(message_id,chat_id) SELECT id,chat_id FROM messages WHERE id IN ($marks)", $ids);
            // Scrub quoted references before deleting the original content.
            $execute("UPDATE messages SET reply_to_message_id=NULL,edited_at=UTC_TIMESTAMP() WHERE reply_to_message_id IN ($marks)", $ids);
            $execute("DELETE FROM messages WHERE id IN ($marks)", $ids);
            $pdo->commit();
            $counts['messages'] += count($rows);
        }
        // Filesystem deletion happens after commit and is retried on subsequent runs.
        $storageRoot = realpath($backendRoot . '/storage/attachments');
        $paths = $pdo->query('SELECT storage_path FROM file_cleanup_queue ORDER BY attempts,created_at LIMIT 5000')->fetchAll(PDO::FETCH_COLUMN);
        foreach ($paths as $relative) {
            try {
                if (!preg_match('~^storage/attachments/[a-zA-Z0-9_.-]+$~D', $relative)) throw new RuntimeException('Invalid attachment path');
                $path = $backendRoot . '/' . $relative;
                $resolved = realpath($path);
                if ($resolved !== false && (!$storageRoot || !str_starts_with($resolved, $storageRoot . DIRECTORY_SEPARATOR))) throw new RuntimeException('Attachment path is outside storage');
                if ((file_exists($path) || is_link($path)) && !@unlink($path)) throw new RuntimeException('Unable to remove attachment file');
                $pdo->prepare('DELETE FROM file_cleanup_queue WHERE storage_path=?')->execute([$relative]);
                $counts['files']++;
            } catch (Throwable $error) {
                $pdo->prepare('UPDATE file_cleanup_queue SET attempts=attempts+1,last_error=? WHERE storage_path=?')->execute([substr($error->getMessage(),0,255),$relative]);
                $counts['file_failures']++;
            }
        }
        $pdo->exec('UPDATE live_locations SET active=0 WHERE expires_at<=UTC_TIMESTAMP() AND active=1');
        $pdo->exec('UPDATE stories SET deleted_at=UTC_TIMESTAMP(),content="" WHERE expires_at<=UTC_TIMESTAMP() AND deleted_at IS NULL');
        $pdo->exec('UPDATE calls SET status="missed",updated_at=UTC_TIMESTAMP() WHERE status="ringing" AND expires_at<=UTC_TIMESTAMP()');
        $pdo->beginTransaction();
        $pdo->exec('DELETE v FROM poll_votes v INNER JOIN polls p ON p.id=v.poll_id WHERE p.closes_at<=UTC_TIMESTAMP()');
        $pdo->exec('DELETE o FROM poll_options o INNER JOIN polls p ON p.id=o.poll_id WHERE p.closes_at<=UTC_TIMESTAMP()');
        $pdo->exec('DELETE FROM polls WHERE closes_at<=UTC_TIMESTAMP()');
        $pdo->commit();
        $pdo->exec('DELETE sd FROM user_session_devices sd INNER JOIN user_sessions s ON s.id=sd.session_id WHERE s.expires_at<UTC_TIMESTAMP()-INTERVAL 30 DAY');
        $pdo->exec('DELETE FROM user_sessions WHERE expires_at<UTC_TIMESTAMP()-INTERVAL 30 DAY');
        return $counts;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    } finally {
        $pdo->prepare('SELECT RELEASE_LOCK(?)')->execute([$lockName]);
    }
}
