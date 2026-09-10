<?php
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

function hub_payload(array $row): array {
    $data = json_decode((string)$row['content'], true);
    return is_array($data) ? $data : ['text' => (string)$row['content']];
}
function hub_post(array $row): array {
    global $user;
    $data = hub_payload($row);
    $reactions = array_values(array_unique(array_map('intval', $data['reactions'] ?? [])));
    $saved = array_values(array_unique(array_map('intval', $data['saved'] ?? [])));
    $comments = is_array($data['comments'] ?? null) ? $data['comments'] : [];
    return [
        'id'=>(int)$row['id'], 'user_id'=>(int)$row['user_id'], 'author_name'=>$row['author_name'],
        'author_user_id'=>$row['author_user_id'], 'image_version'=>$row['image_version'] ?? null,
        'text'=>(string)($data['text'] ?? ''), 'link'=>$data['link'] ?? null,
        'media_url'=>$data['media_url'] ?? null, 'media_type'=>$data['media_type'] ?? null,
        'location'=>$data['location'] ?? null, 'audience'=>(string)$row['audience'],
        'created_at'=>$row['created_at'], 'reaction_count'=>count($reactions),
        'comment_count'=>count($comments), 'share_count'=>(int)($data['shares'] ?? 0),
        'reacted'=>in_array((int)$user['id'],$reactions,true), 'saved'=>in_array((int)$user['id'],$saved,true),
        'comments'=>array_slice($comments,-20),
    ];
}
function assert_hub_post(int $id, int $viewerId, bool $lock=false): array {
    $sql='SELECT s.*,u.name AS author_name,u.user_id AS author_user_id,u.updated_at AS image_version FROM stories s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.type="hub_post" AND s.deleted_at IS NULL';
    if($lock)$sql.=' FOR UPDATE';
    $st=db()->prepare($sql);$st->execute([$id]);$row=$st->fetch();
    if(!$row)fail('Post not found',404);
    if(users_block_state($viewerId,(int)$row['user_id'])['blocked'])fail('Post unavailable',404);
    $aud=(string)$row['audience'];
    if($aud==='only_me' && (int)$row['user_id']!==$viewerId)fail('Post unavailable',404);
    if($aud==='contacts' && (int)$row['user_id']!==$viewerId){
        $q=db()->prepare('SELECT 1 FROM google_contacts gc JOIN users u ON ((LOWER(gc.email)=LOWER(u.email) AND gc.email IS NOT NULL) OR (gc.phone=u.mobile AND gc.phone IS NOT NULL)) WHERE gc.user_id=? AND u.id=? AND gc.deleted_at IS NULL LIMIT 1');
        $q->execute([$viewerId,(int)$row['user_id']]);if(!$q->fetchColumn())fail('Post unavailable',404);
    }
    if($aud==='hub_members' && (int)$row['user_id']!==$viewerId){
        $q=db()->prepare("SELECT 1 FROM chat_members cm JOIN chats c ON c.id=cm.chat_id WHERE c.type='public' AND c.group_category='india-city' AND cm.user_id=? AND cm.status='active' LIMIT 1");
        $q->execute([$viewerId]);if(!$q->fetchColumn())fail('Post unavailable',404);
    }
    return $row;
}
function hub_posts(int $viewerId,string $view,string $tab): array {
    $where="s.type='hub_post' AND s.deleted_at IS NULL AND s.expires_at>UTC_TIMESTAMP() AND u.account_status='active' AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.user_id=? AND b.blocked_user_id=s.user_id) OR (b.user_id=s.user_id AND b.blocked_user_id=?))";
    $params=[$viewerId,$viewerId];
    $where.=" AND (s.audience='public' OR s.user_id=? OR (s.audience='contacts' AND EXISTS (SELECT 1 FROM google_contacts gc WHERE gc.user_id=? AND gc.deleted_at IS NULL AND ((LOWER(gc.email)=LOWER(u.email) AND gc.email IS NOT NULL) OR (gc.phone=u.mobile AND gc.phone IS NOT NULL)))) OR (s.audience='hub_members' AND EXISTS (SELECT 1 FROM chat_members cm JOIN chats c ON c.id=cm.chat_id WHERE c.type='public' AND c.group_category='india-city' AND cm.user_id=? AND cm.status='active')))";
    array_push($params,$viewerId,$viewerId,$viewerId);
    if($view==='my'){ $where.=' AND s.user_id=?';$params[]=$viewerId; }
    if($view==='saved'){ $where.=" AND JSON_SEARCH(s.content,'one',CAST(? AS CHAR),'', '$.saved[*]') IS NOT NULL";$params[]=(string)$viewerId; }
    if($view==='following'){
        $where.=" AND EXISTS (SELECT 1 FROM stories f WHERE f.type='hub_follow' AND f.user_id=? AND f.deleted_at IS NULL AND JSON_EXTRACT(f.content,'$.target_user_id')=s.user_id)";$params[]=$viewerId;
    }
    $order=($view==='discover' && $tab==='trending') ? "(CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.content,'$.shares')),0) AS UNSIGNED)+JSON_LENGTH(COALESCE(JSON_EXTRACT(s.content,'$.reactions'),'[]'))*2+JSON_LENGTH(COALESCE(JSON_EXTRACT(s.content,'$.comments'),'[]'))*3) DESC,s.created_at DESC" : 's.created_at DESC';
    $sql="SELECT s.*,u.name AS author_name,u.user_id AS author_user_id,u.updated_at AS image_version FROM stories s JOIN users u ON u.id=s.user_id WHERE $where ORDER BY $order LIMIT 100";
    $st=db()->prepare($sql);$st->execute($params);return array_map('hub_post',$st->fetchAll());
}

