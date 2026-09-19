<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/retention.php';
$dryRun = in_array('--dry-run', array_slice($argv ?? [], 1), true);
try {
    $startedAt = gmdate('c');
    $startedNs = hrtime(true);
    $result = cleanup_expired_content(db(), __DIR__, 500, 100, $dryRun);
    $result['attachment_mb'] = round(((int)($result['attachment_bytes'] ?? 0)) / 1048576, 2);
    $result['duration_ms'] = (int)round((hrtime(true) - $startedNs) / 1000000);
    echo json_encode(['started_at'=>$startedAt,'completed_at'=>gmdate('c')] + $result, JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit($result['file_failures'] ? 1 : 0);
} catch (Throwable $error) {
    fwrite(STDERR, 'Cleanup failed: ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
