<?php

declare(strict_types=1);

final class ApiRouter
{
    public function __construct(
        private readonly array $routes,
        private readonly string $handlerRoot
    ) {
    }

    public static function normalizePath(string $requestUri): string
    {
        $path = trim((string)parse_url($requestUri, PHP_URL_PATH), '/');
        $versionPosition = strpos($path, 'v1/');
        return $versionPosition === false ? $path : substr($path, $versionPosition);
    }

    public function resolve(string $method, string $requestPath): array
    {
        $path = self::normalizePath($requestPath);
        $definition = $this->routes[$path] ?? null;

        if (!is_array($definition)) {
            return ['status' => 404, 'error' => 'API route not found'];
        }

        $allowedMethods = $definition['methods'] ?? [];
        if ($method !== 'OPTIONS' && !in_array($method, $allowedMethods, true)) {
            return [
                'status' => 405,
                'error' => 'Method not allowed',
                'allowed_methods' => $allowedMethods,
            ];
        }

        $handler = (string)($definition['handler'] ?? '');
        if ($handler === '' || str_contains($handler, '..')) {
            return ['status' => 500, 'error' => 'Invalid API route configuration'];
        }

        $handlerPath = $this->handlerRoot . '/' . $handler;
        if (!is_file($handlerPath)) {
            return ['status' => 500, 'error' => 'API handler is unavailable'];
        }

        return [
            'status' => 200,
            'path' => $path,
            'handler' => $handlerPath,
            'definition' => $definition,
        ];
    }
}

function cloudcomai_api_contract(string $contractFile): array
{
    $content = is_file($contractFile) ? file_get_contents($contractFile) : false;
    $contract = $content !== false ? json_decode($content, true) : null;
    if (!is_array($contract) || !is_array($contract['routes'] ?? null)) {
        throw new RuntimeException('API contract could not be loaded');
    }
    return $contract;
}
