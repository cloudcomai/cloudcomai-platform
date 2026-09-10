<?php
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

function hub_decode_story(array $row): array {
    $payload = json_decode((string)$row['content'], true);
    if (!is_array($payload)) $payload = ['text' => (string)$row['content']];
    return [
        'id' => (int)$row['id'],
        'user_id' => (int)$row['user_id'],
        'author_name' => $row['author_name'],
        'author_user_id' => $row['author_user_id'],
        'image_version' => $row['image_version'] ?? null,
        'text' => (string)($payload['text'] ?? ''),
        'link' => isset($payload['link']) ? (string)$payload['link'] : null,
        'media_url' => isset($payload['media_url']) ? (string)$payload['media_url'] : null,
        'media_type' => isset($payload['media_type']) ? (string)$payload['media_type'] : null,
        'location' => isset($payload['location']) ? (string)$payload['location'] : null,
        'audience' => (string)$row['audience'],
        'created_at' => $row['created_at'],
        'reaction_count' => count(array_unique(array_map('intval', $payload['reactions'] ?? []))),
        'comment_count' => count(is_array($payload['comments'] ?? null) ? $payload['comments'] : []),
        'share_count' => (int)($payload['shares'] ?? 0),
        'reacted' => in_array((int)$user['id'], array_map('intval', $payload['reactions'] ?? []), true),
        'saved' => in_array((int)$user['id'], array_map('intval', $payload['saved'] ?? []), true),
        'comments' => is_array($payload['comments'] ?? null) ? array_slice($payload['comments'], -20) : [],
    ];
}

function hub_find_post(int $id, int $viewerId, bool $lock = false): array {
    $sql = 'SELECT s.*,u.name AS author_name,u.user_id AS author_user_id,u.updated_at AS image_version FROM stories s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.type="hub_post" AND s.deleted_at IS NULL';
    if ($lock) $sql .= ' FOR UPDATE';
    $st = db()->prepare($sql); $st->execute([$id]); $row = $st->fetch();
    if (!$row) fail('Post not found', 404);
    $blocked = users_block_state($viewerId, (int)$row['user_id']);
    if ($blocked['blocked']) fail('Post unavailable', 404);
    $audience = (string)$row['audience'];
    if ($audience === 'only_me' && (int)$row['user_id'] !== $viewerId) fail('Post unavailable', 404);
    if ($audience === 'contacts' && (int)$row['user_id'] !== $viewerId) {
        $contact = db()->prepare('SELECT 1 FROM google_contacts gc JOIN users u ON (LOWER(gc.email)=LOWER(u.email) OR gc.phone=u.mobile) WHERE gc.user_id=? AND u.id=? AND gc.deleted_at IS NULL LIMIT 1');
        $contact->execute([$viewerId, (int)$row['user_id']]);
        if (!$contact->fetchColumn()) fail('Post unavailable', 404);
    }
    return $row;
}

