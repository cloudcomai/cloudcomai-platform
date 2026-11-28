<?php
declare(strict_types=1);

require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
$userId = (int)$user['id'];
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$pdo = db();

function cc_length(string $value): int {
    $length = preg_match_all('/./us', $value);
    return $length === false ? PHP_INT_MAX : $length;
}
function cc_blocked(PDO $pdo, int $a, int $b): bool {
    $stmt = $pdo->prepare('SELECT 1 FROM creator_clicks_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?) LIMIT 1');
    $stmt->execute([$a, $b, $b, $a]);
    if ($stmt->fetchColumn()) return true;
    $stmt = $pdo->prepare('SELECT 1 FROM user_blocks WHERE (user_id=? AND blocked_user_id=?) OR (user_id=? AND blocked_user_id=?) LIMIT 1');
    $stmt->execute([$a, $b, $b, $a]);
    return (bool)$stmt->fetchColumn();
}
function cc_profile(PDO $pdo, int $ownerId, int $viewerId): array {
    $stmt = $pdo->prepare('SELECT p.user_id,p.display_name,p.channel_name,p.avatar_path,p.channel_avatar_path,p.bio,p.category,p.platform_verified_at,p.created_at,p.updated_at,u.name,
        (SELECT COUNT(*) FROM creator_clicks_follows f WHERE f.creator_id=p.user_id) AS follower_count,
        (SELECT COUNT(*) FROM creator_clicks_posts x WHERE x.creator_id=p.user_id AND x.deleted_at IS NULL AND x.expires_at>UTC_TIMESTAMP()) AS post_count,
        EXISTS(SELECT 1 FROM creator_clicks_follows f WHERE f.creator_id=p.user_id AND f.follower_id=?) AS is_following
        FROM creator_clicks_profiles p INNER JOIN users u ON u.id=p.user_id AND u.account_status="active"
        WHERE p.user_id=? AND p.channel_deleted_at IS NULL LIMIT 1');
    $stmt->execute([$viewerId, $ownerId]);
    $row = $stmt->fetch();
    if (!$row) fail('Creator profile not found', 404);
    if (cc_blocked($pdo, $viewerId, $ownerId) && $viewerId !== $ownerId) fail('Creator profile is unavailable', 404);
    $row['follower_count'] = (int)$row['follower_count'];
    $row['post_count'] = (int)$row['post_count'];
    $row['is_following'] = (bool)$row['is_following'];
    $row['badge'] = $row['platform_verified_at'] !== null ? ($row['follower_count'] >= 10000 ? 'gold' : ($row['follower_count'] >= 1000 ? 'silver' : ($row['follower_count'] >= 100 ? 'bronze' : null))) : null;
    return $row;
}
function cc_queue_media_manifest(PDO $pdo, int $creatorId, ?string $manifest): void {
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
function cc_post_row(array $row): array {
    $row['id'] = (int)$row['id'];
    $row['creator_id'] = (int)$row['creator_id'];
    $row['follower_count'] = (int)($row['follower_count'] ?? 0);
    $row['reaction_count'] = (int)($row['reaction_count'] ?? 0);
    $row['view_count'] = (int)($row['view_count'] ?? 0);
    $row['is_owner'] = (bool)($row['is_owner'] ?? false);
    $row['my_reaction'] = $row['my_reaction'] ?: null;
    $manifest = json_decode((string)($row['media_manifest'] ?? ''), true);
    $files = is_array($manifest) ? ($manifest['files'] ?? []) : [];
    $row['media'] = [];
    foreach (is_array($files) ? $files : [] as $file) {
        if (!is_array($file) || empty($file['filename'])) continue;
        $filename = basename((string)$file['filename']);
        if (!preg_match('/^[a-f0-9]{32}\\.(jpg|png|webp|mp4|mov|webm)$/i', $filename)) continue;
        $row['media'][] = [
            'type' => (string)($file['type'] ?? 'image'),
            'mime_type' => (string)($file['mime_type'] ?? ''),
            'duration_seconds' => isset($file['duration_seconds']) ? (float)$file['duration_seconds'] : null,
            'filename' => $filename,
            'url' => 'v1/creator-clicks/media?post_id=' . (int)$row['id'] . '&file=' . rawurlencode($filename),
        ];
    }
    unset($row['media_manifest']);
    return $row;
}

if ($method === 'GET') {
    $action = strtolower(trim((string)($_GET['action'] ?? 'feed')));
    if ($action === 'directory') {
        $search = trim((string)($_GET['q'] ?? ''));
        $stmt = $pdo->prepare('SELECT p.user_id,p.display_name,p.channel_name,p.avatar_path,p.channel_avatar_path,p.bio,p.category,p.platform_verified_at,u.name,
            (SELECT COUNT(*) FROM creator_clicks_follows f WHERE f.creator_id=p.user_id) AS follower_count,
            EXISTS(SELECT 1 FROM creator_clicks_follows f WHERE f.creator_id=p.user_id AND f.follower_id=?) AS is_following
            FROM creator_clicks_profiles p INNER JOIN users u ON u.id=p.user_id AND u.account_status="active"
            WHERE p.channel_deleted_at IS NULL AND (?="" OR p.display_name LIKE ? OR p.bio LIKE ? OR p.category LIKE ?)
            AND NOT EXISTS(SELECT 1 FROM creator_clicks_follows followed WHERE followed.follower_id=? AND followed.creator_id=p.user_id)
            AND NOT EXISTS(SELECT 1 FROM creator_clicks_blocks b WHERE (b.blocker_id=? AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=?))
            AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.user_id=? AND b.blocked_user_id=p.user_id) OR (b.user_id=p.user_id AND b.blocked_user_id=?))
            ORDER BY follower_count DESC,p.updated_at DESC LIMIT 100');
        $like = '%' . $search . '%';
        $stmt->execute([$userId, $search, $like, $like, $like, $userId, $userId, $userId, $userId, $userId]);
        $items = $stmt->fetchAll();
        foreach ($items as &$item) {
            $item['user_id'] = (int)$item['user_id'];
            $item['follower_count'] = (int)$item['follower_count'];
            $item['is_following'] = (bool)$item['is_following'];
            $item['badge'] = $item['platform_verified_at'] !== null ? ($item['follower_count'] >= 10000 ? 'gold' : ($item['follower_count'] >= 1000 ? 'silver' : ($item['follower_count'] >= 100 ? 'bronze' : null))) : null;
        }
        unset($item);
        out(['creators' => $items]);
    }
    if ($action === 'profile') {
        $ownerId = (int)($_GET['user_id'] ?? $userId);
        $profile = cc_profile($pdo, $ownerId, $userId);
        if ($ownerId !== $userId) {
            $canView = $pdo->prepare('SELECT 1 FROM creator_clicks_follows WHERE follower_id=? AND creator_id=? LIMIT 1');
            $canView->execute([$userId, $ownerId]);
            if (!$canView->fetchColumn()) fail('Follow this creator to view their broadcasts', 403);
        }
        $stmt = $pdo->prepare('SELECT p.id,p.creator_id,p.content_type,p.body,p.media_manifest,p.created_at,p.expires_at,
            (SELECT COUNT(*) FROM creator_clicks_reactions r WHERE r.post_id=p.id) AS reaction_count,
            (SELECT COUNT(*) FROM creator_clicks_post_views v WHERE v.post_id=p.id) AS view_count,
            EXISTS(SELECT 1 FROM creator_clicks_post_views v WHERE v.post_id=p.id AND v.viewer_id=?) AS viewed,
            (SELECT r.reaction FROM creator_clicks_reactions r WHERE r.post_id=p.id AND r.user_id=? LIMIT 1) AS my_reaction,
            CASE WHEN p.creator_id=? THEN 1 ELSE 0 END AS is_owner
            FROM creator_clicks_posts p WHERE p.creator_id=? AND p.deleted_at IS NULL AND p.expires_at>UTC_TIMESTAMP()
            ORDER BY p.created_at DESC,p.id DESC LIMIT 100');
        $stmt->execute([$userId, $userId, $userId, $ownerId]);
        $posts = array_map('cc_post_row', $stmt->fetchAll());
        out(['profile' => $profile, 'posts' => $posts]);
    }
    $stmt = $pdo->prepare('SELECT p.id,p.creator_id,p.content_type,p.body,p.media_manifest,p.created_at,p.expires_at,
        c.display_name,u.name,
        (SELECT COUNT(*) FROM creator_clicks_reactions r WHERE r.post_id=p.id) AS reaction_count,
        (SELECT COUNT(*) FROM creator_clicks_post_views v WHERE v.post_id=p.id) AS view_count,
        (SELECT r.reaction FROM creator_clicks_reactions r WHERE r.post_id=p.id AND r.user_id=? LIMIT 1) AS my_reaction,
        CASE WHEN p.creator_id=? THEN 1 ELSE 0 END AS is_owner
        FROM creator_clicks_posts p
        INNER JOIN creator_clicks_profiles c ON c.user_id=p.creator_id
        INNER JOIN users u ON u.id=p.creator_id AND u.account_status="active"
        WHERE p.deleted_at IS NULL AND p.feed_expires_at>UTC_TIMESTAMP()
        AND EXISTS(SELECT 1 FROM creator_clicks_follows f WHERE f.creator_id=p.creator_id AND f.follower_id=?)
        AND NOT EXISTS(SELECT 1 FROM creator_clicks_blocks b WHERE (b.blocker_id=? AND b.blocked_id=p.creator_id) OR (b.blocker_id=p.creator_id AND b.blocked_id=?))
        AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.user_id=? AND b.blocked_user_id=p.creator_id) OR (b.user_id=p.creator_id AND b.blocked_user_id=?))
        ORDER BY p.created_at DESC,p.id DESC LIMIT 100');
    $stmt->execute([$userId, $userId, $userId, $userId, $userId, $userId, $userId]);
    out(['posts' => array_map('cc_post_row', $stmt->fetchAll())]);
}

$data = input();
$action = strtolower(trim((string)($data['action'] ?? '')));

if ($method === 'POST' && $action === 'profile') {
    $displayName = trim((string)($data['display_name'] ?? $user['name'] ?? ''));
    $channelName = trim((string)($data['channel_name'] ?? $displayName));
    $bio = trim((string)($data['bio'] ?? ''));
    $category = trim((string)($data['category'] ?? 'Creator'));
    if ($displayName === '' || cc_length($displayName) > 80) fail('Creator name must contain 1 to 80 characters', 422);
    if ($channelName === '' || cc_length($channelName) > 100) fail('Channel name must contain 1 to 100 characters', 422);
    $existing = $pdo->prepare('SELECT channel_deleted_at FROM creator_clicks_profiles WHERE user_id=? LIMIT 1');
    $existing->execute([$userId]);
    $existingChannel = $existing->fetch();
    if ($existingChannel && $existingChannel['channel_deleted_at'] !== null) fail('This Creator Clicks channel has been deleted and cannot be reopened', 409);
    if (cc_length($bio) > 300) fail('Creator bio must be 300 characters or fewer', 422);
    if ($category === '' || cc_length($category) > 60) fail('Choose a valid creator category', 422);
    $stmt = $pdo->prepare('INSERT INTO creator_clicks_profiles(user_id,display_name,channel_name,bio,category) VALUES(?,?,?,?,?)
        ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),channel_name=VALUES(channel_name),bio=VALUES(bio),category=VALUES(category),updated_at=UTC_TIMESTAMP()');
    $stmt->execute([$userId, $displayName, $channelName, $bio, $category]);
    out(['profile' => cc_profile($pdo, $userId, $userId)], 201);
}

if ($method === 'POST' && in_array($action, ['follow','unfollow'], true)) {
    $creatorId = (int)($data['creator_id'] ?? 0);
    if ($creatorId <= 0 || $creatorId === $userId) fail('Choose another creator to follow', 422);
    $profile = $pdo->prepare('SELECT user_id FROM creator_clicks_profiles WHERE user_id=? AND channel_deleted_at IS NULL');
    $profile->execute([$creatorId]);
    if (!$profile->fetchColumn() || cc_blocked($pdo, $userId, $creatorId)) fail('Creator is unavailable', 404);
    if ($action === 'follow') {
        $pdo->prepare('INSERT IGNORE INTO creator_clicks_follows(follower_id,creator_id,created_at) VALUES(?,?,UTC_TIMESTAMP())')->execute([$userId, $creatorId]);
    } else {
        $pdo->prepare('DELETE FROM creator_clicks_follows WHERE follower_id=? AND creator_id=?')->execute([$userId, $creatorId]);
    }
    out(['creator_id' => $creatorId, 'is_following' => $action === 'follow']);
}

if ($method === 'POST' && $action === 'publish') {
    $body = trim((string)($data['body'] ?? ''));
    if (cc_length($body) > 300) fail('Captions must be 300 characters or fewer', 422);
    $contentType = strtolower(trim((string)($data['content_type'] ?? 'text')));
    if (!in_array($contentType, ['text','image','video'], true)) fail('Unsupported Creator Clicks content type', 422);
    $mediaInput = $data['media'] ?? [];
    if (!is_array($mediaInput)) fail('Media manifest must be a list', 422);
    $files = [];
    if ($contentType === 'text') {
        if ($body === '' || $mediaInput) fail('Text posts require text and no media files', 422);
    } elseif ($contentType === 'image') {
        if (count($mediaInput) < 1 || count($mediaInput) > 5) fail('Image posts must contain between 1 and 5 images', 422);
    } elseif ($contentType === 'video') {
        if (count($mediaInput) !== 1) fail('Video posts must contain exactly one video', 422);
    }
    foreach ($mediaInput as $item) {
        if (!is_array($item)) fail('Invalid media item', 422);
        $filename = basename((string)($item['filename'] ?? ''));
        $kind = (string)($item['type'] ?? '');
        if ($filename === '' || basename($filename) !== (string)($item['filename'] ?? '') || !preg_match('/^[a-f0-9]{32}\\.(jpg|png|webp|mp4|mov|webm)$/i', $filename)) fail('Invalid media filename', 422);
        $path = dirname(__DIR__) . '/uploads/creator-clicks/' . $userId . '/' . $filename;
        if (!is_file($path)) fail('One or more uploaded media files are unavailable', 422);
        $mime = cloudcomai_detect_mime_type($path);
        if ($kind === 'image') {
            if (!in_array($mime, ['image/jpeg','image/png','image/webp'], true) || filesize($path) > 10 * 1024 * 1024) fail('Images must be valid JPG, PNG or WebP files no larger than 10 MB', 422);
        } elseif ($kind === 'video') {
            if (!in_array($mime, ['video/mp4','video/quicktime','video/webm'], true)) fail('Invalid video media type', 422);
            $duration = (float)($item['duration_seconds'] ?? 0);
            if ($duration <= 0 || $duration > 160) fail('Videos must be 160 seconds or shorter', 422);
        } else {
            fail('Invalid media type', 422);
        }
        if (($contentType === 'image' && $kind !== 'image') || ($contentType === 'video' && $kind !== 'video')) fail('Media type does not match the post format', 422);
        $files[] = ['filename' => $filename, 'type' => $kind, 'mime_type' => $mime, 'duration_seconds' => $kind === 'video' ? $duration : null];
    }
    $profile = $pdo->prepare('SELECT user_id FROM creator_clicks_profiles WHERE user_id=? AND channel_deleted_at IS NULL');
    $profile->execute([$userId]);
    if (!$profile->fetchColumn()) fail('Create your Creator Clicks profile before publishing', 409);
    $manifest = $files ? json_encode(['files' => $files], JSON_UNESCAPED_SLASHES) : null;
    $stmt = $pdo->prepare('INSERT INTO creator_clicks_posts(creator_id,content_type,body,media_manifest,created_at,feed_expires_at,expires_at) VALUES(?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()+INTERVAL 24 HOUR,UTC_TIMESTAMP()+INTERVAL 90 DAY)');
    $stmt->execute([$userId, $contentType, $body, $manifest]);
    out(['post_id' => (int)$pdo->lastInsertId(), 'content_type' => $contentType, 'expires_in_days' => 90, 'feed_visibility_hours' => 24], 201);
}

if ($method === 'POST' && $action === 'react') {
    $postId = (int)($data['post_id'] ?? 0);
    $reaction = trim((string)($data['reaction'] ?? ''));
    $allowed = ['👍','❤️','😂','🔥','👏','😍','😮','😢'];
    if ($postId <= 0 || !in_array($reaction, $allowed, true)) fail('Choose a valid reaction', 422);
    $post = $pdo->prepare('SELECT creator_id FROM creator_clicks_posts WHERE id=? AND deleted_at IS NULL AND expires_at>UTC_TIMESTAMP() LIMIT 1');
    $post->execute([$postId]);
    $creatorId = (int)$post->fetchColumn();
    if (!$creatorId || cc_blocked($pdo, $userId, $creatorId)) fail('Broadcast is unavailable', 404);
    if ($userId !== $creatorId) {
        $allowed = $pdo->prepare('SELECT 1 FROM creator_clicks_follows WHERE follower_id=? AND creator_id=? LIMIT 1');
        $allowed->execute([$userId, $creatorId]);
        if (!$allowed->fetchColumn()) fail('Follow this creator before reacting', 403);
    }
    $stmt = $pdo->prepare('INSERT INTO creator_clicks_reactions(post_id,user_id,reaction) VALUES(?,?,?)
        ON DUPLICATE KEY UPDATE reaction=VALUES(reaction),updated_at=UTC_TIMESTAMP()');
    $stmt->execute([$postId, $userId, $reaction]);
    out(['post_id' => $postId, 'reaction' => $reaction]);
}

if ($method === 'POST' && $action === 'view') {
    $postId = (int)($data['post_id'] ?? 0);
    $stmt = $pdo->prepare('SELECT creator_id FROM creator_clicks_posts WHERE id=? AND deleted_at IS NULL AND expires_at>UTC_TIMESTAMP() LIMIT 1');
    $stmt->execute([$postId]);
    $creatorId = (int)$stmt->fetchColumn();
    if (!$creatorId || cc_blocked($pdo, $userId, $creatorId)) fail('Broadcast is unavailable', 404);
    if ($creatorId !== $userId) {
        $allowed = $pdo->prepare('SELECT 1 FROM creator_clicks_follows WHERE follower_id=? AND creator_id=? LIMIT 1');
        $allowed->execute([$userId, $creatorId]);
        if (!$allowed->fetchColumn()) fail('Follow this creator to view the broadcast', 403);
    }
    $pdo->prepare('INSERT IGNORE INTO creator_clicks_post_views(post_id,viewer_id,viewed_at) VALUES(?,?,UTC_TIMESTAMP())')->execute([$postId, $userId]);
    out(['post_id' => $postId, 'viewed' => true]);
}

if ($method === 'POST' && $action === 'report') {
    $postId = (int)($data['post_id'] ?? 0);
    $reason = trim((string)($data['reason'] ?? ''));
    $details = trim((string)($data['details'] ?? ''));
    if ($postId <= 0 || $reason === '' || cc_length($reason) > 80 || cc_length($details) > 500) fail('Provide a valid report reason', 422);
    $stmt = $pdo->prepare('INSERT IGNORE INTO creator_clicks_reports(post_id,reporter_id,reason,details,created_at) SELECT id,?,?,?,UTC_TIMESTAMP() FROM creator_clicks_posts WHERE id=? AND deleted_at IS NULL AND expires_at>UTC_TIMESTAMP()');
    $stmt->execute([$userId, $reason, $details, $postId]);
    if ($stmt->rowCount() === 0) fail('Broadcast not found or already reported', 404);
    out(['post_id' => $postId, 'reported' => true], 201);
}

if ($method === 'DELETE') {
    $operation = strtolower(trim((string)($_GET['action'] ?? 'post')));
    if ($operation === 'channel') {
        $pdo->beginTransaction();
        try {
            $channel = $pdo->prepare('SELECT user_id,channel_deleted_at FROM creator_clicks_profiles WHERE user_id=? FOR UPDATE');
            $channel->execute([$userId]);
            $owned = $channel->fetch();
            if (!$owned || $owned['channel_deleted_at'] !== null) fail('Creator Clicks channel not found', 404);
            $posts = $pdo->prepare('SELECT id,media_manifest FROM creator_clicks_posts WHERE creator_id=?');
            $posts->execute([$userId]);
            $postRows = $posts->fetchAll();
            foreach ($postRows as $post) cc_queue_media_manifest($pdo, $userId, $post['media_manifest'] ?? null);
            $pdo->prepare('DELETE r FROM creator_clicks_reactions r INNER JOIN creator_clicks_posts p ON p.id=r.post_id WHERE p.creator_id=?')->execute([$userId]);
            $pdo->prepare('DELETE v FROM creator_clicks_post_views v INNER JOIN creator_clicks_posts p ON p.id=v.post_id WHERE p.creator_id=?')->execute([$userId]);
            $pdo->prepare('DELETE r FROM creator_clicks_reports r INNER JOIN creator_clicks_posts p ON p.id=r.post_id WHERE p.creator_id=?')->execute([$userId]);
            $pdo->prepare('DELETE FROM creator_clicks_posts WHERE creator_id=?')->execute([$userId]);
            $pdo->prepare('DELETE FROM creator_clicks_follows WHERE creator_id=? OR follower_id=?')->execute([$userId, $userId]);
            $pdo->prepare('UPDATE creator_clicks_profiles SET channel_deleted_at=UTC_TIMESTAMP(),channel_name="",bio="",category="Creator",avatar_path=NULL,channel_avatar_path=NULL,updated_at=UTC_TIMESTAMP() WHERE user_id=?')->execute([$userId]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        out(['channel_deleted' => true, 'account_preserved' => true]);
    }

    $postId = (int)($_GET['post_id'] ?? 0);
    if ($postId <= 0) fail('Post id is required', 422);
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT id,media_manifest FROM creator_clicks_posts WHERE id=? AND creator_id=? AND deleted_at IS NULL FOR UPDATE');
        $stmt->execute([$postId, $userId]);
        $post = $stmt->fetch();
        if (!$post) fail('Post not found or you do not own it', 404);
        cc_queue_media_manifest($pdo, $userId, $post['media_manifest'] ?? null);
        $pdo->prepare('DELETE FROM creator_clicks_reactions WHERE post_id=?')->execute([$postId]);
        $pdo->prepare('DELETE FROM creator_clicks_post_views WHERE post_id=?')->execute([$postId]);
        $pdo->prepare('DELETE FROM creator_clicks_reports WHERE post_id=?')->execute([$postId]);
        $pdo->prepare('DELETE FROM creator_clicks_posts WHERE id=? AND creator_id=?')->execute([$postId, $userId]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    out(['post_id' => $postId, 'deleted' => true, 'channel_preserved' => true]);
}

fail('Unsupported Creator Clicks action', 405);
