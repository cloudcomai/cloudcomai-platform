<?php
require __DIR__ . '/../lib/bootstrap.php';
$user = auth_user();
if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') fail('Method not allowed', 405);
$limit = max(1, min(100, (int)($_GET['limit'] ?? 50)));
$beforeId = max(0, (int)($_GET['before_id'] ?? 0));
$sql = 'SELECT id, category, title, body, data_json, read_at, created_at FROM notification_history WHERE user_id=?';
$params = [$user['id']];
if ($beforeId > 0) { $sql .= ' AND id<?'; $params[] = $beforeId; }
$sql .= " ORDER BY id DESC LIMIT $limit";
$st = db()->prepare($sql); $st->execute($params);
$items = array_map(static function (array $row): array {
    $data = null;
    if (!empty($row['data_json'])) { $decoded = json_decode($row['data_json'], true); $data = is_array($decoded) ? $decoded : null; }
    unset($row['data_json']); $row['data'] = $data; return $row;
}, $st->fetchAll());
$count = db()->prepare('SELECT COUNT(*) FROM notification_history WHERE user_id=? AND read_at IS NULL');
$count->execute([$user['id']]);
out(['notifications' => $items, 'unread_count' => (int)$count->fetchColumn()]);
