<?php
require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
function public_room_role(int $roomId, int $userId): ?string { $st=db()->prepare("SELECT role FROM chat_members WHERE chat_id=? AND user_id=? AND status='active' LIMIT 1"); $st->execute([$roomId,$userId]); $role=$st->fetchColumn(); return $role===false?null:(string)$role; }
function public_room_active_member(int $roomId,int $userId): bool { $st=db()->prepare("SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=? AND status='active' LIMIT 1"); $st->execute([$roomId,$userId]); return (bool)$st->fetchColumn(); }


if ($method === 'GET') {
    $action=strtolower(trim((string)($_GET['action'] ?? '')));
    $roomId=(int)($_GET['room_id'] ?? 0);
    if(in_array($action,['manage','online-users','reports'],true)){
        if($roomId<=0) fail('A valid public chat room is required',422);
        $room=db()->prepare("SELECT id FROM chats WHERE id=? AND type='public' AND room_type IN ('city','language') LIMIT 1");$room->execute([$roomId]);if(!$room->fetch())fail('Public chat room not found',404);
        if(!public_room_active_member($roomId,(int)$user['id']))fail('You are not a member of this public chat room',403);
        if($action==='reports'){
            $role=public_room_role($roomId,(int)$user['id']);if(!in_array($role,['owner','admin','moderator'],true))fail('Moderator access is required',403);
            $st=$pdo->prepare('SELECT r.id,r.reported_user_id,u.name AS reported_user_name,r.message_id,r.reason,r.details,r.status,r.created_at,r.reviewed_at FROM public_chat_reports r INNER JOIN users u ON u.id=r.reported_user_id WHERE r.chat_id=? ORDER BY r.id DESC LIMIT 200');$st->execute([$roomId]);out(['reports'=>$st->fetchAll()]);
        }
        $st=$pdo->prepare("SELECT u.id,u.name,COALESCE(up.hide_online_status,0) AS hide_online_status,u.updated_at FROM chat_members cm INNER JOIN users u ON u.id=cm.user_id LEFT JOIN user_privacy_settings up ON up.user_id=u.id WHERE cm.chat_id=? AND cm.status='active' AND u.account_status='active' ORDER BY u.name ASC LIMIT 500");$st->execute([$roomId]);$participants=[];$online=[];
        foreach($st->fetchAll() as $row){$isOnline=!$row['hide_online_status']&&!empty($row['updated_at'])&&strtotime($row['updated_at'])>=time()-90;$participants[]=['id'=>(int)$row['id'],'name'=>$row['name'],'online'=>$isOnline];if($isOnline)$online[]=['id'=>(int)$row['id'],'name'=>$row['name'],'online'=>true];}
        out(['room_id'=>$roomId,'online_users'=>$online,'participants'=>$participants]);
    }

    $search = trim((string)($_GET['q'] ?? ''));
    if (strlen($search) > 100) $search = substr($search, 0, 100);
    try {
        $where = "c.type='public' AND c.room_type IN ('city','language')";
        $params = [$user['id']];
        if ($search !== '') {
            $where .= ' AND (c.name LIKE ? OR c.group_category LIKE ? OR c.language_code LIKE ?)';
            $pattern = '%' . $search . '%';
            $params[] = $pattern;
            $params[] = $pattern;
            $params[] = $pattern;
        }
        $st = $pdo->prepare("SELECT c.id,c.name,c.group_category,c.room_type,c.language_code,c.retention_seconds,c.created_at,
                CASE WHEN cm.status='active' THEN 1 ELSE 0 END AS joined,
                (SELECT COUNT(*) FROM chat_members count_members WHERE count_members.chat_id=c.id AND count_members.status='active') AS joined_count,
                (SELECT COUNT(*) FROM chat_members online_members INNER JOIN users online_users ON online_users.id=online_members.user_id LEFT JOIN user_privacy_settings online_privacy ON online_privacy.user_id=online_users.id WHERE online_members.chat_id=c.id AND online_members.status='active' AND online_users.account_status='active' AND online_users.updated_at IS NOT NULL AND online_users.updated_at >= UTC_TIMESTAMP() - INTERVAL 90 SECOND AND COALESCE(online_privacy.hide_online_status,0)=0) AS online_count
            FROM chats c LEFT JOIN chat_members cm ON cm.chat_id=c.id AND cm.user_id=? WHERE $where ORDER BY CASE WHEN c.room_type='language' THEN c.id ELSE c.name END ASC, c.name ASC LIMIT 100");
        $st->execute($params);
        $rooms = array_map(static fn(array $room): array => [
            'id'=>(int)$room['id'],'name'=>$room['name'],'type'=>'public','isPublic'=>true,
            'city'=>$room['room_type']==='city' ? $room['name'] : null,'category'=>$room['group_category'],'group_category'=>$room['group_category'],'room_type'=>$room['room_type'],'language_code'=>$room['language_code'],
            'joined'=>(bool)$room['joined'],'joined_count'=>(int)$room['joined_count'],'online_count'=>(int)$room['online_count'],
            'retention_seconds'=>$room['retention_seconds'] !== null ? (int)$room['retention_seconds'] : null,'created_at'=>$room['created_at'],
        ], $st->fetchAll());

        $favoritesStmt = $pdo->prepare("SELECT c.id,c.name,c.group_category,c.room_type,c.language_code,c.retention_seconds,c.created_at,
                1 AS joined,
                (SELECT COUNT(*) FROM chat_members cm2 WHERE cm2.chat_id=c.id AND cm2.status='active') AS joined_count,
                (SELECT COUNT(*) FROM chat_members om INNER JOIN users ou ON ou.id=om.user_id LEFT JOIN user_privacy_settings op ON op.user_id=ou.id WHERE om.chat_id=c.id AND om.status='active' AND ou.account_status='active' AND ou.updated_at >= UTC_TIMESTAMP() - INTERVAL 90 SECOND AND COALESCE(op.hide_online_status,0)=0) AS online_count
            FROM chats c INNER JOIN chat_members cm ON cm.chat_id=c.id AND cm.user_id=? AND cm.status='active'
            WHERE c.type='public' AND c.room_type IN ('city','language') ORDER BY c.name ASC LIMIT 50");
        $favoritesStmt->execute([$user['id']]);
        $favorites = array_map(static fn(array $room): array => [
            'id'=>(int)$room['id'],'name'=>$room['name'],'type'=>'public','isPublic'=>true,'joined'=>true,
            'city'=>$room['room_type']==='city' ? $room['name'] : null,'category'=>$room['group_category'],'group_category'=>$room['group_category'],'room_type'=>$room['room_type'],'language_code'=>$room['language_code'],
            'joined_count'=>(int)$room['joined_count'],'online_count'=>(int)$room['online_count'],
            'retention_seconds'=>$room['retention_seconds'] !== null ? (int)$room['retention_seconds'] : null,'created_at'=>$room['created_at'],
        ], $favoritesStmt->fetchAll());
        out(['rooms'=>$rooms,'favorites'=>$favorites,'search_query'=>$search]);
    } catch (Throwable $e) {
        error_log('public_chats.php GET error: '.$e->getMessage());
        fail('Unable to load public chat rooms',500);
    }
}

if ($method === 'POST') {
    $data=input();
    $action=strtolower(trim((string)($data['action'] ?? 'join')));
    if($action==='report'){
        $roomId=(int)($data['room_id'] ?? 0);if($roomId<=0)fail('A valid public chat room is required',422);
        $roomQ=$pdo->prepare("SELECT id,name,retention_seconds FROM chats WHERE id=? AND type='public' AND room_type IN ('city','language') LIMIT 1");$roomQ->execute([$roomId]);$room=$roomQ->fetch();if(!$room)fail('Public chat room not found',404);
        $target=(int)($data['reported_user_id'] ?? 0);if($target<=0||$target===(int)$user['id'])fail('You cannot report yourself',422);if(!public_room_active_member($roomId,$target)||!public_room_active_member($roomId,(int)$user['id']))fail('Both accounts must be active room participants',403);
        $reason=trim((string)($data['reason'] ?? 'Other'));$allowed=['Harassment','Spam','Hate or abusive content','Impersonation','Unsafe content','Other'];if(!in_array($reason,$allowed,true))fail('Invalid report reason',422);$details=trim((string)($data['details'] ?? ''));if(strlen($details)>2000)$details=substr($details,0,2000);
        $messageId=(int)($data['message_id'] ?? 0);if($messageId>0){$mq=$pdo->prepare('SELECT id FROM messages WHERE id=? AND chat_id=? AND deleted_for_everyone=0 LIMIT 1');$mq->execute([$messageId,$roomId]);if(!$mq->fetch())fail('The selected message was not found in this room',404);$incidentKey='message:'.$messageId;}else{$incidentKey=trim((string)($data['incident_key'] ?? ''));}
        if($incidentKey===''||strlen($incidentKey)>128||!preg_match('/^[A-Za-z0-9:_-]+$/D',$incidentKey))fail('A valid incident key is required',422);
        try{
            $pdo->beginTransaction();$pdo->prepare('SELECT id FROM chats WHERE id=? FOR UPDATE')->execute([$roomId]);
            $ins=$pdo->prepare('INSERT IGNORE INTO public_chat_reports(chat_id,reporter_id,reported_user_id,message_id,incident_key,reason,details,status,created_at) VALUES(?,?,?,?,?,?,?,"valid",UTC_TIMESTAMP())');$ins->execute([$roomId,$user['id'],$target,$messageId?:null,$incidentKey,$reason,$details!==''?$details:null]);
            if($ins->rowCount()===0){$pdo->commit();out(['submitted'=>false,'duplicate'=>true,'message'=>'This incident has already been reported by your account.']);}
            $cnt=$pdo->prepare("SELECT COUNT(DISTINCT reporter_id) FROM public_chat_reports WHERE chat_id=? AND reported_user_id=? AND status='valid'");$cnt->execute([$roomId,$target]);$unique=(int)$cnt->fetchColumn();$blocked=false;$blockedUntil=null;
            if($unique>=5){$rs=$pdo->prepare('SELECT blocked_until,status FROM public_chat_restrictions WHERE chat_id=? AND user_id=? FOR UPDATE');$rs->execute([$roomId,$target]);$existing=$rs->fetch();$active=$existing&&in_array($existing['status'],['active','extended'],true)&&$existing['blocked_until']&&strtotime($existing['blocked_until'])>time();
                if(!$active){$blocked=true;$blockedUntil=gmdate('Y-m-d H:i:s',time()+7*86400);$blockedAt=gmdate('Y-m-d H:i:s');$pdo->prepare("INSERT INTO public_chat_restrictions(chat_id,user_id,blocked_at,blocked_until,reason,status) VALUES(?,?,?,?,'Multiple valid community reports','active') ON DUPLICATE KEY UPDATE blocked_at=VALUES(blocked_at),blocked_until=VALUES(blocked_until),reason=VALUES(reason),status='active',updated_at=UTC_TIMESTAMP()")->execute([$roomId,$target,$blockedAt,$blockedUntil]);$pdo->prepare("UPDATE chat_members SET status='banned' WHERE chat_id=? AND user_id=? AND status='active'")->execute([$roomId,$target]);
                    $body='A participant has been temporarily restricted from this public chat room for violating community policies and guidelines.';$expires=$room['retention_seconds']?gmdate('Y-m-d H:i:s',time()+(int)$room['retention_seconds']):null;$pdo->prepare("INSERT INTO messages(chat_id,sender_id,type,body,expires_at,created_at) VALUES(?,0,'moderation',?,?,UTC_TIMESTAMP())")->execute([$roomId,$body,$expires]);$mid=(int)$pdo->lastInsertId();
                    queue_user_notification($target,'system','Public chat restriction','Your access to this public chat room has been temporarily restricted for 7 days after multiple community reports. Please review and follow our Community Policies and Guidelines. You will be able to participate again after '.$blockedUntil.' UTC.',['event'=>'public_chat_block','chat_id'=>$roomId,'chat_type'=>'public','blocked_until'=>$blockedUntil,'persistent_moderation'=>1]);
                    $members=$pdo->prepare("SELECT user_id FROM chat_members WHERE chat_id=? AND status='active' AND user_id<>?");$members->execute([$roomId,$target]);foreach($members->fetchAll(PDO::FETCH_COLUMN) as $recipient)queue_user_notification((int)$recipient,'system','Public chat moderation',$body,['event'=>'public_chat_moderation','chat_id'=>$roomId,'chat_type'=>'public','message_id'=>$mid]);
                }
            }
            $pdo->commit();out(['submitted'=>true,'duplicate'=>false,'unique_reporters'=>$unique,'blocked'=>$blocked,'blocked_until'=>$blockedUntil]);
        }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();error_log('public_chats.php report error: '.$e->getMessage());fail('Unable to submit report',500);}
    }
    if($action==='moderation'){
        $roomId=(int)($data['room_id']??0);if($roomId<=0)fail('A valid public chat room is required',422);
        $role=public_room_role($roomId,(int)$user['id']);if(!in_array($role,['owner','admin','moderator'],true))fail('Moderator access is required',403);
        $target=(int)($data['user_id']??0);$moderationAction=strtolower(trim((string)($data['moderation_action']??'')));if($target<=0)fail('A valid user is required',422);
        if($moderationAction==='remove'){$pdo->prepare("UPDATE public_chat_restrictions SET blocked_until=UTC_TIMESTAMP(),status='removed',updated_at=UTC_TIMESTAMP() WHERE chat_id=? AND user_id=?")->execute([$roomId,$target]);$pdo->prepare("UPDATE chat_members SET status='active' WHERE chat_id=? AND user_id=? AND status='banned'")->execute([$roomId,$target]);out(['status'=>'removed']);}
        if($moderationAction==='extend'){$days=max(1,min(30,(int)($data['days']??7)));$st=$pdo->prepare('SELECT blocked_until FROM public_chat_restrictions WHERE chat_id=? AND user_id=? LIMIT 1');$st->execute([$roomId,$target]);$until=$st->fetchColumn();$base=$until&&strtotime($until)>time()?strtotime($until):time();$newUntil=gmdate('Y-m-d H:i:s',$base+$days*86400);$pdo->prepare("UPDATE public_chat_restrictions SET blocked_until=?,status='extended',updated_at=UTC_TIMESTAMP() WHERE chat_id=? AND user_id=?")->execute([$newUntil,$roomId,$target]);$pdo->prepare("UPDATE chat_members SET status='banned' WHERE chat_id=? AND user_id=?")->execute([$roomId,$target]);out(['status'=>'extended','blocked_until'=>$newUntil]);}
        fail('Unsupported moderation action',422);
    }
    $roomId=(int)($data['room_id'] ?? 0);
    if($roomId<=0) fail('A valid public chat room is required',422);
    $roomQuery=$pdo->prepare("SELECT id,name,retention_seconds FROM chats WHERE id=? AND type='public' AND room_type IN ('city','language') LIMIT 1");
    $roomQuery->execute([$roomId]); $room=$roomQuery->fetch();
    if (!$room) fail('Public chat room not found',404);
    try {
        $pdo->beginTransaction();
    $restriction=$pdo->prepare('SELECT blocked_until,status FROM public_chat_restrictions WHERE chat_id=? AND user_id=? FOR UPDATE');
    $restriction->execute([$roomId,$user['id']]);$restrictionRow=$restriction->fetch();
    $activeRestriction=$restrictionRow&&in_array($restrictionRow['status'],['active','extended'],true)&&$restrictionRow['blocked_until']&&strtotime($restrictionRow['blocked_until'])>time();
    if($activeRestriction){$pdo->rollBack();fail('You are temporarily restricted from this public chat room until '.$restrictionRow['blocked_until'].' UTC.',403);}
    if($restrictionRow&&$restrictionRow['blocked_until']&&strtotime($restrictionRow['blocked_until'])<=time())$pdo->prepare("UPDATE public_chat_restrictions SET status='expired',updated_at=UTC_TIMESTAMP() WHERE chat_id=? AND user_id=?")->execute([$roomId,$user['id']]);
        $existing = $pdo->prepare('SELECT status FROM chat_members WHERE chat_id=? AND user_id=? FOR UPDATE');
        $existing->execute([$roomId, $user['id']]);
        $existingStatus=$existing->fetchColumn();
        if ($existingStatus === 'banned') {
            $restrictionCheck=$pdo->prepare('SELECT blocked_until,status FROM public_chat_restrictions WHERE chat_id=? AND user_id=? LIMIT 1');
            $restrictionCheck->execute([$roomId,$user['id']]); $currentRestriction=$restrictionCheck->fetch();
            $expired=$currentRestriction && $currentRestriction['blocked_until'] && strtotime($currentRestriction['blocked_until'])<=time();
            if (!$expired) { $pdo->rollBack(); fail('You cannot join this public chat room',403); }
        }
        $pdo->prepare("INSERT INTO chat_members(chat_id,user_id,role,status,joined_at) VALUES(?,?,'member','active',UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE status='active',joined_at=COALESCE(joined_at,UTC_TIMESTAMP())")->execute([$roomId,$user['id']]);
        $pdo->prepare("INSERT INTO chat_user_states(chat_id,user_id,hidden,cleared_through_message_id,updated_at,notifications_muted) VALUES(?,?,0,0,UTC_TIMESTAMP(),0) ON DUPLICATE KEY UPDATE hidden=0,notifications_muted=0,updated_at=UTC_TIMESTAMP()")->execute([$roomId,$user['id']]);
        $pdo->commit();
        out(['chat'=>['id'=>$roomId,'type'=>'public','name'=>$room['name'],'isPublic'=>true,'retention_seconds'=>$room['retention_seconds'] !== null ? (int)$room['retention_seconds'] : null]]);
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); error_log('public_chats.php POST error: '.$e->getMessage()); fail('Unable to join public chat room',500); }
}

