<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/retention.php';
$dryRun = in_array('--dry-run', array_slice($argv ?? [], 1), true);
try {
    $startedAt = gmdate('c');
    $result = cleanup_expired_content(db(), __DIR__, 500, 100, $dryRun);
    echo json_encode(['started_at'=>$startedAt,'completed_at'=>gmdate('c')] + $result, JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit($result['file_failures'] ? 1 : 0);
} catch (Throwable $error) {
    fwrite(STDERR, 'Cleanup failed: ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
