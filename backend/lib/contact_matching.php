<?php
declare(strict_types=1);

function contact_email_key(?string $email): string
{
    return strtolower(trim((string)$email));
}

function contact_phone_key(?string $phone): string
{
    $digits = preg_replace('/\D+/', '', trim((string)$phone));
    if (!is_string($digits) || strlen($digits) < 7 || strlen($digits) > 15) return '';
    // CloudComAI uses the national 10-digit portion for contact matching so
    // +91 98xxxxxxx and 98xxxxxxx resolve to the same registered account.
    return strlen($digits) > 10 ? substr($digits, -10) : $digits;
}

function presence_status(?string $updatedAt, bool $hidden = false): string
{
    if ($hidden || !$updatedAt) return 'OFFLINE';
    $timestamp = strtotime($updatedAt . ' UTC');
    if ($timestamp === false) return 'OFFLINE';
    $age = max(0, time() - $timestamp);
    if ($age <= 90) return 'ONLINE';
    if ($age <= 300) return 'AWAY';
    return 'OFFLINE';
}

/**
 * Merge Google, phone and accepted CloudComAI friend sources into one account
 * keyed collection. Direct CloudComAI friends are trusted by account id; phone
 * and Google sources require an exact normalized email or phone match.
 */
function merge_contact_sources(array $googleContacts, array $phoneContacts, array $friends, array $registeredUsers, int $currentUserId): array
{
    $usersById = [];
    $usersByEmail = [];
    $usersByPhone = [];
    foreach ($registeredUsers as $registeredUser) {
        $id = (int)($registeredUser['id'] ?? 0);
        if ($id <= 0 || $id === $currentUserId || ($registeredUser['account_status'] ?? 'active') !== 'active') continue;
        $usersById[$id] = $registeredUser;
        $email = contact_email_key($registeredUser['email'] ?? null);
        if ($email !== '') $usersByEmail[$email] = $registeredUser;
        $phone = contact_phone_key($registeredUser['mobile'] ?? null);
        if ($phone !== '') $usersByPhone[$phone] = $registeredUser;
    }

    $merged = [];
    $add = static function (array $registeredUser, array $source, string $sourceName) use (&$merged): void {
        $id = (int)$registeredUser['id'];
        $entry = $merged[$id] ?? [
            'id' => $id,
            'display_name' => null,
            'registered_name' => $registeredUser['name'] ?? null,
            'registered_user_id' => $id,
            'registered_user_id_text' => $registeredUser['user_id'] ?? null,
            'email' => $registeredUser['email'] ?? null,
            'phone' => $registeredUser['mobile'] ?? null,
            'photo_url' => null,
            'presence_status' => presence_status($registeredUser['updated_at'] ?? null, (bool)($registeredUser['hide_online'] ?? false)),
            'online' => false,
            'sources' => [],
        ];
        $entry['display_name'] = $entry['display_name'] ?: ($source['display_name'] ?? $source['name'] ?? null);
        $entry['email'] = $entry['email'] ?: ($source['email'] ?? null);
        $entry['phone'] = $entry['phone'] ?: ($source['phone'] ?? null);
        $entry['photo_url'] = $entry['photo_url'] ?: ($source['photo_url'] ?? null);
        if (!in_array($sourceName, $entry['sources'], true)) $entry['sources'][] = $sourceName;
        $entry['online'] = $entry['presence_status'] === 'ONLINE';
        $merged[$id] = $entry;
    };

    foreach ($friends as $friend) {
        $id = (int)($friend['id'] ?? $friend['user_id'] ?? 0);
        if (isset($usersById[$id])) $add($usersById[$id], ['name'=>$friend['name'] ?? null], 'CLOUDCOMAI');
    }
    foreach (array_merge($googleContacts, $phoneContacts) as $contact) {
        $email = contact_email_key($contact['email'] ?? null);
        $phone = contact_phone_key($contact['phone'] ?? null);
        $emailMatch = $email !== '' ? ($usersByEmail[$email] ?? null) : null;
        $phoneMatch = $phone !== '' ? ($usersByPhone[$phone] ?? null) : null;
        if ($emailMatch && $phoneMatch && (int)$emailMatch['id'] !== (int)$phoneMatch['id']) continue;
        $registered = $emailMatch ?: $phoneMatch;
        if ($registered) $add($registered, $contact, !empty($contact['source']) ? (string)$contact['source'] : 'PHONE');
    }

    $result = array_values($merged);
    usort($result, static function (array $a, array $b): int {
        $aOnline = $a['presence_status'] === 'ONLINE' ? 0 : 1;
        $bOnline = $b['presence_status'] === 'ONLINE' ? 0 : 1;
        if ($aOnline !== $bOnline) return $aOnline <=> $bOnline;
        $aName = $a['display_name'] ?: $a['registered_name'] ?: '';
        $bName = $b['display_name'] ?: $b['registered_name'] ?: '';
        return strcasecmp((string)$aName, (string)$bName) ?: ($a['registered_user_id'] <=> $b['registered_user_id']);
    });
    return $result;
}

function match_registered_contacts(array $contacts, array $registeredUsers, int $currentUserId): array
{
    return merge_contact_sources($contacts, [], [], $registeredUsers, $currentUserId);
}
