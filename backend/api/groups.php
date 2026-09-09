<?php
require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$action = trim((string)($_GET['action'] ?? ''));

$types = ['Family Group','Friend Group','Fan Group','Study Group','College Group','Class Group','Department Group','Project Group','Club Group','Alumni Group','Workplace Group','Neighborhood Group','Event Group','Staff Group'];

function group_invite_payload(string $token): array {
    global $config;
    $encodedToken = rawurlencode($token);
    $payload = [
        'invite_token' => $token,
        'invite_path' => '#invite=' . $encodedToken,
    ];
    $webUrl = rtrim((string)($config['app']['web_url'] ?? ''), '/');
    if ($webUrl !== '') $payload['invite_url'] = $webUrl . '/#invite=' . $encodedToken;
    return $payload;
}

if ($method === 'GET') {
    $st = $pdo->prepare('
        SELECT c.id,c.type,c.name,c.group_category,c.owner_id,c.retention_seconds,c.created_at,MAX(m.created_at) AS last_message_at
        FROM chats c
        INNER JOIN chat_members cm ON cm.chat_id=c.id
        LEFT JOIN messages m ON m.chat_id=c.id
        WHERE c.type="group" AND cm.user_id=? AND cm.status="active"
        GROUP BY c.id,c.type,c.name,c.group_category,c.owner_id,c.retention_seconds,c.created_at
        ORDER BY COALESCE(MAX(m.created_at),c.created_at) DESC
    ');
    $st->execute([$user['id']]);
    $groups = $st->fetchAll();
    $folder = dirname(__DIR__) . '/uploads/groups';
    foreach ($groups as &$group) {
        $group['id'] = (int)$group['id'];
        $group['owner_id'] = $group['owner_id'] !== null ? (int)$group['owner_id'] : null;
        $group['image_version'] = null;
        foreach (glob($folder . '/' . $group['id'] . '.*') ?: [] as $candidate) {
            if (is_file($candidate)) {
                $group['image_version'] = (string)(filemtime($candidate) ?: 0) . '-' . (string)filesize($candidate);
                break;
            }
        }
    }
    unset($group);
    out(['groups' => $groups]);
}

if ($method === 'POST' && $action === 'transfer') {
    $chatId=(int)($_GET['id'] ?? 0);
    $targetId=(int)(input()['user_id'] ?? 0);
    if ($targetId<1 || $targetId===(int)$user['id']) fail('Choose another active group member',422);
    $pdo->beginTransaction();
    try {
        $lock=$pdo->prepare('SELECT owner_id FROM chats WHERE id=? AND type="group" FOR UPDATE');
        $lock->execute([$chatId]);
        if ((int)$lock->fetchColumn()!==(int)$user['id']) { $pdo->rollBack(); fail('Only the current owner can transfer ownership',403); }
        $members=$pdo->prepare('SELECT cm.user_id FROM chat_members cm INNER JOIN users u ON u.id=cm.user_id AND u.account_status="active" WHERE cm.chat_id=? AND cm.user_id IN (?,?) AND cm.status="active" FOR UPDATE');
        $members->execute([$chatId,$user['id'],$targetId]);
        if (count($members->fetchAll())!==2) { $pdo->rollBack(); fail('Both owners must be active group members',422); }
        $pdo->prepare('UPDATE chat_members SET role="admin" WHERE chat_id=? AND user_id=?')->execute([$chatId,$user['id']]);
        $pdo->prepare('UPDATE chat_members SET role="owner" WHERE chat_id=? AND user_id=?')->execute([$chatId,$targetId]);
        $pdo->prepare('UPDATE chats SET owner_id=?,updated_at=UTC_TIMESTAMP() WHERE id=?')->execute([$targetId,$chatId]);
        $pdo->prepare('INSERT INTO group_role_events(chat_id,actor_id,previous_owner_id,new_owner_id) VALUES(?,?,?,?)')->execute([$chatId,$user['id'],$user['id'],$targetId]);
        // Old owner-generated invitations cannot grant access after transfer.
        $pdo->prepare('UPDATE group_invites SET active=0 WHERE chat_id=?')->execute([$chatId]);
        $pdo->commit();
        out(['group_id'=>$chatId,'owner_id'=>$targetId]);
    } catch (Throwable $error) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $error; }
}

