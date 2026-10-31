<?php

declare(strict_types=1);

require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
$pdo = db();
$allowedColors = ['default', 'blue', 'green', 'purple', 'pink', 'orange', 'red', 'teal'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare('SELECT font_color FROM user_chat_preferences WHERE user_id=? LIMIT 1');
    $stmt->execute([(int)$user['id']]);
    $color = (string)($stmt->fetchColumn() ?: 'default');
    if (!in_array($color, $allowedColors, true)) $color = 'default';
    out(['font_color' => $color, 'allowed_colors' => $allowedColors]);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $data = input();
    $color = strtolower(trim((string)($data['font_color'] ?? '')));
    if (!in_array($color, $allowedColors, true)) fail('Unsupported chat font color', 422);
    $stmt = $pdo->prepare('INSERT INTO user_chat_preferences(user_id,font_color,updated_at) VALUES(?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE font_color=VALUES(font_color),updated_at=UTC_TIMESTAMP()');
    $stmt->execute([(int)$user['id'], $color]);
    out(['font_color' => $color, 'saved' => true]);
}

fail('Method not allowed', 405);
