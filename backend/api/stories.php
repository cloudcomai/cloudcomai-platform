<?php
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
$user = auth_user();
$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST') {
    $data = input();
    $type = $data['type'] ?? 'text';
    $audience = $data['audience'] ?? 'friends';
    if ($type !== 'text') fail('Only text Ring Bells are supported', 422);
    if (!in_array($audience, ['friends', 'public'], true)) fail('Invalid Ring Bells audience', 422);
    if (!is_string($data['content'] ?? null)) fail('Story content required', 422);
    $content = trim($data['content']);
    $length = preg_match_all('/./us', $content);
    if ($content === '' || $length === false || $length > 700) fail('Ring Bells must contain 1 to 700 characters', 422);
    $st = db()->prepare('INSERT INTO stories(user_id,type,content,audience,created_at,expires_at) VALUES(?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()+INTERVAL 36 HOUR)');
    $st->execute([$user['id'], $type, $content, $audience]);
    out(['story_id' => (int)db()->lastInsertId(), 'expires_in_hours' => 36], 201);
}
if ($method === 'GET') {
    $st = db()->prepare(<<<'SQL'
        SELECT s.id,s.user_id,s.type,s.content,s.audience,s.created_at,s.expires_at,u.name
        FROM stories s INNER JOIN users u ON u.id=s.user_id AND u.account_status='active'
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
        ORDER BY s.created_at DESC,s.id DESC LIMIT 100
    SQL);
    $st->execute(array_fill(0, 6, (int)$user['id']));
    header('Cache-Control: private, no-store');
    out(['stories' => $st->fetchAll()]);
}
fail('Method not allowed', 405);