function hub_visible_posts(int $viewerId, string $view, string $tab): array {
    $params = [$viewerId];
    $where = "s.type='hub_post' AND s.deleted_at IS NULL AND s.expires_at>UTC_TIMESTAMP() AND u.account_status='active' AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.user_id=? AND b.blocked_user_id=s.user_id) OR (b.user_id=s.user_id AND b.blocked_user_id=?))";
    $params[] = $viewerId;
    $where .= " AND (s.audience='public' OR s.user_id=? OR (s.audience='contacts' AND EXISTS (SELECT 1 FROM google_contacts gc WHERE gc.user_id=? AND gc.deleted_at IS NULL AND ((LOWER(gc.email)=LOWER(u.email) AND gc.email IS NOT NULL) OR (gc.phone=u.mobile AND gc.phone IS NOT NULL)))) OR (s.audience='hub_members' AND EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id=(SELECT id FROM chats WHERE type='public' AND group_category='india-city' ORDER BY id LIMIT 1) AND cm.user_id=? AND cm.status='active')))";
    $params = [$viewerId, $viewerId, $viewerId, $viewerId, $viewerId];
    if ($view === 'saved') $where .= " AND JSON_SEARCH(s.content,'one',CAST(? AS CHAR),'', '$.saved[*]') IS NOT NULL";
    if ($view === 'following') $where .= " AND JSON_SEARCH(s.content,'one',CAST(? AS CHAR),'', '$.followers[*]') IS NOT NULL";
    if ($view === 'my') $where .= ' AND s.user_id=?';
    if ($view === 'discover' && $tab === 'trending') $order = 'CAST(JSON_UNQUOTE(JSON_EXTRACT(s.content,"$.shares")) AS UNSIGNED) + JSON_LENGTH(JSON_EXTRACT(s.content,"$.reactions")) * 2 + JSON_LENGTH(JSON_EXTRACT(s.content,"$.comments")) * 3 DESC, s.created_at DESC';
    else $order = 's.created_at DESC';
    if ($view === 'my') $params[] = $viewerId;
    if ($view === 'saved' || $view === 'following') $params[] = $viewerId;
    $sql = "SELECT s.*,u.name AS author_name,u.user_id AS author_user_id,u.updated_at AS image_version FROM stories s JOIN users u ON u.id=s.user_id WHERE $where ORDER BY $order LIMIT 100";
    $st = db()->prepare($sql); $st->execute($params);
    return array_map('hub_decode_story', $st->fetchAll());
}

if ($method === 'GET') {
    $view = (string)($_GET['view'] ?? 'discover');
    $tab = (string)($_GET['tab'] ?? 'for_you');
    $posts = $view === 'following' ? hub_visible_posts((int)$user['id'], 'following', $tab) : hub_visible_posts((int)$user['id'], $view, $tab);
    $peopleStmt = $pdo->prepare('SELECT u.id,u.name,u.user_id,u.updated_at AS image_version, EXISTS(SELECT 1 FROM stories f WHERE f.type="hub_follow" AND f.user_id=? AND JSON_EXTRACT(f.content,"$.target_user_id")=u.id AND f.deleted_at IS NULL) AS following FROM users u WHERE u.id<>? AND u.account_status="active" AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.user_id=? AND b.blocked_user_id=u.id) OR (b.user_id=u.id AND b.blocked_user_id=?)) ORDER BY u.updated_at DESC,u.id DESC LIMIT 30');
    $peopleStmt->execute([(int)$user['id'],(int)$user['id'],(int)$user['id'],(int)$user['id']]);
    $hubsStmt = $pdo->query("SELECT id,name,(SELECT COUNT(*) FROM chat_members cm WHERE cm.chat_id=c.id AND cm.status='active') AS member_count FROM chats c WHERE c.type='public' AND c.group_category='india-city' ORDER BY member_count DESC,name ASC LIMIT 12");
    out(['posts'=>$posts,'people'=>$peopleStmt->fetchAll(),'hubs'=>$hubsStmt->fetchAll()]);
}

$data = input();
$action = (string)($data['action'] ?? '');

if ($method === 'POST' && $action === 'create') {
    $text = trim((string)($data['text'] ?? ''));
    if ($text === '') fail('Post text is required',422);
    if (mb_strlen($text) > 5000) fail('Post text is too long',422);
    $audience = (string)($data['audience'] ?? 'public');
    if (!in_array($audience,['public','contacts','hub_members','only_me'],true)) fail('Invalid audience',422);
    $payload = ['text'=>$text,'link'=>filter_var($data['link'] ?? '',FILTER_VALIDATE_URL) ?: null,'media_url'=>$data['media_url'] ?? null,'media_type'=>$data['media_type'] ?? null,'location'=>trim((string)($data['location'] ?? '')) ?: null,'reactions'=>[],'comments'=>[],'saved'=>[],'shares'=>0];
    $st=$pdo->prepare('INSERT INTO stories(user_id,type,content,audience,created_at,expires_at) VALUES(?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()+INTERVAL 3650 DAY)');
    $st->execute([(int)$user['id'],'hub_post',json_encode($payload,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),$audience]);
    $row=hub_find_post((int)$pdo->lastInsertId(),(int)$user['id']);
    out(['post'=>hub_decode_story($row)],201);
}

