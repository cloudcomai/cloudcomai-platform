<?php
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$rows = db()->query("SELECT q.id,q.device_id,q.ticket_id FROM notification_delivery_queue q WHERE q.status='SENT' AND q.ticket_id IS NOT NULL AND q.updated_at<=DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE) ORDER BY q.id ASC LIMIT 100")->fetchAll();
if (!$rows) exit("No receipts pending\n");
$ids = array_values(array_unique(array_map(static fn(array $row): string => (string)$row['ticket_id'], $rows)));
$ch = curl_init('https://exp.host/--/api/v2/push/getReceipts');
curl_setopt_array($ch, [CURLOPT_POST=>true, CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>['Content-Type: application/json'], CURLOPT_POSTFIELDS=>json_encode(['ids'=>$ids]), CURLOPT_TIMEOUT=>20]);
$raw = curl_exec($ch); $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $error = curl_error($ch); curl_close($ch);
if ($http < 200 || $http >= 300) { fwrite(STDERR, 'Expo receipt request failed: ' . ($error ?: substr((string)$raw, 0, 500)) . "\n"); exit(1); }
$receipts = json_decode((string)$raw, true)['data'] ?? [];
foreach ($rows as $row) {
    $receipt = $receipts[(string)$row['ticket_id']] ?? null;
    if (!$receipt || ($receipt['status'] ?? '') === 'ok') continue;
    $providerError = (string)($receipt['details']['error'] ?? $receipt['message'] ?? 'Expo delivery failed');
    if ($providerError === 'DeviceNotRegistered') {
        db()->prepare('UPDATE notification_devices SET revoked_at=UTC_TIMESTAMP(), updated_at=UTC_TIMESTAMP() WHERE id=?')->execute([(int)$row['device_id']]);
    }
    db()->prepare("UPDATE notification_delivery_queue SET status='FAILED',last_error=? WHERE id=?")->execute([$providerError, (int)$row['id']]);
}
echo 'Checked ' . count($rows) . " Expo receipt(s)\n";
