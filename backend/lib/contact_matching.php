<?php
declare(strict_types=1);

function contact_email_key(?string $email): string
{
    return strtolower(trim((string)$email));
}

function contact_phone_key(?string $phone): string
{
    $phone = trim((string)$phone);
    if ($phone === '') {
        return '';
    }

    $hasInternationalPrefix = str_starts_with($phone, '+');
    $digits = preg_replace('/\D+/', '', $phone);
    if (!is_string($digits) || strlen($digits) < 7 || strlen($digits) > 15) {
        return '';
    }

    return ($hasInternationalPrefix ? '+' : '') . $digits;
}

/**
 * Match synchronized Google contacts to active CloudComAI accounts.
 *
 * A match requires an exact normalized email address or phone number. Contacts
 * with conflicting email/phone matches are ignored, and each registered user is
 * returned only once.
 */
function match_registered_contacts(array $contacts, array $registeredUsers, int $currentUserId): array
{
    $usersByEmail = [];
    $usersByPhone = [];

    foreach ($registeredUsers as $registeredUser) {
        $registeredUserId = (int)($registeredUser['id'] ?? 0);
        if (
            $registeredUserId <= 0
            || $registeredUserId === $currentUserId
            || ($registeredUser['account_status'] ?? '') !== 'active'
        ) {
            continue;
        }

        $emailKey = contact_email_key($registeredUser['email'] ?? null);
        if ($emailKey !== '') {
            $usersByEmail[$emailKey] = $registeredUser;
        }

        $phoneKey = contact_phone_key($registeredUser['mobile'] ?? null);
        if ($phoneKey !== '') {
            $usersByPhone[$phoneKey] = $registeredUser;
        }
    }

    $matchesByRegisteredUser = [];
    foreach ($contacts as $contact) {
        $emailKey = contact_email_key($contact['email'] ?? null);
        $phoneKey = contact_phone_key($contact['phone'] ?? null);
        $emailMatch = $emailKey !== '' ? ($usersByEmail[$emailKey] ?? null) : null;
        $phoneMatch = $phoneKey !== '' ? ($usersByPhone[$phoneKey] ?? null) : null;

        if (
            $emailMatch
            && $phoneMatch
            && (int)$emailMatch['id'] !== (int)$phoneMatch['id']
        ) {
            continue;
        }

        $registeredUser = $emailMatch ?: $phoneMatch;
        if (!$registeredUser) {
            continue;
        }

        $registeredUserId = (int)$registeredUser['id'];
        if (isset($matchesByRegisteredUser[$registeredUserId])) {
            continue;
        }

        $matchesByRegisteredUser[$registeredUserId] = [
            'id' => (int)($contact['id'] ?? 0),
            'resource_name' => $contact['resource_name'] ?? null,
            'display_name' => $contact['display_name'] ?? null,
            'given_name' => $contact['given_name'] ?? null,
            'family_name' => $contact['family_name'] ?? null,
            'email' => $contact['email'] ?? null,
            'phone' => $contact['phone'] ?? null,
            'photo_url' => $contact['photo_url'] ?? null,
            'registered_user_id' => $registeredUserId,
            'registered_name' => $registeredUser['name'] ?? null,
            'registered_user_id_text' => $registeredUser['user_id'] ?? null,
            'online' => (bool)($registeredUser['online'] ?? false),
        ];
    }

    $matches = array_values($matchesByRegisteredUser);
    usort($matches, static function (array $left, array $right): int {
        $leftName = $left['display_name'] ?: $left['registered_name'] ?: $left['email'] ?: $left['phone'] ?: '';
        $rightName = $right['display_name'] ?: $right['registered_name'] ?: $right['email'] ?: $right['phone'] ?: '';
        $nameComparison = strcasecmp((string)$leftName, (string)$rightName);
        return $nameComparison !== 0
            ? $nameComparison
            : $left['registered_user_id'] <=> $right['registered_user_id'];
    });

    return $matches;
}
