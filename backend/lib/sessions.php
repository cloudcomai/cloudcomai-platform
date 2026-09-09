<?php
declare(strict_types=1);

function record_user_session(string $token, int $userId, int $issuedAt): array {
    $hash = hash('sha256',$token);
    $label = substr(trim((string)($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown device')),0,160);
    $pdo = db();
    $pdo->prepare('INSERT IGNORE INTO user_sessions(id,token_hash,user_id,device_label,created_at,expires_at) VALUES(?,?,?,?,?,?)')->execute([bin2hex(random_bytes(16)),$hash,$userId,$label ?: 'Unknown device',gmdate('Y-m-d H:i:s',$issuedAt),gmdate('Y-m-d H:i:s',$issuedAt+30*86400)]);
    $st=$pdo->prepare('SELECT id,revoked_at,expires_at FROM user_sessions WHERE token_hash=? AND user_id=?');
    $st->execute([$hash,$userId]);
    $session=$st->fetch();
    if (!$session || $session['revoked_at'] || $session['expires_at']<=gmdate('Y-m-d H:i:s')) fail('Session expired. Please sign in again.',401);
    $pdo->prepare('UPDATE user_sessions SET last_seen_at=UTC_TIMESTAMP() WHERE id=? AND last_seen_at<UTC_TIMESTAMP()-INTERVAL 5 MINUTE')->execute([$session['id']]);
    return $session;
}
