<?php
declare(strict_types=1);

// Local disposable database and mail capture only; never sends email.
if (getenv('CLOUDCOMAI_RUN_DB_TESTS') !== '1') {
    fwrite(STDERR, "Set CLOUDCOMAI_RUN_DB_TESTS=1 to run password recovery integration tests.\n");
    exit(1);
}
$database = 'cloudcomai_test_' . bin2hex(random_bytes(6));
$password = getenv('CLOUDCOMAI_TEST_DB_PASSWORD') ?: '';
$admin = new PDO('mysql:host=127.0.0.1;charset=utf8mb4', 'root', $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$root = sys_get_temp_dir() . '/' . $database;
$processes = [];

function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
function copy_backend(string $source, string $target): void {
    mkdir($target, 0700, true);
    foreach (new DirectoryIterator($source) as $entry) {
        if ($entry->isDot() || in_array($entry->getFilename(), ['storage', 'config.php'], true)) continue;
        $dest = $target . '/' . $entry->getFilename();
        if ($entry->isDir()) copy_backend($entry->getPathname(), $dest);
        else copy($entry->getPathname(), $dest);
    }
}
function request(string $method, string $path, mixed $body = null, int $expected = 200, string $token = ''): array {
    $headers = ['Content-Type: application/json', 'Origin: https://untrusted.example.test'];
    if ($token !== '') $headers[] = 'Authorization: Bearer ' . $token;
    $context = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $headers), 'content' => $body === null ? '' : json_encode($body), 'ignore_errors' => true, 'timeout' => 15]]);
    $raw = file_get_contents('http://127.0.0.1:18766/' . $path, false, $context);
    preg_match('/\s(\d{3})\s/', $http_response_header[0] ?? '', $match);
    $status = (int)($match[1] ?? 0);
    check($status === $expected, "$method $path returned $status, expected $expected: " . substr((string)$raw, 0, 300));
    return ['data' => json_decode((string)$raw, true), 'raw' => $raw, 'headers' => $http_response_header];
}
function mails(): array {
    global $root;
    if (!is_file($root . '/mail.jsonl')) return [];
    return array_map(fn($line) => json_decode($line, true), file($root . '/mail.jsonl', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES));
}
function mailed_token(): string {
    $all = mails();
    check(count($all) > 0, 'No recovery email captured');
    $last = $all[count($all) - 1];
    check(str_contains($last, 'To: alice@example.test'), 'Reset sent to the wrong mailbox');
    check(str_contains($last, 'From: CloudComAI <support@example.test>'), 'Configured sender missing');
    check((bool)preg_match('~https://web\.example\.test/app/\#reset_token=([A-Za-z0-9_-]{43})~', $last, $matches), 'Reset URL must use the configured web subdirectory and fragment');
    return $matches[1];
}
function allow_resend(): void {
    global $admin;
    $admin->exec('UPDATE password_reset_tokens SET created_at=UTC_TIMESTAMP()-INTERVAL 2 MINUTE WHERE user_id=1 AND created_at>UTC_TIMESTAMP()-INTERVAL 1 MINUTE');
}
function reset_input(string $token, string $password = 'New password 2026!'): array {
    return ['token' => $token, 'password' => $password];
}
function concurrent_resets(array $tokens): array {
    $sockets = [];
    foreach ($tokens as $index => $token) {
        $socket = stream_socket_client('tcp://127.0.0.1:' . (18766 + $index), $errno, $error, 5);
        check(is_resource($socket), 'Unable to connect to local concurrent API');
        stream_set_timeout($socket, 15);
        $body = json_encode(reset_input($token));
        fwrite($socket, "POST /v1/auth/reset-password HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: " . strlen($body) . "\r\nConnection: close\r\n\r\n" . $body);
        $sockets[] = $socket;
    }
    $statuses = [];
    foreach ($sockets as $socket) {
        $raw = stream_get_contents($socket);
        fclose($socket);
        preg_match('/^HTTP\/1\.[01] (\d+)/', $raw, $match);
        $statuses[] = (int)($match[1] ?? 0);
    }
    sort($statuses);
    return $statuses;
}

