<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/api_router.php';

$contract = cloudcomai_api_contract(__DIR__ . '/../api-contract.json');
$router = new ApiRouter($contract['routes'], __DIR__ . '/../api');
$route = $router->resolve('GET', '/api/v1/users/chat-font-color');
if ($route['status'] !== 200 || basename($route['handler']) !== 'chat_font_color.php') {
    throw new RuntimeException('Chat font color preference route is not registered correctly');
}

$handler = file_get_contents(__DIR__ . '/../api/chat_font_color.php');
$migration = file_get_contents(__DIR__ . '/../sql/migrations/004_user_chat_font_color.sql');
$schema = file_get_contents(__DIR__ . '/../sql/schema.sql');
$messages = file_get_contents(__DIR__ . '/../api/messages.php');

foreach (['default', 'blue', 'green', 'purple', 'pink', 'orange', 'red', 'teal'] as $color) {
    if (!str_contains($handler, "'{$color}'")) {
        throw new RuntimeException("Chat font color allowlist is missing {$color}");
    }
}
if (!str_contains($handler, 'in_array($color, $allowedColors, true)')) {
    throw new RuntimeException('Chat font color input is not allowlisted');
}
if (!str_contains($migration, 'CREATE TABLE IF NOT EXISTS user_chat_preferences')) {
    throw new RuntimeException('Chat font color migration does not create its preference table');
}
if (!str_contains($schema, 'CREATE TABLE user_chat_preferences')) {
    throw new RuntimeException('Fresh-install schema is missing chat font preferences');
}
if (!str_contains($messages, 'sender_font_color') || !str_contains($messages, 'user_chat_preferences')) {
    throw new RuntimeException('Message responses do not include the sender font color');
}

echo "Chat font color feature tests passed\n";
