<?php
require __DIR__ . '/../lib/bootstrap.php';
$user = auth_user();
if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') fail('Method not allowed', 405);
$limit = max(1, min(100, (int)($_GET['limit'] ?? 50)));
$beforeId = max(0, (int)($_GET['before_id'] ?? 0));

// Alerts inbox contains security screenshot alerts and actionable friend-request alerts.
$alertFilter = "(LOWER(COALESCE(h.category,''))='system' AND JSON_UNQUOTE(JSON_EXTRACT(h.data_json,'$.event')) IN ('screenshot','friend_request'))";
$sql = 'SELECT id, category, title, body, data_json, read_at, created_at FROM notification_history h WHERE h.user_id=? AND h.read_at IS NULL AND ' . $alertFilter . ' AND ' . notification_visibility_sql();
$params = [$user['id']];
if ($beforeId > 0) { $sql .= ' AND id<?'; $params[] = $beforeId; }
$sql .= " ORDER BY id DESC LIMIT $limit";
$st = db()->prepare($sql);
$st->execute($params);
$items = array_map(static function (array $row): array {
    $decoded = !empty($row['data_json']) ? json_decode($row['data_json'], true) : null;
    unset($row['data_json']);
    $row['data'] = is_array($decoded) ? $decoded : [];
    return $row;
}, $st->fetchAll());
$count = db()->prepare('SELECT COUNT(*) FROM notification_history h WHERE h.user_id=? AND h.read_at IS NULL AND ' . $alertFilter . ' AND ' . notification_visibility_sql());
$count->execute([$user['id']]);
out(['notifications'=>$items,'unread_count'=>(int)$count->fetchColumn()]);
