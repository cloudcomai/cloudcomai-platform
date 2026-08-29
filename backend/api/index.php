<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/api_router.php';

function route_error(array $result): never
{
    http_response_code((int)$result['status']);
    header('Content-Type: application/json; charset=utf-8');
    if (!empty($result['allowed_methods'])) {
        header('Allow: ' . implode(', ', $result['allowed_methods']));
    }
    echo json_encode(['error' => $result['error']], JSON_UNESCAPED_SLASHES);
    exit;
}

try {
    $contract = cloudcomai_api_contract(__DIR__ . '/../api-contract.json');
    $router = new ApiRouter($contract['routes'], __DIR__);
    $result = $router->resolve(
        strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')),
        (string)($_SERVER['REQUEST_URI'] ?? '')
    );

    if ($result['status'] !== 200) {
        route_error($result);
    }

    require $result['handler'];
} catch (Throwable $error) {
    error_log('API router failure: ' . $error->getMessage());
    route_error(['status' => 500, 'error' => 'API router unavailable']);
}
