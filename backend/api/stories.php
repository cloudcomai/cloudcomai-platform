<?php
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/story_access.php';

$user = auth_user();
$userId = (int)$user['id'];
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
ensureStoryViewsTable();
ensure_story_privacy_tables();

if ($method === 'PUT') {
    $data = input();
    if (($data['action'] ?? '') !== 'privacy') fail('Unsupported Moments privacy action', 422);
    $ids = $data['hidden_user_ids'] ?? [];
    if (!is_array($ids)) fail('Hidden contacts must be a list', 422);
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids), static fn(int $id): bool => $id > 0 && $id !== $userId)));
    if (count($ids) > 500) fail('You can hide status from at most 500 contacts', 422);

    $pdo = db();
    foreach ($ids as $hiddenId) {
        $valid = $pdo->prepare('SELECT 1 FROM users WHERE id=? AND account_status="active" LIMIT 1');
        $valid->execute([$hiddenId]);
        if (!$valid->fetchColumn() || !story_contact_relationship($userId, $hiddenId)) fail('Only active saved CloudComAI contacts can be hidden', 422);
    }
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM user_story_hidden_contacts WHERE user_id=?')->execute([$userId]);
        $insert = $pdo->prepare('INSERT INTO user_story_hidden_contacts(user_id,hidden_user_id,created_at) VALUES(?,?,UTC_TIMESTAMP())');
        foreach ($ids as $hiddenId) $insert->execute([$userId, $hiddenId]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    out(['hidden_user_ids' => $ids, 'saved' => true]);
}