if ($method === 'POST' && in_array($action,['react','save','share','comment'],true)) {
    $id=(int)($data['post_id']??0); if($id<=0) fail('A valid post is required',422);
    $pdo->beginTransaction();
    try {
        $row=hub_find_post($id,(int)$user['id'],true); $payload=json_decode((string)$row['content'],true) ?: [];
        $uid=(int)$user['id'];
        if($action==='react'){ $r=array_values(array_unique(array_map('intval',$payload['reactions']??[]))); if(in_array($uid,$r,true)) $r=array_values(array_diff($r,[$uid])); else $r[]=$uid; $payload['reactions']=$r; }
        elseif($action==='save'){ $r=array_values(array_unique(array_map('intval',$payload['saved']??[]))); if(in_array($uid,$r,true)) $r=array_values(array_diff($r,[$uid])); else $r[]=$uid; $payload['saved']=$r; }
        elseif($action==='share'){ $payload['shares']=(int)($payload['shares']??0)+1; }
        else { $text=trim((string)($data['text']??'')); if($text==='') fail('Comment text is required',422); if(mb_strlen($text)>1000) fail('Comment is too long',422); $comments=is_array($payload['comments']??null)?$payload['comments']:[]; $comments[]=['user_id'=>$uid,'name'=>$user['name'],'text'=>$text,'created_at'=>gmdate('Y-m-d H:i:s')]; $payload['comments']=array_slice($comments,-100); }
        $up=$pdo->prepare('UPDATE stories SET content=? WHERE id=?'); $up->execute([json_encode($payload,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),$id]); $pdo->commit();
        $fresh=hub_find_post($id,(int)$user['id']); out(['post'=>hub_decode_story($fresh),'reacted'=>in_array($uid,array_map('intval',$payload['reactions']??[]),true),'saved'=>in_array($uid,array_map('intval',$payload['saved']??[]),true),'reaction_count'=>count($payload['reactions']??[]) ]);
    } catch(Throwable $e){ if($pdo->inTransaction())$pdo->rollBack(); if($e instanceof RuntimeException) throw $e; fail('Unable to update post',500); }
}

if ($method === 'POST' && $action === 'follow') {
    $target=(int)($data['target_user_id']??0); if($target<=0 || $target===(int)$user['id']) fail('Invalid user',422);
    $st=$pdo->prepare('SELECT id FROM users WHERE id=? AND account_status="active"');$st->execute([$target]);if(!$st->fetch())fail('User not found',404);
    $find=$pdo->prepare('SELECT id FROM stories WHERE type="hub_follow" AND user_id=? AND JSON_EXTRACT(content,"$.target_user_id")=? AND deleted_at IS NULL LIMIT 1');$find->execute([(int)$user['id'],$target]);$existing=$find->fetchColumn();
    if($existing){$pdo->prepare('UPDATE stories SET deleted_at=UTC_TIMESTAMP() WHERE id=?')->execute([(int)$existing]);$following=false;}else{$pdo->prepare('INSERT INTO stories(user_id,type,content,audience,created_at,expires_at) VALUES(?,?,?,"only_me",UTC_TIMESTAMP(),UTC_TIMESTAMP()+INTERVAL 3650 DAY)')->execute([(int)$user['id'],'hub_follow',json_encode(['target_user_id'=>$target])]);$following=true;queue_user_notification($target,'system',$user['name'].' followed you',$user['name'].' followed you on CloudComAI Hubs',['hub_action'=>'follow','user_id'=>(int)$user['id']]);}
    out(['following'=>$following]);
}