if ($method === 'POST' && $action === 'invite') {
    $chatId = (int)($_GET['id'] ?? 0);
    if ($chatId <= 0) fail('Group id is required');
    $owner = $pdo->prepare('SELECT id FROM chats WHERE id=? AND type="group" AND owner_id=? LIMIT 1');
    $owner->execute([$chatId,$user['id']]);
    if (!$owner->fetch()) fail('Only the group owner can generate an invite link',403);
    try {
        $pdo->beginTransaction();
        $raw = random_token();
        $pdo->prepare('UPDATE group_invites SET active=0 WHERE chat_id=?')->execute([$chatId]);
        $pdo->prepare('INSERT INTO group_invites(chat_id,token_hash,created_by,active,created_at) VALUES(?,SHA2(?,256),?,1,UTC_TIMESTAMP())')->execute([$chatId,$raw,$user['id']]);
        $pdo->commit();
        out(group_invite_payload($raw));
    } catch(Throwable $e){ if ($pdo->inTransaction()) $pdo->rollBack(); error_log('groups.php invite error: '.$e->getMessage()); fail('Unable to generate invite link',500); }
}

if ($method === 'POST') {
    $d = input();
    $name = trim((string)($d['name'] ?? ''));
    $type = (string)($d['group_category'] ?? $d['group_type'] ?? '');
    $retention = array_key_exists('retention_seconds', $d)
        ? (int)$d['retention_seconds']
        : chat_retention_seconds('group');
    if ($name === '' || !in_array($type,$types,true)) fail('Valid group name and category are required');
    if ($retention <= 0) fail('Invalid retention policy');

    $pdo->beginTransaction();
    try {
        $st=$pdo->prepare('INSERT INTO chats(type,name,group_category,owner_id,retention_seconds,created_at) VALUES("group",?,?,?,?,UTC_TIMESTAMP())');
        $st->execute([$name,$type,$user['id'],$retention]);
        $chatId=(int)$pdo->lastInsertId();
        $pdo->prepare('INSERT INTO chat_members(chat_id,user_id,role,status,joined_at) VALUES(?,?,"owner","active",UTC_TIMESTAMP())')->execute([$chatId,$user['id']]);
        $raw=random_token();
        $pdo->prepare('INSERT INTO group_invites(chat_id,token_hash,created_by,active,created_at) VALUES(?,SHA2(?,256),?,1,UTC_TIMESTAMP())')->execute([$chatId,$raw,$user['id']]);
        $pdo->commit();
        out(array_merge([
            'group'=>['id'=>$chatId,'type'=>'group','name'=>$name,'group_category'=>$type,'owner_id'=>(int)$user['id'],'retention_seconds'=>$retention,'isGroup'=>true,'image_version'=>null]
        ], group_invite_payload($raw)),201);
    } catch(Throwable $e){ $pdo->rollBack(); error_log('groups.php POST error: '.$e->getMessage()); fail('Group creation failed',500); }
}

if ($method === 'PUT') {
    $chatId = (int)($_GET['id'] ?? 0);
    if ($chatId <= 0) fail('Group id is required');
    $member = $pdo->prepare('SELECT role FROM chat_members WHERE chat_id=? AND user_id=? AND status="active" LIMIT 1');
    $member->execute([$chatId, $user['id']]);
    $memberRow = $member->fetch();
    if (!$memberRow || !in_array($memberRow['role'], ['owner','admin'], true)) fail('Only group owners or admins can edit this group', 403);

    $d = input();
    $name = trim((string)($d['name'] ?? ''));
    $type = (string)($d['group_category'] ?? '');
    if ($name === '' || !in_array($type, $types, true)) fail('Valid group name and category are required');
    $st = $pdo->prepare('UPDATE chats SET name=?, group_category=?, updated_at=UTC_TIMESTAMP() WHERE id=? AND type="group"');
    $st->execute([$name, $type, $chatId]);
    $owner=$pdo->prepare('SELECT owner_id FROM chats WHERE id=?'); $owner->execute([$chatId]);
    out(['group'=>['id'=>$chatId,'type'=>'group','name'=>$name,'group_category'=>$type,'owner_id'=>(int)$owner->fetchColumn(),'isGroup'=>true]]);
}

if ($method === 'DELETE') {
    $chatId=(int)($_GET['id'] ?? 0);
    if ($chatId <= 0) fail('Group id is required');
    $owner=$pdo->prepare('SELECT id FROM chats WHERE id=? AND type="group" AND owner_id=? LIMIT 1');
    $owner->execute([$chatId,$user['id']]);
    if (!$owner->fetch()) fail('Only the group owner can delete this group',403);
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE chat_members SET status="removed" WHERE chat_id=?')->execute([$chatId]);
        $pdo->prepare('UPDATE group_invites SET active=0 WHERE chat_id=?')->execute([$chatId]);
        $pdo->commit();
        out(['message'=>'Group deleted','group_id'=>$chatId]);
    } catch(Throwable $e){ $pdo->rollBack(); error_log('groups.php DELETE error: '.$e->getMessage()); fail('Group deletion failed',500); }
}

fail('Method not allowed',405);
