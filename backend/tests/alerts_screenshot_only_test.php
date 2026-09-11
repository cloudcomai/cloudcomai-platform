<?php

declare(strict_types=1);

/**
 * Regression test for the Alerts contract. Alerts must only contain
 * notification_history rows whose payload explicitly identifies a screenshot event.
 */
function screenshotAlertRow(array $row): bool
{
    return strtolower((string)($row['category'] ?? '')) === 'system'
        && (($row['event'] ?? null) === 'screenshot');
}

$cases = [
    ['category' => 'system', 'event' => 'screenshot'],
    ['category' => 'message', 'event' => 'message'],
    ['category' => 'attachment', 'event' => 'download_request'],
    ['category' => 'system', 'event' => 'friend_request'],
];

if (!screenshotAlertRow($cases[0])) throw new RuntimeException('Screenshot alert was rejected');
if (screenshotAlertRow($cases[1]) || screenshotAlertRow($cases[2]) || screenshotAlertRow($cases[3])) {
    throw new RuntimeException('Non-screenshot activity leaked into Alerts');
}

echo "alerts_screenshot_only_test.php passed\n";