if ($method === 'POST' && $action === 'friend_request') {
    $target=(int)($data['target_user_id']??0); if($target<=0 || $target===(int)$user['id'])fail('Invalid user',422);
    $payload=json_encode(['target_user_id'=>$target,'status'=>'pending']);
    $pdo->prepare('INSERT INTO stories(user_id,type,content,audience,created_at,expires_at) VALUES(?,?,?,"only_me",UTC_TIMESTAMP(),UTC_TIMESTAMP()+INTERVAL 3650 DAY)')->execute([(int)$user['id'],'hub_friend_request',$payload]);
    queue_user_notification($target,'system',$user['name'].' sent a friend request',$user['name'].' wants to connect with you.',['hub_action'=>'friend_request','user_id'=>(int)$user['id']]);
    out(['status'=>'pending'],201);
}

if ($method === 'POST' && $action === 'report') {
    $id=(int)($data['post_id']??0); $reason=trim((string)($data['reason']??'other')); if($id<=0)fail('Invalid post',422); hub_find_post($id,(int)$user['id']);
    $payload=json_encode(['post_id'=>$id,'reason'=>$reason,'reported_by'=>(int)$user['id'],'created_at'=>gmdate('Y-m-d H:i:s')]);
    $pdo->prepare('INSERT INTO stories(user_id,type,content,audience,created_at,expires_at) VALUES(?,?,?,"only_me",UTC_TIMESTAMP(),UTC_TIMESTAMP()+INTERVAL 3650 DAY)')->execute([(int)$user['id'],'hub_report',$payload]);
    out(['reported'=>true]);
}

if ($method === 'POST' && $action === 'block') {
    $target=(int)($data['target_user_id']??0); if($target<=0 || $target===(int)$user['id'])fail('Invalid user',422);
    $pdo->prepare('INSERT IGNORE INTO user_blocks(user_id,blocked_user_id) VALUES(?,?)')->execute([(int)$user['id'],$target]); out(['blocked'=>true]);
}

if ($method === 'POST' && $action === 'join_hub') {
    $hub=(int)($data['hub_id']??0); $st=$pdo->prepare("SELECT id,name FROM chats WHERE id=? AND type='public' AND group_category='india-city'");$st->execute([$hub]);$room=$st->fetch();if(!$room)fail('Hub not found',404);
    $pdo->prepare("INSERT INTO chat_members(chat_id,user_id,role,status,joined_at) VALUES(?,?,'member','active',UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE status='active'")->execute([$hub,(int)$user['id']]); out(['joined'=>true,'hub'=>$room]);
}

if ($method === 'POST' && $action === 'edit') {
    $id=(int)($data['post_id']??0);$text=trim((string)($data['text']??''));if($id<=0||$text==='')fail('Post and text are required',422);$row=hub_find_post($id,(int)$user['id']);if((int)$row['user_id']!==(int)$user['id'])fail('You can only edit your own post',403);$payload=json_decode((string)$row['content'],true)?:[];$payload['text']=$text;$audience=(string)($data['audience']??$row['audience']);if(!in_array($audience,['public','contacts','hub_members','only_me'],true))fail('Invalid audience',422);$pdo->prepare('UPDATE stories SET content=?,audience=? WHERE id=?')->execute([json_encode($payload,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),$audience,$id]);$fresh=hub_find_post($id,(int)$user['id']);out(['post'=>hub_decode_story($fresh)]);
}

if ($method === 'DELETE') {
    $id=(int)($data['post_id']??$_GET['post_id']??0);if($id<=0)fail('Post id is required',422);$row=hub_find_post($id,(int)$user['id']);if((int)$row['user_id']!==(int)$user['id'])fail('You can only delete your own post',403);$pdo->prepare('UPDATE stories SET deleted_at=UTC_TIMESTAMP() WHERE id=?')->execute([$id]);out(['deleted'=>true]);
}

fail('Method not allowed',405);
