<?php
declare(strict_types=1);

require __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/contact_matching.php';

$user = auth_user();
$method = $_SERVER['REQUEST_METHOD'];
$userId = (int)$user['id'];

if ($method === 'POST') {
    $input = input();
    $contacts = $input['contacts'] ?? [];
    if (!is_array($contacts)) fail('contacts must be an array', 400);
    if (count($contacts) > 5000) fail('Too many contacts in one sync', 413);

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM phone_contacts WHERE user_id=?')->execute([$userId]);
        $insert = $pdo->prepare('INSERT INTO phone_contacts(user_id,contact_key,display_name,email,phone,created_at,updated_at) VALUES(?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())');
        $seen = [];
        foreach ($contacts as $contact) {
            if (!is_array($contact)) continue;
            $email = contact_email_key($contact['email'] ?? null);
            $phone = contact_phone_key($contact['phone'] ?? null);
            if ($email === '' && $phone === '') continue;
            $key = $email !== '' ? 'e:' . $email : 'p:' . $phone;
            if (isset($seen[$key])) continue;
            $seen[$key] = true;
            $name = trim((string)($contact['name'] ?? $contact['display_name'] ?? ''));
            $insert->execute([$userId, $key, $name !== '' ? mb_substr($name, 0, 255) : null, $email !== '' ? $email : null, $phone !== '' ? $phone : null]);
        }
        $pdo->commit();
        out(['ok' => true, 'count' => count($seen), 'source' => 'PHONE']);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

if ($method === 'GET') {
    $sql = "
        SELECT pc.id, pc.display_name, pc.email, pc.phone,
               u.id AS registered_user_id,
               u.name AS registered_name,
               u.user_id AS registered_user_id_text,
               CASE
                   WHEN u.updated_at IS NOT NULL
                    AND u.updated_at >= UTC_TIMESTAMP() - INTERVAL 90 SECOND
                    AND COALESCE(ups.hide_online_status, 0) = 0 THEN 1
                   ELSE 0
               END AS online,
               CASE
                   WHEN u.updated_at IS NULL THEN 'OFFLINE'
                   WHEN u.updated_at >= UTC_TIMESTAMP() - INTERVAL 90 SECOND
                    AND COALESCE(ups.hide_online_status, 0) = 0 THEN 'ONLINE'
                   WHEN u.updated_at >= UTC_TIMESTAMP() - INTERVAL 300 SECOND
                    AND COALESCE(ups.hide_online_status, 0) = 0 THEN 'AWAY'
                   ELSE 'OFFLINE'
               END AS presence_status
        FROM phone_contacts pc
        LEFT JOIN users u
          ON (pc.email IS NOT NULL AND pc.email = u.email)
          OR (pc.phone IS NOT NULL AND pc.phone = u.mobile)
        LEFT JOIN user_privacy_settings ups ON ups.user_id = u.id
        WHERE pc.user_id = ?
        ORDER BY COALESCE(NULLIF(pc.display_name, ''), u.name, pc.email, pc.phone) ASC, pc.id ASC
    ";
    $st = db()->prepare($sql);
    $st->execute([$userId]);
    out(['contacts' => $st->fetchAll(), 'source' => 'PHONE']);
}

fail('Method not allowed', 405);
