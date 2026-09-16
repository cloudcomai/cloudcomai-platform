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
$columns = notification_preference_columns();
$fields = ['user_id','enabled','message','`group`','attachment','`system`'];
$values = [$user['id'],(int)$current['enabled'],(int)$current['message'],(int)$current['group'],(int)$current['attachment'],(int)$current['system']];
$updates = ['enabled=VALUES(enabled)','message=VALUES(message)','`group`=VALUES(`group`)','attachment=VALUES(attachment)','`system`=VALUES(`system`)'];
foreach (['sound','vibration','preview'] as $optional) {
    if (!isset($columns[$optional])) continue;
    $fields[]=$optional; $values[]=(int)$current[$optional]; $updates[]="$optional=VALUES($optional)";
}
$pdo = db();
$pdo->prepare('INSERT INTO user_notification_preferences(' . implode(',', $fields) . ') VALUES(' . implode(',', array_fill(0,count($fields),'?')) . ') ON DUPLICATE KEY UPDATE ' . implode(',', $updates))->execute($values);
out(['preferences'=>$current]);
