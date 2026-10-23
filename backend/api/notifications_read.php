<?php
require __DIR__ . '/../lib/bootstrap.php';
$user = auth_user();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed',405);
$data = input();
$read = $data['read'] ?? true;
$all = $data['all'] ?? false;
if (!is_bool($read) || !is_bool($all)) fail('read and all must be true or false',422);
$ids = $data['notification_ids'] ?? [];
if (!is_array($ids) || count($ids)>100) fail('notification_ids must be an array of up to 100 ids',422);
foreach ($ids as $id) if (filter_var($id,FILTER_VALIDATE_INT) === false || (int)$id<1) fail('Invalid notification id',422);
$ids = array_values(array_unique(array_map('intval',$ids)));
if (!$all && !$ids) out(['updated_count'=>0,'unread_count'=>notification_unread_count((int)$user['id'])]);
$params = [$user['id']];
$where = 'user_id=?';
if (!$all) { $where .= ' AND id IN (' . implode(',',array_fill(0,count($ids),'?')) . ')'; $params=array_merge($params,$ids); }
$pdo = db();
$pdo->beginTransaction();
try {
    $st = $pdo->prepare('UPDATE notification_history SET read_at=' . ($read ? 'UTC_TIMESTAMP()' : 'NULL') . ' WHERE ' . $where . ' AND read_at IS ' . ($read ? 'NULL' : 'NOT NULL'));
    $st->execute($params);
    $changed = $st->rowCount();
    // Keep a mention's unread badge synchronized when its linked notification is
    // explicitly marked read/unread from the notifications surface.
    $mentionSyncWhere = 'h.user_id=? AND JSON_UNQUOTE(JSON_EXTRACT(h.data_json,"$.event"))="mention"';
    $mentionSyncParams = [$user['id']];
    if (!$all) {
        $mentionSyncWhere .= ' AND h.id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')';
        $mentionSyncParams = array_merge($mentionSyncParams, $ids);
    }
    $mentionReadValue = $read ? 'COALESCE(mm.read_at,UTC_TIMESTAMP())' : 'NULL';
    $mentionSync = $pdo->prepare('UPDATE message_mentions mm INNER JOIN notification_history h ON h.id=mm.notification_id SET mm.read_at=' . $mentionReadValue . ' WHERE ' . $mentionSyncWhere . ' AND mm.removed_at IS NULL');
    $mentionSync->execute($mentionSyncParams);
    cancel_read_notification_deliveries((int)$user['id']);
    $pdo->commit();
} catch (Throwable $error) { $pdo->rollBack(); throw $error; }
out(['updated_count'=>$changed,'unread_count'=>notification_unread_count((int)$user['id'])]);
