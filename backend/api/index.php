<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/api_router.php';

function route_request_id(): string
{
    return bin2hex(random_bytes(8));
}

function route_error(array $result): never
{
    $requestId = (string)($result['request_id'] ?? '');
    if ($requestId !== '') header('X-Request-Id: ' . $requestId);
    http_response_code((int)$result['status']);
    header('Content-Type: application/json; charset=utf-8');
    if (!empty($result['allowed_methods'])) {
        header('Allow: ' . implode(', ', $result['allowed_methods']));
    }
    $payload = ['error' => (string)$result['error']];
    if (!empty($result['code'])) $payload['code'] = (string)$result['code'];
    if ($requestId !== '') $payload['request_id'] = $requestId;
    if (!empty($result['debug_message']) && getenv('CLOUDCOMAI_API_DEBUG') === '1') {
        $payload['debug_message'] = (string)$result['debug_message'];
    }
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

try {
    $contract = cloudcomai_api_contract(__DIR__ . '/../api-contract.json');
    $router = new ApiRouter($contract['routes'], __DIR__);
    $result = $router->resolve(
        strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')),
        (string)($_SERVER['REQUEST_URI'] ?? '')
    );
} catch (Throwable $error) {
    $requestId = route_request_id();
    error_log('API router failure [' . $requestId . ']: ' . $error->getMessage());
    route_error([
        'status' => 500,
        'error' => 'API router unavailable. Please retry.',
        'code' => 'API_ROUTER_ERROR',
        'request_id' => $requestId,
        'debug_message' => $error->getMessage(),
    ]);
}

if ($result['status'] !== 200) {
    route_error($result);
}

try {
    require $result['handler'];
} catch (Throwable $error) {
    $handler = basename((string)($result['handler'] ?? 'unknown'));
    $requestId = route_request_id();
    error_log('API handler failure [' . $handler . '][' . $requestId . ']: ' . $error->getMessage());
    error_log($error->getTraceAsString());
    $message = $handler === 'story_media_upload.php'
        ? 'Media upload failed on the server. Check the file type, size and upload configuration, then try again.'
        : 'The server could not complete this request. Please retry.';
    route_error([
        'status' => 500,
        'error' => $message,
        'code' => 'API_HANDLER_ERROR',
        'request_id' => $requestId,
        'debug_message' => $error->getMessage(),
    ]);
}