try {
    $admin->exec('CREATE DATABASE ' . $database . ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $admin->exec('USE ' . $database);
    $admin->exec(file_get_contents(__DIR__ . '/../database/fresh-install.sql'));
    check((int)$admin->query("SELECT COUNT(*) FROM schema_migrations WHERE version='007_password_recovery_sessions.sql'")->fetchColumn() === 1, 'Fresh installation must record migration 007');
    $admin->exec('DROP TABLE user_session_versions');
    $migration = file_get_contents(__DIR__ . '/../database/migrations/007_password_recovery_sessions.sql');
    $admin->exec($migration);
    $admin->exec($migration);
    $oldPassword = 'Old password 2026!';
    $insert = $admin->prepare('INSERT INTO users(id,user_id,name,email,mobile,password_hash,dob,gender,account_status) VALUES(?,?,?,?,?,?,?, ?,?)');
    $hash = password_hash($oldPassword, PASSWORD_DEFAULT);
    $insert->execute([1,'alice','Alice','alice@example.test','+15551112222',$hash,'1990-01-01','Female','active']);
    $insert->execute([2,'bob','Bob','bob@example.test',null,$hash,'1990-01-01','Male','active']);
    $insert->execute([3,'no_email','No Email',null,'+15553334444',$hash,'1990-01-01','Male','active']);
    $insert->execute([4,'suspended','Suspended','suspended@example.test',null,$hash,'1990-01-01','Male','suspended']);

    copy_backend(dirname(__DIR__), $root);
    $config = ['db' => ['host'=>'127.0.0.1','name'=>$database,'user'=>'root','pass'=>$password,'charset'=>'utf8mb4'], 'app'=>['token_secret'=>'integration-test-secret','allowed_origins'=>[],'web_url'=>'https://web.example.test/app/','mail_from'=>'support@example.test']];
    file_put_contents($root . '/config/config.php', '<?php return ' . var_export($config, true) . ';');
    file_put_contents($root . '/capture-mail.php', '<?php if (is_file($argv[2])) exit(1); file_put_contents($argv[1], json_encode(stream_get_contents(STDIN)).PHP_EOL, FILE_APPEND | LOCK_EX);');
    $sendmail = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($root . '/capture-mail.php') . ' ' . escapeshellarg($root . '/mail.jsonl') . ' ' . escapeshellarg($root . '/fail-mail');
    foreach ([18766,18767] as $port) {
        $process = proc_open([PHP_BINARY, '-d', 'sendmail_path=' . $sendmail, '-S', '127.0.0.1:' . $port, '-t', $root . '/api', $root . '/api/index.php'], [0=>['pipe','r'],1=>['file',$root.'/server-'.$port.'.log','a'],2=>['file',$root.'/server-'.$port.'.log','a']], $pipes);
        check(is_resource($process), 'Unable to start local test API');
        $processes[] = $process;
        for ($attempt=0; $attempt<50; $attempt++) {
            $socket = @fsockopen('127.0.0.1', $port, $errno, $errstr, .1);
            if ($socket) { fclose($socket); break; }
            usleep(100000);
        }
    }

    $session = request('POST','v1/auth/login',['identifier'=>'alice','password'=>$oldPassword])['data']['token'];
    $bobSession = request('POST','v1/auth/login',['identifier'=>'bob','password'=>$oldPassword])['data']['token'];
    $legacyPayload = '1|' . time() . '|old-client';
    $legacySession = base64_encode($legacyPayload . '|' . hash_hmac('sha256',$legacyPayload,'integration-test-secret'));
    request('GET','v1/users/preferences',null,200,$legacySession);
    request('POST','v1/notifications/device-token',['token'=>'ExponentPushToken[reset-test]','platform'=>'ANDROID'],200,$session);
    request('GET','v1/auth/forgot-password',null,405);
    request('POST','v1/auth/forgot-password',['identifier'=>'  '],400);
    request('POST','v1/auth/forgot-password',['identifier'=>['invalid']],400);
    $unknown = request('POST','v1/auth/forgot-password',['identifier'=>'unknown'])['data'];
    foreach (['no_email','suspended'] as $identifier) {
        check(request('POST','v1/auth/forgot-password',['identifier'=>$identifier])['data'] === $unknown,'Account existence leaked in recovery response');
    }
    check(count(mails()) === 0, 'Unavailable accounts must not receive reset emails');
    $known = request('POST','v1/auth/forgot-password',['identifier'=>' ALICE@EXAMPLE.TEST ']);
    check($known['data'] === $unknown && !isset($known['data']['token']), 'Known and unknown responses differ or expose a token');
    check(str_contains(strtolower(implode("\n",$known['headers'])), 'cache-control: no-store'), 'Recovery response must not be cached');
    $firstToken = mailed_token();
    $stored = $admin->query('SELECT token_hash,TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(),expires_at) AS ttl FROM password_reset_tokens WHERE user_id=1 ORDER BY id DESC LIMIT 1')->fetch(PDO::FETCH_ASSOC);
    check($stored['token_hash'] === hash('sha256',$firstToken) && (int)$stored['ttl'] >= 1790 && (int)$stored['ttl'] <= 1800, 'Store only a hashed token with a 30-minute expiry');
    request('POST','v1/auth/forgot-password',['identifier'=>'alice']);
    check(count(mails()) === 1, 'Immediate resend must be throttled');
    allow_resend();
    request('POST','v1/auth/forgot-password',['identifier'=>'+1 (555) 111-2222']);
    check(count(mails()) === 2, 'Formatted mobile number did not match the registered account');
    $secondToken = mailed_token();
    check($firstToken !== $secondToken, 'New requests need fresh random tokens');

    request('POST','v1/auth/reset-password',reset_input($secondToken,'short'),400);
    request('POST','v1/auth/reset-password',reset_input($secondToken,str_repeat('a',73)),400);
    request('POST','v1/auth/reset-password',reset_input($secondToken,"valid password\0"),400);
    request('POST','v1/auth/reset-password',reset_input('invalid'),400);
    request('POST','v1/auth/reset-password',reset_input(str_repeat('a',43)),400);
    check($admin->query('SELECT password_hash FROM users WHERE id=1')->fetchColumn() === $hash, 'Invalid requests changed the password');
    $admin->exec('UPDATE password_reset_tokens SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 SECOND WHERE user_id=1');
    request('POST','v1/auth/reset-password',reset_input($firstToken),400);
    $admin->exec('UPDATE password_reset_tokens SET expires_at=UTC_TIMESTAMP()+INTERVAL 30 MINUTE WHERE user_id=1');
    request('POST','v1/auth/reset-password',reset_input($firstToken));
    request('POST','v1/auth/reset-password',reset_input($firstToken),400);
    request('POST','v1/auth/reset-password',reset_input($secondToken),400);
    check((int)$admin->query('SELECT COUNT(*) FROM password_reset_tokens WHERE user_id=1 AND used_at IS NULL')->fetchColumn() === 0,'Sibling reset links remain usable');
    request('POST','v1/auth/login',['identifier'=>'alice','password'=>$oldPassword],401);
    $newSession = request('POST','v1/auth/login',['identifier'=>'alice','password'=>'New password 2026!'])['data']['token'];
    request('GET','v1/users/preferences',null,200,$newSession);
    request('GET','v1/users/preferences',null,401,$session);
    request('GET','v1/users/preferences',null,401,$legacySession);
    request('GET','v1/users/preferences',null,200,$bobSession);
    check((int)$admin->query('SELECT COUNT(*) FROM notification_devices WHERE user_id=1 AND revoked_at IS NULL')->fetchColumn() === 0,'Old push devices remain registered');
    $parts = explode('|',base64_decode($session));
    $parts[3] = '1';
    request('GET','v1/users/preferences',null,401,base64_encode(implode('|',$parts)));

    allow_resend();
    request('POST','v1/auth/forgot-password',['identifier'=>'alice']);
    $retryToken = mailed_token();
    allow_resend();
    touch($root.'/fail-mail');
    request('POST','v1/auth/forgot-password',['identifier'=>'alice']);
    unlink($root.'/fail-mail');
    check(count(mails()) === 3, 'Failed transport unexpectedly delivered email');
    check($admin->query('SELECT used_at FROM password_reset_tokens ORDER BY id DESC LIMIT 1')->fetchColumn() !== null,'Failed mail leaves an active reset token');
    // A failed resend must not invalidate a previously delivered link.
    check(concurrent_resets([$retryToken,$retryToken]) === [200,400], 'Concurrent uses of the same token both succeeded');
    request('GET','v1/users/preferences',null,401,$newSession);

    allow_resend();
    request('POST','v1/auth/forgot-password',['identifier'=>'alice']);
    check(count(mails()) === 4, 'Fifth hourly request should be allowed');
    allow_resend();
    check(request('POST','v1/auth/forgot-password',['identifier'=>'alice'])['data'] === $unknown, 'Throttle exposes account existence');
    check(count(mails()) === 4, 'Sixth hourly request must not send email');
    $admin->exec('UPDATE password_reset_tokens SET created_at=UTC_TIMESTAMP()-INTERVAL 2 HOUR WHERE user_id=1');
    request('POST','v1/auth/forgot-password',['identifier'=>'alice']);
    $anotherToken = mailed_token();
    allow_resend();
    request('POST','v1/auth/forgot-password',['identifier'=>'alice']);
    check(concurrent_resets([$anotherToken,mailed_token()]) === [200,400], 'Concurrent sibling reset links both succeeded');

    // Recovery cannot reactivate an account suspended after the email was sent.
    $admin->exec('UPDATE password_reset_tokens SET created_at=UTC_TIMESTAMP()-INTERVAL 2 HOUR WHERE user_id=1');
    request('POST','v1/auth/forgot-password',['identifier'=>'alice']);
    $suspendedToken = mailed_token();
    $admin->exec("UPDATE users SET account_status='suspended' WHERE id=1");
    request('POST','v1/auth/reset-password',reset_input($suspendedToken),400);

    require_once __DIR__ . '/../lib/password_recovery.php';
    check(password_reset_web_url('https://example.test/') === 'https://example.test','Root URL invalid');
    check(password_reset_web_url('http://localhost:5173/app/') === 'http://localhost:5173/app','Local web URL invalid');
    foreach (['','//example.test','javascript:alert(1)','https://user:pass@example.test','https://example.test/?next=other','https://example.test/#app'] as $invalid) {
        try { password_reset_web_url($invalid); throw new LogicException('Invalid web URL accepted'); }
        catch (RuntimeException $error) { check(!$error instanceof LogicException, $error->getMessage()); }
    }
    echo "Password recovery, captured mail, identifier matching, expiry, throttling, atomic reset, session revocation, and migration tests passed\n";
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    foreach (glob($root.'/server-*.log') ?: [] as $log) fwrite(STDERR,file_get_contents($log));
    $failed = true;
} finally {
    foreach ($processes as $process) { proc_terminate($process); proc_close($process); }
    $admin->exec('DROP DATABASE IF EXISTS ' . $database);
    if (is_dir($root)) {
        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        rmdir($root);
    }
}
exit(empty($failed) ? 0 : 1);
