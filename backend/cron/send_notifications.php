<?php
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$rows = db()->query("SELECT q.id,q.device_id,d.token,h.title,h.body,h.data_json FROM notification_delivery_queue q JOIN notification_devices d ON d.id=q.device_id JOIN notification_history h ON h.id=q.notification_id WHERE q.status='PENDING' AND q.available_at<=UTC_TIMESTAMP() AND d.revoked_at IS NULL ORDER BY q.id ASC LIMIT 100")->fetchAll();
if (!$rows) exit("No pending notifications\n");
$payload = array_map(static fn(array $row): array => ['to'=>$row['token'],'title'=>$row['title'],'body'=>$row['body'],'data'=>json_decode((string)$row['data_json'], true) ?: new stdClass()], $rows);
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
