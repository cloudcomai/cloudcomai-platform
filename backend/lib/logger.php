<?php
declare(strict_types=1);

final class CloudComAiLogger
{
    private const LEVELS = ['debug' => 10, 'info' => 20, 'warn' => 30, 'error' => 40];
    private static ?string $requestId = null;
    public static function requestId(): string {
        if (self::$requestId !== null) return self::$requestId;
        $incoming = trim((string)($_SERVER['HTTP_X_REQUEST_ID'] ?? ''));
        self::$requestId = preg_match('/^[A-Za-z0-9._:-]{1,128}$/', $incoming) ? $incoming : bin2hex(random_bytes(16));
        return self::$requestId;
    }
    public static function log(string $level, string $scope, string $message, array $context = []): void {
        $configured = strtolower((string)(getenv('CLOUDCOMAI_LOG_LEVEL') ?: 'info')); $minimum = self::LEVELS[$configured] ?? 20; $level = strtolower($level);
        if (!isset(self::LEVELS[$level]) || self::LEVELS[$level] < $minimum) return;
        $entry = ['timestamp'=>gmdate('c'),'level'=>strtoupper($level),'app'=>'api','scope'=>$scope ?: 'api','message'=>$message,'requestId'=>self::requestId(),'context'=>self::sanitize($context)];
        error_log(json_encode($entry, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }
    public static function info(string $scope, string $message, array $context = []): void { self::log('info',$scope,$message,$context); }
    public static function debug(string $scope, string $message, array $context = []): void { self::log('debug',$scope,$message,$context); }
    public static function warn(string $scope, string $message, array $context = []): void { self::log('warn',$scope,$message,$context); }
    public static function error(string $scope, string $message, array $context = []): void { self::log('error',$scope,$message,$context); }
    private static function sanitize(array $context): array {
        $result=[]; foreach ($context as $key=>$value) { if (preg_match('/password|token|authorization|cookie|secret|otp|email|phone|mobile|message|body/i',(string)$key)) continue; if ($value instanceof Throwable) $result[$key]=['type'=>get_class($value),'message'=>$value->getMessage()]; elseif (is_scalar($value)||$value===null) $result[$key]=$value; elseif (is_array($value)) $result[$key]='[array]'; else $result[$key]='['.get_debug_type($value).']'; } return $result;
    }
}
