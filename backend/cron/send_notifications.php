<?php
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$lockName = substr((string)db()->query('SELECT DATABASE()')->fetchColumn(),0,40) . ':push';
$lock=db()->prepare('SELECT GET_LOCK(?,0)'); $lock->execute([$lockName]);
if (!(int)$lock->fetchColumn()) exit("Another notification worker is running\n");
register_shutdown_function(static function() use ($lockName): void { db()->prepare('SELECT RELEASE_LOCK(?)')->execute([$lockName]); });
$rows = pending_notification_deliveries();
if (!$rows) exit("No pending notifications\n");
$payload = array_map(static fn(array $row): array => ['to'=>$row['token'],'title'=>$row['title'],'body'=>$row['body'],'sound'=>'default','badge'=>(int)$row['unread_count'],'channelId'=>'messages','data'=>json_decode((string)$row['data_json'], true) ?: new stdClass()], $rows);
$ch = curl_init('https://exp.host/--/api/v2/push/send');
curl_setopt_array($ch, [CURLOPT_POST=>true, CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>['Content-Type: application/json'], CURLOPT_POSTFIELDS=>json_encode($payload), CURLOPT_TIMEOUT=>20]);
$raw = curl_exec($ch); $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $curlError = curl_error($ch); curl_close($ch);
$tickets = json_decode((string)$raw, true)['data'] ?? [];
$ok = $http >= 200 && $http < 300;
foreach ($rows as $index => $row) {
    $ticket = $tickets[$index] ?? [];
    if ($ok && ($ticket['status'] ?? '') === 'ok') {
        $st = db()->prepare("UPDATE notification_delivery_queue SET status='SENT',ticket_id=?,attempts=attempts+1 WHERE id=?");
        $st->execute([$ticket['id'] ?? null, $row['id']]);
    } else {
        $error = $curlError ?: substr((string)$raw, 0, 500);
        $st = db()->prepare("UPDATE notification_delivery_queue SET status=IF(attempts>=4,'FAILED','PENDING'),last_error=?,attempts=attempts+1,available_at=DATE_ADD(UTC_TIMESTAMP(), INTERVAL LEAST((attempts+1)*5,60) MINUTE) WHERE id=?");
        $st->execute([$error, $row['id']]);
    }
}
echo 'Processed ' . count($rows) . " notification(s)\n";
