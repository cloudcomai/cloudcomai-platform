<?php
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
$user = auth_user();
$userId = (int)$user['id'];
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
ensureStoryViewsTable();

if ($method === 'POST') {
    $data = input();
    $action = strtolower(trim((string)($data['action'] ?? 'create')));

    if ($action === 'view') {
        $storyId = (int)($data['story_id'] ?? 0);
        if ($storyId <= 0) fail('Story id is required', 422);
        $story = findVisibleStory($storyId, $userId);
        if (!$story) fail('Ring Bell not found or expired', 404);
        if ((int)$story['user_id'] === $userId) out(['story_id' => $storyId, 'counted' => false, 'count' => storyViewCount($storyId)]);
        $stmt = db()->prepare('INSERT IGNORE INTO story_views(story_id,viewer_id,viewed_at) VALUES(?,?,UTC_TIMESTAMP())');
        $stmt->execute([$storyId, $userId]);
        out(['story_id' => $storyId, 'counted' => $stmt->rowCount() > 0, 'count' => storyViewCount($storyId)]);
    }

    if ($action === 'delete') {
        $storyId = (int)($data['story_id'] ?? 0);
        if ($storyId <= 0) fail('Story id is required', 422);
        deleteStory($storyId, $userId);
        out(['story_id' => $storyId, 'deleted' => true]);
    }

    $type = strtolower(trim((string)($data['type'] ?? 'text')));
    $audience = strtolower(trim((string)($data['audience'] ?? 'friends')));
    if (!in_array($type, ['text', 'photo', 'video'], true)) fail('Invalid Ring Bell type', 422);
    if (!in_array($audience, ['friends', 'public'], true)) fail('Invalid Ring Bells audience', 422);
    $content = $data['content'] ?? '';
    $storedMediaPath = null;

    if ($type === 'text') {
        if (!is_string($content)) fail('Story content required', 422);
        $content = trim($content);
        $length = preg_match_all('/./us', $content);
        if ($content === '' || $length === false || $length > 700) fail('Ring Bells must contain 1 to 700 characters', 422);
    } else {
        if (!is_array($content)) fail('Media Ring Bell content is invalid', 422);
        $filename = basename((string)($content['media_filename'] ?? ''));
        if ($filename === '' || !preg_match('/^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|mp4|mov|webm)$/i', $filename)) fail('Ring Bell media is invalid', 422);
        $storedMediaPath = dirname(__DIR__) . '/uploads/stories/' . $userId . '/' . $filename;
        if (!is_file($storedMediaPath)) fail('Ring Bell media is unavailable', 422);
        $caption = trim((string)($content['caption'] ?? ''));
        $captionLength = preg_match_all('/./us', $caption);
        if ($captionLength !== false && $captionLength > 700) fail('Ring Bell caption must contain at most 700 characters', 422);
        $content = ['media_filename' => $filename, 'caption' => $caption];
    }

    try {
        $st = db()->prepare('INSERT INTO stories(user_id,type,content,audience,created_at,expires_at) VALUES(?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()+INTERVAL 36 HOUR)');
        $st->execute([$userId, $type, is_string($content) ? $content : json_encode($content, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $audience]);
        $storyId = (int)db()->lastInsertId();
    } catch (Throwable $error) {
        if ($storedMediaPath && is_file($storedMediaPath)) @unlink($storedMediaPath);
        error_log('Ring Bell story creation failed for user ' . $userId . ': ' . $error->getMessage());
        fail('The media uploaded successfully, but the Ring Bell could not be created. Please try again.', 500);
    }

    out(['story_id' => $storyId, 'expires_in_hours' => 36], 201);
}

if ($method === 'DELETE') {
    $storyId = (int)($_GET['id'] ?? 0);
    if ($storyId <= 0) fail('Story id is required', 422);
    deleteStory($storyId, $userId);
    out(['story_id' => $storyId, 'deleted' => true]);
}

if ($method === 'GET') {
    $action = strtolower(trim((string)($_GET['action'] ?? 'list')));
    if ($action === 'viewers') {
        $storyId = (int)($_GET['story_id'] ?? 0);
        if ($storyId <= 0) fail('Story id is required', 422);
        $owner = db()->prepare('SELECT id,user_id FROM stories WHERE id=? AND deleted_at IS NULL LIMIT 1');
        $owner->execute([$storyId]);
        $story = $owner->fetch();
        if (!$story || (int)$story['user_id'] !== $userId) fail('Viewer details are available only to the Ring Bell owner', 403);
        $stmt = db()->prepare('SELECT sv.viewer_id,u.name,u.user_id AS username,sv.viewed_at FROM story_views sv INNER JOIN users u ON u.id=sv.viewer_id AND u.account_status="active" WHERE sv.story_id=? ORDER BY sv.viewed_at DESC');
        $stmt->execute([$storyId]);
        $viewers = array_map(static function(array $row): array {
            $row['avatar_url'] = 'v1/media?type=user&id=' . (int)$row['viewer_id'];
            return $row;
        }, $stmt->fetchAll());
        out(['story_id' => $storyId, 'count' => count($viewers), 'viewers' => $viewers]);
    }

    $st = db()->prepare(<<<'SQL'
        SELECT s.id,s.user_id,s.type,s.content,s.audience,s.created_at,s.expires_at,u.name,
               CASE WHEN s.user_id=? THEN 1 ELSE 0 END AS is_owner,
               CASE WHEN sv.viewer_id IS NULL THEN 0 ELSE 1 END AS watched,
               (SELECT COUNT(*) FROM story_views vcount WHERE vcount.story_id=s.id) AS view_count
        FROM stories s
        INNER JOIN users u ON u.id=s.user_id AND u.account_status='active'
        LEFT JOIN story_views sv ON sv.story_id=s.id AND sv.viewer_id=?
        WHERE s.expires_at>UTC_TIMESTAMP() AND s.deleted_at IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM user_blocks b
              WHERE (b.user_id=? AND b.blocked_user_id=s.user_id)
                 OR (b.blocked_user_id=? AND b.user_id=s.user_id)
          )
          AND (s.user_id=? OR s.audience='public' OR (s.audience='friends' AND (
              EXISTS (SELECT 1 FROM friend_requests fr WHERE fr.status='accepted'
                  AND ((fr.requester_id=? AND fr.recipient_id=s.user_id)
                    OR (fr.recipient_id=? AND fr.requester_id=s.user_id)))
              OR EXISTS (SELECT 1 FROM chats c
                  INNER JOIN chat_members viewer ON viewer.chat_id=c.id AND viewer.user_id=? AND viewer.status='active'
                  INNER JOIN chat_members author ON author.chat_id=c.id AND author.user_id=s.user_id AND author.status='active'
                  WHERE c.type='private')
          )))
        ORDER BY watched ASC,s.created_at DESC,s.id DESC LIMIT 100
    SQL);
    $st->execute([$userId,$userId,$userId,$userId,$userId,$userId,$userId,$userId]);
    $stories = array_map(static function(array $row): array {
        $parsed = in_array($row['type'], ['photo','video'], true) ? json_decode((string)$row['content'], true) : null;
        if (is_array($parsed)) {
            $row['caption'] = (string)($parsed['caption'] ?? '');
            $row['media_url'] = 'v1/stories/media?story_id=' . (int)$row['id'];
        } else {
            $row['caption'] = '';
            $row['media_url'] = null;
        }
        unset($row['content']);
        $row['view_count'] = (int)$row['view_count'];
        $row['watched'] = (bool)$row['watched'];
        $row['is_owner'] = (bool)$row['is_owner'];
        return $row;
    }, $st->fetchAll());
    header('Cache-Control: private, no-store');
    out(['stories' => $stories]);
}

