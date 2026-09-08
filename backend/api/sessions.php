<?php
require __DIR__ . '/../lib/bootstrap.php';
$user=auth_user();
$pdo=db();
$currentId=$GLOBALS['authenticated_session_id'];
$method=$_SERVER['REQUEST_METHOD'];
header('Cache-Control: no-store');
if ($method === 'GET') {
    $st=$pdo->prepare('SELECT id,device_label,created_at,last_seen_at,expires_at FROM user_sessions WHERE user_id=? AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP() ORDER BY last_seen_at DESC,id LIMIT 100');
    $st->execute([$user['id']]);
    $sessions=$st->fetchAll();
    foreach ($sessions as &$session) $session['current']=$session['id']===$currentId;
    unset($session);
    out(['sessions'=>$sessions]);
}
if ($method === 'DELETE') {
    $id=(string)($_GET['id'] ?? $currentId);
    if (!preg_match('/^[a-f0-9]{32}$/D',$id)) fail('Invalid session id',422);
    $pdo->beginTransaction();
    try {
        $st=$pdo->prepare('UPDATE user_sessions SET revoked_at=COALESCE(revoked_at,UTC_TIMESTAMP()) WHERE id=? AND user_id=?');
        $st->execute([$id,$user['id']]);
        $pdo->prepare('UPDATE notification_devices d INNER JOIN user_session_devices sd ON sd.device_id=d.id SET d.revoked_at=UTC_TIMESTAMP() WHERE sd.session_id=? AND d.user_id=?')->execute([$id,$user['id']]);
        $pdo->commit();
    } catch (Throwable $error) { $pdo->rollBack(); throw $error; }
    out(['revoked'=>true,'current'=>$id===$currentId]);
}
if ($method === 'POST' && (input()['revoke_others'] ?? false) === true) {
    $pdo->beginTransaction();
    try {
        // Same account lock as password reset; the version also invalidates unseen legacy tokens.
        $lock=$pdo->prepare('SELECT id FROM users WHERE id=? FOR UPDATE'); $lock->execute([$user['id']]);
        $pdo->prepare('INSERT INTO user_session_versions(user_id,session_version) VALUES(?,1) ON DUPLICATE KEY UPDATE session_version=session_version+1')->execute([$user['id']]);
        $version=$pdo->prepare('SELECT session_version FROM user_session_versions WHERE user_id=?'); $version->execute([$user['id']]);
        $pdo->prepare('UPDATE user_sessions SET revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND revoked_at IS NULL')->execute([$user['id']]);
        $pdo->prepare('UPDATE notification_devices SET revoked_at=UTC_TIMESTAMP() WHERE user_id=?')->execute([$user['id']]);
        $token=token_for((int)$user['id'],(int)$version->fetchColumn());
        $pdo->commit();
    } catch (Throwable $error) { $pdo->rollBack(); throw $error; }
    out(['token'=>$token,'user'=>$user]);
}
fail('Method not allowed',405);