if($method==='GET'){
    $view=(string)($_GET['view']??'discover');$tab=(string)($_GET['tab']??'for_you');
    $people=db()->prepare('SELECT u.id,u.name,u.user_id,u.updated_at AS image_version,EXISTS(SELECT 1 FROM stories f WHERE f.type="hub_follow" AND f.user_id=? AND f.deleted_at IS NULL AND JSON_EXTRACT(f.content,"$.target_user_id")=u.id) AS following FROM users u WHERE u.id<>? AND u.account_status="active" AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.user_id=? AND b.blocked_user_id=u.id) OR (b.user_id=u.id AND b.blocked_user_id=?)) ORDER BY u.updated_at DESC,u.id DESC LIMIT 30');
    $people->execute([(int)$user['id'],(int)$user['id'],(int)$user['id'],(int)$user['id']]);
    $hubs=$pdo->query("SELECT c.id,c.name,(SELECT COUNT(*) FROM chat_members cm WHERE cm.chat_id=c.id AND cm.status='active') AS member_count FROM chats c WHERE c.type='public' AND c.group_category='india-city' ORDER BY member_count DESC,c.name ASC LIMIT 12");
    out(['posts'=>hub_posts((int)$user['id'],$view,$tab),'people'=>$people->fetchAll(),'hubs'=>$hubs->fetchAll()]);
}

