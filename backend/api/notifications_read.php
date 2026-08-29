<?php
require __DIR__ . '/../lib/bootstrap.php';
$user = auth_user();
if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') fail('Method not allowed', 405);
$input = input();
$pdo = db();
if (!empty($input['all'])) {
    $st = $pdo->prepare('UPDATE notification_history SET read_at=UTC_TIMESTAMP() WHERE user_id=? AND read_at IS NULL');
    $st->execute([$user['id']]);
    out(['updated_count' => $st->rowCount()]);
}
$ids = $input['notification_ids'] ?? [];
if (!is_array($ids)) fail('notification_ids must be an array', 422);
$ids = array_values(array_unique(array_filter(array_map('intval', $ids), static fn(int $id): bool => $id > 0)));
if (!$ids) out(['updated_count' => 0]);
$marks = implode(',', array_fill(0, count($ids), '?'));
$st = $pdo->prepare("UPDATE notification_history SET read_at=UTC_TIMESTAMP() WHERE user_id=? AND id IN ($marks) AND read_at IS NULL");
$st->execute(array_merge([$user['id']], $ids));
out(['updated_count' => $st->rowCount()]);
