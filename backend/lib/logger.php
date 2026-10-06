<?php
declare(strict_types=1);

final class CloudComAiLogger
{
    private const LEVELS = ['debug' => 10, 'info' => 20, 'warn' => 30, 'error' => 40];
    private static ?string $requestId = null;
    private static ?array $config = null;

    public static function requestId(): string {
        if (self::$requestId !== null) return self::$requestId;
        $incoming = trim((string)($_SERVER['HTTP_X_REQUEST_ID'] ?? ''));
        self::$requestId = preg_match('/^[A-Za-z0-9._:-]{1,128}$/', $incoming) ? $incoming : bin2hex(random_bytes(16));
        return self::$requestId;
    }

    public static function log(string $level, string $scope, string $message, array $context = []): void {
        $configured = strtolower((string)(getenv('CLOUDCOMAI_LOG_LEVEL') ?: 'info'));
        $minimum = self::LEVELS[$configured] ?? 20;
        $level = strtolower($level);

        if (!isset(self::LEVELS[$level]) || self::LEVELS[$level] < $minimum) return;

        $entry = [
            'timestamp' => gmdate('c'),
            'level' => strtoupper($level),
            'app' => 'api',
            'scope' => $scope ?: 'api',
            'message' => $message,
            'requestId' => self::requestId(),
            'context' => self::sanitize($context),
        ];

        self::write(json_encode($entry, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL);
    }

    public static function info(string $scope, string $message, array $context = []): void { self::log('info', $scope, $message, $context); }
    public static function debug(string $scope, string $message, array $context = []): void { self::log('debug', $scope, $message, $context); }
    public static function warn(string $scope, string $message, array $context = []): void { self::log('warn', $scope, $message, $context); }
    public static function error(string $scope, string $message, array $context = []): void { self::log('error', $scope, $message, $context); }

    private static function write(string $line): void {
        $config = self::config();
        $directory = rtrim((string)$config['directory'], DIRECTORY_SEPARATOR);
        $filename = basename((string)$config['filename']);
        $path = $directory . DIRECTORY_SEPARATOR . $filename;

        if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
            error_log('CloudComAI logger: unable to create log directory ' . $directory);
            return;
        }

        if (@file_put_contents($path, $line, FILE_APPEND | LOCK_EX) === false) {
            error_log('CloudComAI logger: unable to write ' . $path);
            return;
        }

        @chmod($path, 0640);
    }

    private static function config(): array {
        if (self::$config !== null) return self::$config;

        $configPath = dirname(__DIR__) . '/config/logging.php';
        self::$config = is_file($configPath)
            ? require $configPath
            : [
                'directory' => dirname(__DIR__) . '/storage/logs',
                'filename' => 'cloudcomai.log',
                'hourly_backup' => true,
                'backup_suffix_format' => 'Ymd_H',
                'retention_hours' => 168,
            ];

        return self::$config;
    }

    private static function sanitize(array $context): array {
        $result = [];
        foreach ($context as $key => $value) {
            if (preg_match('/password|token|authorization|cookie|secret|otp|email|phone|mobile|message|body/i', (string)$key)) continue;
            if ($value instanceof Throwable) {
                $result[$key] = ['type' => get_class($value), 'message' => $value->getMessage()];
            } elseif (is_scalar($value) || $value === null) {
                $result[$key] = $value;
            } elseif (is_array($value)) {
                $result[$key] = '[array]';
            } else {
                $result[$key] = '[' . get_debug_type($value) . ']';
            }
        }
        return $result;
    }
}
