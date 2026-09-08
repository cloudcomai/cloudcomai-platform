<?php
require __DIR__ . '/../lib/bootstrap.php';
$user = auth_user();
$method = $_SERVER['REQUEST_METHOD'];
$current = notification_preferences((int)$user['id']);
if ($method === 'GET') out(['preferences'=>$current]);
if ($method !== 'PUT') fail('Method not allowed',405);
$data = input();
foreach ($current as $key => $value) {
    if (!array_key_exists($key,$data)) continue;
    if (!is_bool($data[$key])) fail($key . ' must be true or false',422);
    $current[$key] = $data[$key];
}
$pdo = db();
$pdo->prepare('INSERT INTO user_notification_preferences(user_id,enabled,message,`group`,attachment,`system`) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE enabled=VALUES(enabled),message=VALUES(message),`group`=VALUES(`group`),attachment=VALUES(attachment),`system`=VALUES(`system`)')->execute(array_merge([$user['id']],array_map('intval',array_values($current))));
out(['preferences'=>$current]);