$data=input();$action=(string)($data['action']??'');
if($method==='POST' && $action==='create'){
    $text=trim((string)($data['text']??''));if($text==='')fail('Post text is required',422);if(mb_strlen($text)>5000)fail('Post text is too long',422);
    $aud=(string)($data['audience']??'public');if(!in_array($aud,['public','contacts','hub_members','only_me'],true))fail('Invalid audience',422);
    $link=filter_var(trim((string)($data['link']??'')),FILTER_VALIDATE_URL)?:null;
    $payload=['text'=>$text,'link'=>$link,'media_url'=>$data['media_url']??null,'media_type'=>$data['media_type']??null,'location'=>trim((string)($data['location']??''))?:null,'reactions'=>[],'comments'=>[],'saved'=>[],'shares'=>0];
    $st=$pdo->prepare('INSERT INTO stories(user_id,type,content,audience,created_at,expires_at) VALUES(?,?,?, ?,UTC_TIMESTAMP(),UTC_TIMESTAMP()+INTERVAL 3650 DAY)');$st->execute([(int)$user['id'],'hub_post',json_encode($payload,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),$aud]);
    out(['post'=>hub_post(assert_hub_post((int)$pdo->lastInsertId(),(int)$user['id']))],201);
}
if($method==='POST' && $action==='edit'){
    $id=(int)($data['post_id']??0);$row=assert_hub_post($id,(int)$user['id']);if((int)$row['user_id']!==(int)$user['id'])fail('You can only edit your own post',403);
    $text=trim((string)($data['text']??''));if($text==='')fail('Post text is required',422);if(mb_strlen($text)>5000)fail('Post text is too long',422);$payload=hub_payload($row);$payload['text']=$text;
    $aud=(string)($data['audience']??$row['audience']);if(!in_array($aud,['public','contacts','hub_members','only_me'],true))fail('Invalid audience',422);
    $pdo->prepare('UPDATE stories SET content=?,audience=? WHERE id=?')->execute([json_encode($payload,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),$aud,$id]);out(['post'=>hub_post(assert_hub_post($id,(int)$user['id']))]);
}
if($method==='POST' && in_array($action,['react','save','share','comment'],true)){
    $id=(int)($data['post_id']??0);if($id<=0)fail('A valid post is required',422);$pdo->beginTransaction();
    try{$row=assert_hub_post($id,(int)$user['id'],true);$payload=hub_payload($row);$uid=(int)$user['id'];
        if($action==='react'){ $r=array_values(array_unique(array_map('intval',$payload['reactions']??[])));$r=in_array($uid,$r,true)?array_values(array_diff($r,[$uid])):array_merge($r,[$uid]);$payload['reactions']=$r; }
        elseif($action==='save'){ $r=array_values(array_unique(array_map('intval',$payload['saved']??[])));$r=in_array($uid,$r,true)?array_values(array_diff($r,[$uid])):array_merge($r,[$uid]);$payload['saved']=$r; }
        elseif($action==='share'){ $payload['shares']=(int)($payload['shares']??0)+1; }
        else { $text=trim((string)($data['text']??''));if($text==='')fail('Comment text is required',422);if(mb_strlen($text)>1000)fail('Comment is too long',422);$comments=is_array($payload['comments']??null)?$payload['comments']:[];$comments[]=['user_id'=>$uid,'name'=>$user['name'],'text'=>$text,'created_at'=>gmdate('Y-m-d H:i:s')];$payload['comments']=array_slice($comments,-100); }
        $pdo->prepare('UPDATE stories SET content=? WHERE id=?')->execute([json_encode($payload,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),$id]);$pdo->commit();$fresh=assert_hub_post($id,(int)$user['id']);out(['post'=>hub_post($fresh),'reacted'=>in_array($uid,array_map('intval',$payload['reactions']??[]),true),'saved'=>in_array($uid,array_map('intval',$payload['saved']??[]),true)]);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
if($method==='POST' && $action==='follow'){
    $target=(int)($data['target_user_id']??0);if($target<=0||$target===(int)$user['id'])fail('Invalid user',422);$q=$pdo->prepare('SELECT id FROM users WHERE id=? AND account_status="active"');$q->execute([$target]);if(!$q->fetch())fail('User not found',404);
    $q=$pdo->prepare('SELECT id FROM stories WHERE type="hub_follow" AND user_id=? AND deleted_at IS NULL AND JSON_EXTRACT(content,"$.target_user_id")=? LIMIT 1');$q->execute([(int)$user['id'],$target]);$existing=$q->fetchColumn();
    if($existing){$pdo->prepare('UPDATE stories SET deleted_at=UTC_TIMESTAMP() WHERE id=?')->execute([(int)$existing]);$following=false;}else{$pdo->prepare('INSERT INTO stories(user_id,type,content,audience,created_at,expires_at) VALUES(?,?,?,"only_me",UTC_TIMESTAMP(),UTC_TIMESTAMP()+INTERVAL 3650 DAY)')->execute([(int)$user['id'],'hub_follow',json_encode(['target_user_id'=>$target])]);$following=true;queue_user_notification($target,'system',$user['name'].' followed you',$user['name'].' followed you on CloudComAI Hubs',['hub_action'=>'follow','user_id'=>(int)$user['id']]);}
    out(['following'=>$following]);
}
if($method==='POST' && $action==='friend_request'){
    $target=(int)($data['target_user_id']??0);if($target<=0||$target===(int)$user['id'])fail('Invalid user',422);$q=$pdo->prepare('SELECT id FROM users WHERE id=? AND account_status="active"');$q->execute([$target]);if(!$q->fetch())fail('User not found',404);
    $pdo->prepare('INSERT INTO stories(user_id,type,content,audience,created_at,expires_at) VALUES(?,?,?,"only_me",UTC_TIMESTAMP(),UTC_TIMESTAMP()+INTERVAL 3650 DAY)')->execute([(int)$user['id'],'hub_friend_request',json_encode(['target_user_id'=>$target,'status'=>'pending'])]);queue_user_notification($target,'system',$user['name'].' sent a friend request',$user['name'].' wants to connect with you.',['hub_action'=>'friend_request','user_id'=>(int)$user['id']]);out(['status'=>'pending'],201);
}
if($method==='POST' && $action==='report'){
    $id=(int)($data['post_id']??0);assert_hub_post($id,(int)$user['id']);$reason=trim((string)($data['reason']??'other'));$pdo->prepare('INSERT INTO stories(user_id,type,content,audience,created_at,expires_at) VALUES(?,?,?,"only_me",UTC_TIMESTAMP(),UTC_TIMESTAMP()+INTERVAL 3650 DAY)')->execute([(int)$user['id'],'hub_report',json_encode(['post_id'=>$id,'reason'=>$reason,'reported_by'=>(int)$user['id'],'created_at'=>gmdate('Y-m-d H:i:s')])]);out(['reported'=>true]);
}
if($method==='POST' && $action==='block'){$target=(int)($data['target_user_id']??0);if($target<=0||$target===(int)$user['id'])fail('Invalid user',422);$pdo->prepare('INSERT IGNORE INTO user_blocks(user_id,blocked_user_id) VALUES(?,?)')->execute([(int)$user['id'],$target]);out(['blocked'=>true]);}
if($method==='POST' && $action==='join_hub'){$hub=(int)($data['hub_id']??0);$q=$pdo->prepare("SELECT id,name FROM chats WHERE id=? AND type='public' AND group_category='india-city'");$q->execute([$hub]);$room=$q->fetch();if(!$room)fail('Hub not found',404);$pdo->prepare("INSERT INTO chat_members(chat_id,user_id,role,status,joined_at) VALUES(?,?,'member','active',UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE status='active'")->execute([$hub,(int)$user['id']]);out(['joined'=>true,'hub'=>$room]);}
if($method==='DELETE'){$id=(int)($data['post_id']??$_GET['post_id']??0);$row=assert_hub_post($id,(int)$user['id']);if((int)$row['user_id']!==(int)$user['id'])fail('You can only delete your own post',403);$pdo->prepare('UPDATE stories SET deleted_at=UTC_TIMESTAMP() WHERE id=?')->execute([$id]);out(['deleted'=>true]);}
fail('Method not allowed',405);