if ($method === 'DELETE') {
    $roomId=(int)($_GET['id'] ?? 0);
    if ($roomId<=0) fail('A valid public chat room is required',422);
    $membership=$pdo->prepare("SELECT c.id FROM chats c INNER JOIN chat_members cm ON cm.chat_id=c.id WHERE c.id=? AND c.type='public' AND c.room_type IN ('city','language') AND cm.user_id=? AND cm.status='active' LIMIT 1");
    $membership->execute([$roomId,$user['id']]);
    if (!$membership->fetch()) fail('Public chat room not found or you are not a member',404);
    try {
        $pdo->beginTransaction();
        $pdo->prepare("UPDATE chat_members SET status='removed' WHERE chat_id=? AND user_id=? AND status='active'")->execute([$roomId,$user['id']]);
        $pdo->prepare("INSERT INTO chat_user_states(chat_id,user_id,hidden,notifications_muted,updated_at) VALUES(?,?,1,1,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE hidden=1,notifications_muted=1,updated_at=UTC_TIMESTAMP()")->execute([$roomId,$user['id']]);
        $pdo->prepare("UPDATE notification_delivery_queue q INNER JOIN notification_history h ON h.id=q.notification_id SET q.status='FAILED',q.last_error='Left public room' WHERE h.user_id=? AND CAST(JSON_UNQUOTE(JSON_EXTRACT(h.data_json,'$.chat_id')) AS UNSIGNED)=? AND q.status='PENDING'")->execute([$user['id'],$roomId]);
        $pdo->commit();
        out(['message'=>'You left the public chat room','chat_id'=>$roomId,'status'=>'removed']);
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); error_log('public_chats.php DELETE error: '.$e->getMessage()); fail('Unable to leave public chat room',500); }
}

fail('Method not allowed',405);
