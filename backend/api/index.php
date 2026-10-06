<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/logger.php';
require_once __DIR__ . '/../lib/api_router.php';

$startedAt = microtime(true);
$requestId = CloudComAiLogger::requestId();
header('X-Request-Id: ' . $requestId);
CloudComAiLogger::debug('router', 'API request started', [
    'method' => $_SERVER['REQUEST_METHOD'] ?? 'UNKNOWN',
    'path' => parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '',
]);

function route_request_id(): string
{
    return CloudComAiLogger::requestId();
}

function route_error(array $result): never
{
    global $startedAt;
    $requestId = (string)($result['request_id'] ?? CloudComAiLogger::requestId());
    if ($requestId !== '') header('X-Request-Id: ' . $requestId);
    $status = (int)$result['status'];
    CloudComAiLogger::warn('router', 'API request completed with error', [
        'status' => $status,
        'durationMs' => (int)round((microtime(true) - $startedAt) * 1000),
    ]);
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    if (!empty($result['allowed_methods'])) header('Allow: ' . implode(', ', $result['allowed_methods']));
    $payload = ['error' => (string)$result['error']];
    if (!empty($result['code'])) $payload['code'] = (string)$result['code'];
    if ($requestId !== '') $payload['request_id'] = $requestId;
    if (!empty($result['debug_message']) && getenv('CLOUDCOMAI_API_DEBUG') === '1') $payload['debug_message'] = (string)$result['debug_message'];
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

try {
    $contract = cloudcomai_api_contract(__DIR__ . '/../api-contract.json');
    $router = new ApiRouter($contract['routes'], __DIR__);
    $result = $router->resolve(strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')), (string)($_SERVER['REQUEST_URI'] ?? ''));
} catch (Throwable $error) {
    $requestId = route_request_id();
    CloudComAiLogger::error('router', 'API router failure', ['requestId' => $requestId, 'error' => $error]);
    route_error(['status'=>500,'error'=>'API router unavailable. Please retry.','code'=>'API_ROUTER_ERROR','request_id'=>$requestId,'debug_message'=>$error->getMessage()]);
}

if ($result['status'] !== 200) route_error($result);

try {
    require $result['handler'];
    CloudComAiLogger::info('router', 'API handler completed', [
        'handler' => basename((string)$result['handler']),
        'durationMs' => (int)round((microtime(true) - $startedAt) * 1000),
    ]);
} catch (Throwable $error) {
    $handler = basename((string)($result['handler'] ?? 'unknown'));
    $requestId = route_request_id();
    CloudComAiLogger::error('router', 'API handler failure', ['handler' => $handler, 'requestId' => $requestId, 'error' => $error]);
    $message = $handler === 'story_media_upload.php'
        ? 'Media upload failed on the server. Check the file type, size and upload configuration, then try again.'
        : 'The server could not complete this request. Please retry.';
    route_error(['status'=>500,'error'=>$message,'code'=>'API_HANDLER_ERROR','request_id'=>$requestId,'debug_message'=>$error->getMessage()]);
}