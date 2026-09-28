<?php
declare(strict_types=1);

$source = file_get_contents(__DIR__ . '/../api/search_users.php');
if ($source === false) {
    throw new RuntimeException('Unable to read search_users.php');
}

foreach (['u.user_id LIKE ?', 'u.email LIKE ?'] as $expected) {
    if (strpos($source, $expected) === false) {
        throw new RuntimeException('Private chat search is missing identifier lookup: ' . $expected);
    }
}

if (strpos($source, "preg_match('/^\\d{10}$/', \$query)") === false) {
    throw new RuntimeException('Mobile discovery must require exactly 10 digits without a country code.');
}
if (strpos($source, 'u.mobile = ?') === false || strpos($source, 'u.mobile LIKE ?') !== false) {
    throw new RuntimeException('Mobile discovery must use an exact full-number match.');
}

foreach (['share_email', 'share_mobile'] as $visibilityGate) {
    if (strpos($source, $visibilityGate) !== false) {
        throw new RuntimeException('Identifier discovery must not depend on profile field visibility: ' . $visibilityGate);
    }
}

if (strpos($source, 'SELECT u.id,u.name,u.user_id') === false) {
    throw new RuntimeException('Search results must remain limited to the safe user summary fields.');
}

if (strpos($source, 'user_blocks') === false || strpos($source, 'u.account_status="active"') === false) {
    throw new RuntimeException('Private chat search must preserve account-status and blocking filters.');
}

echo "Private chat identifier search contract tests passed\n";