fail('Method not allowed', 405);

function ensureStoryViewsTable(): void {
    static $ready = false;
    if ($ready) return;
    db()->exec('CREATE TABLE IF NOT EXISTS story_views (story_id BIGINT UNSIGNED NOT NULL, viewer_id BIGINT UNSIGNED NOT NULL, viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (story_id, viewer_id), INDEX idx_story_views_viewer_story (viewer_id, story_id), INDEX idx_story_views_story_viewed_at (story_id, viewed_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    $ready = true;
}

function deleteStory(int $storyId, int $userId): void {
    $stmt = db()->prepare('UPDATE stories SET deleted_at=UTC_TIMESTAMP() WHERE id=? AND user_id=? AND deleted_at IS NULL');
    $stmt->execute([$storyId, $userId]);
    if ($stmt->rowCount() === 0) fail('Ring Bell not found or already deleted', 404);
}

function storyViewCount(int $storyId): int {
    $stmt = db()->prepare('SELECT COUNT(*) FROM story_views WHERE story_id=?');
    $stmt->execute([$storyId]);
    return (int)$stmt->fetchColumn();
}

function findVisibleStory(int $storyId, int $viewerId): ?array {
    $stmt = db()->prepare('SELECT id,user_id,audience,expires_at FROM stories WHERE id=? AND deleted_at IS NULL AND expires_at>UTC_TIMESTAMP() LIMIT 1');
    $stmt->execute([$storyId]);
    $story = $stmt->fetch();
    if (!$story) return null;
    if ((int)$story['user_id'] === $viewerId || $story['audience'] === 'public') return $story;
    $friend = db()->prepare('SELECT 1 FROM friend_requests WHERE status="accepted" AND ((requester_id=? AND recipient_id=?) OR (requester_id=? AND recipient_id=?)) LIMIT 1');
    $friend->execute([$viewerId,$story['user_id'],$story['user_id'],$viewerId]);
    return $friend->fetch() ? $story : null;
}