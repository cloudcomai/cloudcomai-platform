<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/retention.php';
try {
    $result = cleanup_expired_content(db(), __DIR__);
    echo json_encode(['completed_at'=>gmdate('c')] + $result, JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit($result['file_failures'] ? 1 : 0);
} catch (Throwable $error) {
    fwrite(STDERR, 'Cleanup failed: ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
