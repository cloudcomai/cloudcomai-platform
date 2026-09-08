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

$googleCallback = $router->resolve(
    'GET',
    '/apiapp/api/v1/integrations/google/callback?code=sample&state=sample'
);
expect($googleCallback['status'] === 200, 'Google callback route did not resolve');
expect(
    str_ends_with($googleCallback['handler'], '/google/callback.php'),
    'Google callback handler mismatch'
);
expect(
    ($googleCallback['definition']['auth'] ?? null) === false,
    'Google callback must not require an application bearer token'
);

$wrongCallbackMethod = $router->resolve('POST', '/api/v1/integrations/google/callback');
expect($wrongCallbackMethod['status'] === 405, 'Google callback accepted an invalid method');

$userProfile = $router->resolve('GET', '/api/v1/users/profile?id=17');
expect($userProfile['status'] === 200, 'User profile route did not resolve');
expect(basename($userProfile['handler']) === 'user_profile.php', 'User profile handler mismatch');

$queryPath = ApiRouter::normalizePath('/api/v1/messages?chat_id=7&after_id=10');
expect($queryPath === 'v1/messages', 'Query string was not removed');

$wrongMethod = $router->resolve('GET', '/api/v1/auth/login');
expect($wrongMethod['status'] === 405, 'Wrong method was not rejected');

$missing = $router->resolve('GET', '/api/v1/does-not-exist');
expect($missing['status'] === 404, 'Missing route was not rejected');

$bootstrap = file_get_contents(__DIR__ . '/../lib/bootstrap.php');
expect(is_string($bootstrap), 'Could not read backend bootstrap');
expect(str_contains($bootstrap, 'charset=utf8mb4'), 'Runtime PDO connection must force utf8mb4');
expect(str_contains($bootstrap, "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"), 'Runtime PDO connection must explicitly set utf8mb4');
expect(str_contains($bootstrap, 'JSON_UNESCAPED_UNICODE'), 'JSON responses must preserve Unicode characters');

$freshInstall = file_get_contents(__DIR__ . '/../database/fresh-install.sql');
expect(is_string($freshInstall), 'Could not read fresh-install schema');
expect(str_contains($freshInstall, 'SET NAMES utf8mb4;'), 'Fresh-install schema must initialize utf8mb4');
expect(str_contains($freshInstall, 'messages (') && str_contains($freshInstall, 'DEFAULT CHARSET=utf8mb4'), 'Messages table must use utf8mb4');

echo "API router tests passed\n";
