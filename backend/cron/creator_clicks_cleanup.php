<?php
declare(strict_types=1);

// Run from cron/CLI only. This worker is scoped exclusively to Creator Clicks.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require __DIR__ . '/../lib/bootstrap.php';
$pdo = db();
$batchSize = 100;

function cc_worker_queue_manifest(PDO $pdo, int $creatorId, ?string $manifest): void {
    if (!$manifest) return;
    $decoded = json_decode($manifest, true);
    if (!is_array($decoded)) return;
    $items = $decoded['files'] ?? $decoded;
    if (!is_array($items)) return;
    foreach ($items as $item) {
        $filename = is_string($item) ? $item : (is_array($item) ? (string)($item['filename'] ?? '') : '');
        if ($filename === '' || basename($filename) !== $filename || !preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,254}$/', $filename)) continue;
        $stmt = $pdo->prepare('INSERT IGNORE INTO creator_clicks_media_cleanup(creator_id,filename,status,created_at) VALUES(?,?,"pending",UTC_TIMESTAMP())');
        $stmt->execute([$creatorId, $filename]);
    }
}

// Retention is measured from the original publication timestamp. Feed expiry
// is independent and does not delete channel history.
$expired = $pdo->prepare('SELECT id,creator_id,media_manifest FROM creator_clicks_posts WHERE expires_at<=UTC_TIMESTAMP() AND deleted_at IS NULL ORDER BY expires_at,id LIMIT ' . $batchSize);
$expired->execute();
$expiredRows = $expired->fetchAll();
foreach ($expiredRows as $post) {
    $pdo->beginTransaction();
    try {
        $lock = $pdo->prepare('SELECT id,media_manifest FROM creator_clicks_posts WHERE id=? AND expires_at<=UTC_TIMESTAMP() AND deleted_at IS NULL FOR UPDATE');
        $lock->execute([(int)$post['id']]);
        $current = $lock->fetch();
        if ($current) {
            cc_worker_queue_manifest($pdo, (int)$post['creator_id'], $current['media_manifest'] ?? null);
            foreach (['creator_clicks_reactions','creator_clicks_post_views','creator_clicks_reports'] as $table) {
                $pdo->prepare('DELETE FROM ' . $table . ' WHERE post_id=?')->execute([(int)$post['id']]);
            }
            $pdo->prepare('DELETE FROM creator_clicks_posts WHERE id=?')->execute([(int)$post['id']]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('Creator Clicks retention failure for post ' . (int)$post['id'] . ': ' . $error->getMessage());
    }
}

$items = $pdo->prepare('SELECT id,creator_id,filename FROM creator_clicks_media_cleanup WHERE status IN ("pending","failed") AND attempts<8 ORDER BY id LIMIT ' . $batchSize);
$items->execute();
$deleted = 0;
foreach ($items->fetchAll() as $item) {
    $id = (int)$item['id'];
    $creatorId = (int)$item['creator_id'];
    $filename = (string)$item['filename'];
    if ($filename === '' || basename($filename) !== $filename || !preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,254}$/', $filename)) {
        $pdo->prepare('UPDATE creator_clicks_media_cleanup SET status="failed",attempts=attempts+1,last_error="Invalid stored filename" WHERE id=?')->execute([$id]);
        continue;
    }
    $referenced = $pdo->prepare('SELECT 1 FROM creator_clicks_posts WHERE creator_id=? AND deleted_at IS NULL AND JSON_SEARCH(media_manifest,"one",?) IS NOT NULL LIMIT 1');
    $referenced->execute([$creatorId, $filename]);
    if ($referenced->fetchColumn()) {
        $pdo->prepare('UPDATE creator_clicks_media_cleanup SET status="failed",attempts=0,last_error="Retained: referenced by another post" WHERE id=?')->execute([$id]);
        continue;
    }
    $base = realpath(__DIR__ . '/../uploads/creator-clicks');
    if ($base === false) {
        $pdo->prepare('UPDATE creator_clicks_media_cleanup SET status="failed",attempts=attempts+1,last_error="Creator Clicks media directory is unavailable" WHERE id=?')->execute([$id]);
        continue;
    }
    $creatorDir = realpath($base . DIRECTORY_SEPARATOR . $creatorId);
    $target = $creatorDir !== false ? $creatorDir . DIRECTORY_SEPARATOR . $filename : '';
    if ($creatorDir === false || !str_starts_with($creatorDir, $base . DIRECTORY_SEPARATOR) || !is_file($target)) {
        $pdo->prepare('UPDATE creator_clicks_media_cleanup SET status="deleted",processed_at=UTC_TIMESTAMP() WHERE id=?')->execute([$id]);
        continue;
    }
    if (@unlink($target)) {
        $pdo->prepare('UPDATE creator_clicks_media_cleanup SET status="deleted",processed_at=UTC_TIMESTAMP(),last_error=NULL WHERE id=?')->execute([$id]);
        $deleted++;
    } else {
        $pdo->prepare('UPDATE creator_clicks_media_cleanup SET status="failed",attempts=attempts+1,last_error="Unable to remove media file" WHERE id=?')->execute([$id]);
    }
}
echo json_encode(['expired_posts_checked' => count($expiredRows), 'media_files_deleted' => $deleted], JSON_UNESCAPED_SLASHES) . PHP_EOL;
