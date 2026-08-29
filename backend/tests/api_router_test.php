<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/api_router.php';

$contract = cloudcomai_api_contract(__DIR__ . '/../api-contract.json');
$router = new ApiRouter($contract['routes'], __DIR__ . '/../api');

function expect(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$login = $router->resolve('POST', '/apiapp/api/v1/auth/login');
expect($login['status'] === 200, 'Login route did not resolve');
expect(basename($login['handler']) === 'login.php', 'Login handler mismatch');

$queryPath = ApiRouter::normalizePath('/api/v1/messages?chat_id=7&after_id=10');
expect($queryPath === 'v1/messages', 'Query string was not removed');

$wrongMethod = $router->resolve('GET', '/api/v1/auth/login');
expect($wrongMethod['status'] === 405, 'Wrong method was not rejected');

$missing = $router->resolve('GET', '/api/v1/does-not-exist');
expect($missing['status'] === 404, 'Missing route was not rejected');

echo "API router tests passed\n";
