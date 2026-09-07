<?php
declare(strict_types=1);

function password_reset_web_url(mixed $configured): string {
    $url = is_string($configured) ? rtrim(trim($configured), '/') : '';
    $parts = parse_url($url);
    if (!$parts || !in_array($parts['scheme'] ?? '', ['https', 'http'], true)
        || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])
        || isset($parts['query']) || isset($parts['fragment']) || preg_match('/[\s\x00-\x1f]/', $url)) {
        throw new RuntimeException('Configure app.web_url with the complete web application URL, including its subdirectory');
    }
    return $url;
}

function password_recovery_response(): never {
    out(['message' => 'If the account has a registered email address, reset instructions will be sent. Check your inbox and spam folder. Please wait a minute before trying again.']);
}
