<?php
require __DIR__ . '/../lib/bootstrap.php';
$user=auth_user();
$hubInternalTypes=['hub_post','hub_follow','hub_friend_request','hub_report'];
if($_SERVER['REQUEST_METHOD']==='POST'){
    $d=input();$type=(string)($d['type']??'text');$content=trim((string)($d['content']??''));$aud=(string)($d['audience']??'friends');
    if($content==='')fail('Story content required');
    if(in_array($type,$hubInternalTypes,true))fail('Invalid story type',422);
    $st=db()->prepare('INSERT INTO stories(user_id,type,content,audience,created_at,expires_at) VALUES(?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()+INTERVAL 24 HOUR)');$st->execute([$user['id'],$type,$content,$aud]);out(['story_id'=>(int)db()->lastInsertId()],201);
}
if($_SERVER['REQUEST_METHOD']==='GET'){
    $st=db()->prepare("SELECT s.id,s.user_id,s.type,s.content,s.audience,s.created_at,s.expires_at,u.name FROM stories s JOIN users u ON u.id=s.user_id WHERE s.expires_at>UTC_TIMESTAMP() AND s.deleted_at IS NULL AND s.type NOT IN ('hub_post','hub_follow','hub_friend_request','hub_report') ORDER BY s.created_at DESC LIMIT 100");$st->execute();out(['stories'=>$st->fetchAll()]);
}
fail('Method not allowed',405);
