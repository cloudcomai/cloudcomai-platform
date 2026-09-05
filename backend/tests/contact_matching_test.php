<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/contact_matching.php';

function expect_contact_match(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

expect_contact_match(contact_email_key(' Alice@Example.COM ') === 'alice@example.com', 'Email normalization failed');
expect_contact_match(contact_phone_key(' (987) 654-3210 ') === '9876543210', 'Local phone normalization failed');
expect_contact_match(contact_phone_key('+91 98765-43210') === '+919876543210', 'International phone normalization failed');

$users = [
    ['id' => 1, 'name' => 'Current User', 'user_id' => 'current', 'email' => 'current@example.com', 'mobile' => null, 'account_status' => 'active'],
    ['id' => 2, 'name' => 'Alice Account', 'user_id' => 'alice', 'email' => 'alice@example.com', 'mobile' => '+15551234567', 'account_status' => 'active', 'online' => 1],
    ['id' => 3, 'name' => 'Bob Account', 'user_id' => 'bob', 'email' => 'bob@example.com', 'mobile' => '9876543210', 'account_status' => 'active', 'online' => 0],
    ['id' => 4, 'name' => 'Suspended User', 'user_id' => 'suspended', 'email' => 'suspended@example.com', 'mobile' => null, 'account_status' => 'suspended'],
];

$contacts = [
    ['id' => 11, 'resource_name' => 'people/alice-email', 'display_name' => 'Alice Saved', 'email' => 'Alice@Example.COM', 'phone' => null],
    ['id' => 12, 'resource_name' => 'people/alice-phone', 'display_name' => 'Alice Duplicate', 'email' => null, 'phone' => '+1 (555) 123-4567'],
    ['id' => 13, 'resource_name' => 'people/bob', 'display_name' => 'Bob Saved', 'email' => null, 'phone' => '(987) 654-3210'],
    ['id' => 14, 'resource_name' => 'people/unknown', 'display_name' => 'Unknown', 'email' => 'unknown@example.com', 'phone' => null],
    ['id' => 15, 'resource_name' => 'people/current', 'display_name' => 'Me', 'email' => 'current@example.com', 'phone' => null],
    ['id' => 16, 'resource_name' => 'people/suspended', 'display_name' => 'Suspended', 'email' => 'suspended@example.com', 'phone' => null],
];

$matches = match_registered_contacts($contacts, $users, 1);
expect_contact_match(count($matches) === 2, 'Only unique, active, registered contacts should be returned');
expect_contact_match($matches[0]['registered_user_id'] === 2, 'Alice should match by normalized email');
expect_contact_match($matches[0]['display_name'] === 'Alice Saved', 'The saved Google contact name should be retained');
expect_contact_match($matches[0]['online'] === true, 'Registered user presence should be returned');
expect_contact_match($matches[1]['registered_user_id'] === 3, 'Bob should match by normalized phone');

$ambiguous = match_registered_contacts([
    ['id' => 20, 'resource_name' => 'people/ambiguous', 'display_name' => 'Ambiguous', 'email' => 'alice@example.com', 'phone' => '9876543210'],
], $users, 1);
expect_contact_match($ambiguous === [], 'A contact matching two different accounts must be hidden');

echo "Contact matching tests passed\n";
