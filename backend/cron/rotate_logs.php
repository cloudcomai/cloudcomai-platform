<?php
declare(strict_types=1);

$config = require dirname(__DIR__) . '/config/logging.php';

$directory = rtrim((string)$config['directory'], DIRECTORY_SEPARATOR);
$filename = basename((string)$config['filename']);
$logPath = $directory . DIRECTORY_SEPARATOR . $filename;
$lockPath = $directory . DIRECTORY_SEPARATOR . '.' . $filename . '.lock';

if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
    throw new RuntimeException('Unable to create log directory: ' . $directory);
}

$lock = fopen($lockPath, 'c+');
if ($lock === false || !flock($lock, LOCK_EX)) {
    throw new RuntimeException('Unable to acquire log rotation lock.');
}

try {
    if (is_file($logPath) && filesize($logPath) > 0) {
        $backup = $directory . DIRECTORY_SEPARATOR
            . $filename . '.' . gmdate((string)$config['backup_suffix_format']) . '.bak';

        if (file_exists($backup)) {
            $backup = $directory . DIRECTORY_SEPARATOR
                . $filename . '.' . gmdate((string)$config['backup_suffix_format']) . '.' . gmdate('is') . '.bak';
        }

        if (!rename($logPath, $backup)) {
            throw new RuntimeException('Unable to rotate log file.');
        }

        touch($logPath);
        @chmod($logPath, 0640);
    } elseif (!file_exists($logPath)) {
        touch($logPath);
        @chmod($logPath, 0640);
    }

    $retentionHours = max(1, (int)$config['retention_hours']);
    $cutoff = time() - ($retentionHours * 3600);
    $pattern = $directory . DIRECTORY_SEPARATOR . $filename . '.*.bak';

    foreach (glob($pattern) ?: [] as $backupPath) {
        if (is_file($backupPath) && filemtime($backupPath) !== false && filemtime($backupPath) < $cutoff) {
            @unlink($backupPath);
        }
    }
} finally {
    flock($lock, LOCK_UN);
    fclose($lock);
}
