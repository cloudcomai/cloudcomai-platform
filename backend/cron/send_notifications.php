<?php
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/notification_push.php';
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$lockName = substr((string)db()->query('SELECT DATABASE()')->fetchColumn(),0,40) . ':push';
$lock=db()->prepare('SELECT GET_LOCK(?,0)'); $lock->execute([$lockName]);
if (!(int)$lock->fetchColumn()) exit("Another notification worker is running\n");
register_shutdown_function(static function() use ($lockName): void { db()->prepare('SELECT RELEASE_LOCK(?)')->execute([$lockName]); });
$rows = pending_notification_deliveries();
if (!$rows) exit("No pending notifications\n");
$payload = array_map('build_expo_push_payload', $rows);
$ch = curl_init('https://exp.host/--/api/v2/push/send');
curl_setopt_array($ch, [
    CURLOPT_POST=>true,
    CURLOPT_RETURNTRANSFER=>true,
    CURLOPT_HTTPHEADER=>['Accept: application/json','Content-Type: application/json'],
    CURLOPT_POSTFIELDS=>json_encode($payload, JSON_UNESCAPED_SLASHES),
    CURLOPT_CONNECTTIMEOUT=>5,
    CURLOPT_TIMEOUT=>20
]);
$raw = curl_exec($ch);
$http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);
$response = json_decode((string)$raw, true);
$tickets = is_array($response['data'] ?? null) ? $response['data'] : [];
$ok = $http >= 200 && $http < 300;
foreach ($rows as $index => $row) {
    $ticket = $tickets[$index] ?? [];
    if ($ok && ($ticket['status'] ?? '') === 'ok') {
        $st = db()->prepare("UPDATE notification_delivery_queue SET status='SENT',ticket_id=?,attempts=attempts+1,updated_at=UTC_TIMESTAMP() WHERE id=?");
        $st->execute([$ticket['id'] ?? null, $row['id']]);
        continue;
    }

    $error = $curlError ?: (string)($ticket['message'] ?? substr((string)$raw, 0, 500));
    $deviceError = (string)($ticket['details']['error'] ?? '');
    if ($deviceError === 'DeviceNotRegistered') {
        db()->prepare('UPDATE notification_devices SET revoked_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE id=?')->execute([(int)$row['device_id']]);
        db()->prepare("UPDATE notification_delivery_queue SET status='FAILED',last_error=?,attempts=attempts+1,updated_at=UTC_TIMESTAMP() WHERE id=?")->execute([$error ?: 'Device is no longer registered', $row['id']]);
        continue;
    }

    $st = db()->prepare("UPDATE notification_delivery_queue SET status=IF(attempts>=4,'FAILED','PENDING'),last_error=?,attempts=attempts+1,available_at=DATE_ADD(UTC_TIMESTAMP(), INTERVAL LEAST(POW(2,attempts+1),60) SECOND),updated_at=UTC_TIMESTAMP() WHERE id=?");
    $st->execute([$error, $row['id']]);
}
echo 'Processed ' . count($rows) . " notification(s)\n";