if ($method === 'POST') {
    $data = input();
    $action = strtolower(trim((string)($data['action'] ?? 'create')));

    if ($action === 'view') {
        $storyId = (int)($data['story_id'] ?? 0);
        if ($storyId <= 0 || !can_view_story($storyId, $userId)) fail('Moment not found or expired', 404);
        $storyOwner = db()->prepare('SELECT user_id FROM stories WHERE id=? LIMIT 1');
        $storyOwner->execute([$storyId]);
        if ((int)$storyOwner->fetchColumn() === $userId) out(['story_id' => $storyId, 'counted' => false, 'count' => storyViewCount($storyId)]);
        $stmt = db()->prepare('INSERT IGNORE INTO story_views(story_id,viewer_id,viewed_at) VALUES(?,?,UTC_TIMESTAMP())');
        $stmt->execute([$storyId, $userId]);
        out(['story_id' => $storyId, 'counted' => $stmt->rowCount() > 0, 'count' => storyViewCount($storyId)]);
    }

    if ($action === 'delete') {
        $storyId = (int)($data['story_id'] ?? 0);
        if ($storyId <= 0) fail('Moment id is required', 422);
        deleteStory($storyId, $userId);
        out(['story_id' => $storyId, 'deleted' => true]);
    }

    $type = strtolower(trim((string)($data['type'] ?? 'text')));
    $audience = strtolower(trim((string)($data['audience'] ?? 'contacts')));
    if (!in_array($type, ['text', 'photo', 'video'], true)) fail('Invalid Moment type', 422);
    if (!in_array($audience, ['contacts', 'groups', 'friends', 'public'], true)) fail('Invalid Moments audience', 422);
    $groupIds = $data['group_ids'] ?? [];
    if (!is_array($groupIds)) fail('Selected groups must be a list', 422);
    $groupIds = array_values(array_unique(array_filter(array_map('intval', $groupIds), static fn(int $id): bool => $id > 0)));
    if ($audience === 'groups' && !$groupIds) fail('Select at least one group before publishing', 422);
    if ($audience !== 'groups') $groupIds = [];

    // A user can only target groups where they are currently an active member.
    foreach ($groupIds as $groupId) {
        $member = db()->prepare('SELECT 1 FROM chats c INNER JOIN chat_members cm ON cm.chat_id=c.id AND cm.user_id=? AND cm.status="active" WHERE c.id=? AND c.type="group" LIMIT 1');
        $member->execute([$userId, $groupId]);
        if (!$member->fetchColumn()) fail('One or more selected groups are no longer available', 422);
    }

    $content = $data['content'] ?? '';
    $storedMediaPath = null;
    if ($type === 'text') {
        if (!is_string($content)) fail('Moment text is required', 422);
        $content = trim($content);
        $length = preg_match_all('/./us', $content);
        if ($content === '' || $length === false || $length > 500) fail('Moments text must contain 1 to 500 characters', 422);
    } else {
        if (!is_array($content)) fail('Moment media content is invalid', 422);
        $filename = basename((string)($content['media_filename'] ?? ''));
        if ($filename === '' || !preg_match('/^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|mp4|mov|webm)$/i', $filename)) fail('Moment media is invalid', 422);
        $storedMediaPath = dirname(__DIR__) . '/uploads/stories/' . $userId . '/' . $filename;
        if (!is_file($storedMediaPath)) fail('Moment media is unavailable', 422);
        $caption = trim((string)($content['caption'] ?? ''));
        $captionLength = preg_match_all('/./us', $caption);
        if ($captionLength === false || $captionLength > 500) fail('Moment caption must contain at most 500 characters', 422);
        $content = ['media_filename' => $filename, 'caption' => $caption];
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO stories(user_id,type,content,audience,created_at,expires_at) VALUES(?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()+INTERVAL 36 HOUR)');
        $stmt->execute([$userId, $type, is_string($content) ? $content : json_encode($content, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $audience]);
        $storyId = (int)$pdo->lastInsertId();
        if ($groupIds) {
            $insertGroup = $pdo->prepare('INSERT INTO story_groups(story_id,chat_id) VALUES(?,?)');
            foreach ($groupIds as $groupId) $insertGroup->execute([$storyId, $groupId]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($storedMediaPath && is_file($storedMediaPath)) @unlink($storedMediaPath);
        error_log('Moments creation failed for user ' . $userId . ': ' . $error->getMessage());
        fail('The Moment could not be published. Please try again.', 500);
    }

    out(['story_id' => $storyId, 'expires_in_hours' => 36], 201);
}

if ($method === 'DELETE') {
    $storyId = (int)($_GET['id'] ?? 0);
    if ($storyId <= 0) fail('Moment id is required', 422);
    deleteStory($storyId, $userId);
    out(['story_id' => $storyId, 'deleted' => true]);
}

if ($method === 'GET') {
    $action = strtolower(trim((string)($_GET['action'] ?? 'list')));
    if ($action === 'privacy') {
        $stmt = db()->prepare('SELECT hidden_user_id FROM user_story_hidden_contacts WHERE user_id=? ORDER BY hidden_user_id');
        $stmt->execute([$userId]);
        out(['hidden_user_ids' => array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN))]);
    }
    if ($action === 'viewers') {
        $storyId = (int)($_GET['story_id'] ?? 0);
        if ($storyId <= 0) fail('Moment id is required', 422);
        $owner = db()->prepare('SELECT id,user_id FROM stories WHERE id=? AND deleted_at IS NULL LIMIT 1');
        $owner->execute([$storyId]);
        $story = $owner->fetch();
        if (!$story || (int)$story['user_id'] !== $userId) fail('Viewer details are available only to the Moment owner', 403);
        $stmt = db()->prepare('SELECT sv.viewer_id,u.name,u.user_id AS username,sv.viewed_at FROM story_views sv INNER JOIN users u ON u.id=sv.viewer_id AND u.account_status="active" WHERE sv.story_id=? ORDER BY sv.viewed_at DESC');
        $stmt->execute([$storyId]);
        $viewers = array_map(static function(array $row): array {
            $row['avatar_url'] = 'v1/media?type=user&id=' . (int)$row['viewer_id'];
            return $row;
        }, $stmt->fetchAll());
        out(['story_id' => $storyId, 'count' => count($viewers), 'viewers' => $viewers]);
    }

    $stmt = db()->prepare('SELECT s.id,s.user_id,s.type,s.content,s.audience,s.created_at,s.expires_at,u.name,
        CASE WHEN s.user_id=? THEN 1 ELSE 0 END AS is_owner,
        CASE WHEN sv.viewer_id IS NULL THEN 0 ELSE 1 END AS watched,
        (SELECT COUNT(*) FROM story_views vcount WHERE vcount.story_id=s.id) AS view_count
        FROM stories s INNER JOIN users u ON u.id=s.user_id AND u.account_status="active"
        LEFT JOIN story_views sv ON sv.story_id=s.id AND sv.viewer_id=?
        WHERE s.expires_at>UTC_TIMESTAMP() AND s.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.user_id=? AND b.blocked_user_id=s.user_id) OR (b.blocked_user_id=? AND b.user_id=s.user_id))
        AND (s.user_id=? OR NOT EXISTS (SELECT 1 FROM user_story_hidden_contacts h WHERE h.user_id=s.user_id AND h.hidden_user_id=?))
        ORDER BY watched ASC,s.created_at DESC,s.id DESC LIMIT 200');
    $stmt->execute([$userId,$userId,$userId,$userId,$userId,$userId]);
    $stories = [];
    foreach ($stmt->fetchAll() as $row) {
        if (!can_view_story((int)$row['id'], $userId)) continue;
        $parsed = in_array($row['type'], ['photo','video'], true) ? json_decode((string)$row['content'], true) : null;
        if (is_array($parsed)) {
            $row['caption'] = (string)($parsed['caption'] ?? '');
            $row['media_url'] = 'v1/stories/media?story_id=' . (int)$row['id'];
            $row['media_extension'] = strtolower((string)pathinfo((string)($parsed['media_filename'] ?? ''), PATHINFO_EXTENSION));
            if (!in_array($row['media_extension'], ['jpg','jpeg','png','webp','mp4','mov','webm'], true)) $row['media_extension'] = 'jpg';
        } else {
            $row['caption'] = '';
            $row['media_url'] = null;
            $row['media_extension'] = null;
        }
        $row['content'] = is_string($row['content']) ? $row['content'] : '';
        $row['view_count'] = (int)$row['view_count'];
        $row['watched'] = (bool)$row['watched'];
        $row['is_owner'] = (bool)$row['is_owner'];
        $stories[] = $row;
    }
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
    if ($stmt->rowCount() === 0) fail('Moment not found or already deleted', 404);
}

function storyViewCount(int $storyId): int {
    $stmt = db()->prepare('SELECT COUNT(*) FROM story_views WHERE story_id=?');
    $stmt->execute([$storyId]);
    return (int)$stmt->fetchColumn();
}

function findVisibleStory(int $storyId, int $viewerId): ?array {
    if (!can_view_story($storyId, $viewerId)) return null;
    $stmt = db()->prepare('SELECT id,user_id,audience,expires_at FROM stories WHERE id=? AND deleted_at IS NULL AND expires_at>UTC_TIMESTAMP() LIMIT 1');
    $stmt->execute([$storyId]);
    return $stmt->fetch() ?: null;
}
