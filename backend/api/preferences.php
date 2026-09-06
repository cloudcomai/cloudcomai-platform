<?php

require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $st = $pdo->prepare('SELECT interest FROM user_interests WHERE user_id=? AND pinned=1 AND hidden=0 ORDER BY display_order ASC, interest ASC');
    $st->execute([$user['id']]);
    $preferences = array_values(array_map('strval', $st->fetchAll(PDO::FETCH_COLUMN)));
    out(['preferences' => $preferences, 'configured' => count($preferences) > 0]);
}

if ($method === 'PUT') {
    $data = input();
    $values = $data['interests'] ?? null;
    if (!is_array($values)) fail('Interests must be an array');

    $preferences = [];
    foreach ($values as $value) {
        if (!is_string($value)) fail('Each interest must be text');
        $interest = trim($value);
        $length = function_exists('mb_strlen') ? mb_strlen($interest) : strlen($interest);
        if ($interest === '' || $length > 100) fail('Each interest must contain 1 to 100 characters');
        if (!in_array($interest, $preferences, true)) $preferences[] = $interest;
    }
    if (count($preferences) < 1 || count($preferences) > 24) fail('Select between 1 and 24 interests');

    try {
        $pdo->beginTransaction();
        $pdo->prepare('DELETE FROM user_interests WHERE user_id=?')->execute([$user['id']]);
        $insert = $pdo->prepare('INSERT INTO user_interests(user_id,interest,display_order,pinned,hidden,updated_at) VALUES(?,?,?,1,0,UTC_TIMESTAMP())');
        foreach ($preferences as $order => $interest) $insert->execute([$user['id'], $interest, $order]);
        $pdo->commit();
        out(['preferences' => $preferences, 'configured' => true]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('preferences.php PUT error: ' . $e->getMessage());
        fail('Unable to save preferences', 500);
    }
}

fail('Method not allowed', 405);
