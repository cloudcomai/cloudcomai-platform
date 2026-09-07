<?php
require __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/contact_matching.php';

$user = auth_user();
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    fail('Method not allowed', 405);
}

$page = max(1, (int)($_GET['page'] ?? 1));
$pageSize = min(500, max(1, (int)($_GET['page_size'] ?? 500)));
$offset = ($page - 1) * $pageSize;

$contactsStmt = db()->prepare('
    SELECT id, resource_name, display_name, given_name, family_name,
           email, phone, photo_url
    FROM google_contacts
    WHERE user_id = ? AND deleted_at IS NULL
    ORDER BY COALESCE(NULLIF(display_name, \'\'), email, phone, resource_name) ASC, id ASC
');
$contactsStmt->execute([(int)$user['id']]);
$googleContacts = $contactsStmt->fetchAll();

$emailKeys = [];
$phoneKeys = [];
foreach ($googleContacts as $googleContact) {
    $emailKey = contact_email_key($googleContact['email'] ?? null);
    if ($emailKey !== '') {
        $emailKeys[$emailKey] = true;
    }

    $phoneKey = contact_phone_key($googleContact['phone'] ?? null);
    if ($phoneKey !== '') {
        $phoneKeys[$phoneKey] = true;
    }
}

$registeredUsers = [];
$registeredUserIds = [];
$loadCandidates = static function (string $column, array $identifiers) use (&$registeredUsers, &$registeredUserIds, $user): void {
    foreach (array_chunk(array_keys($identifiers), 500) as $identifierChunk) {
        $placeholders = implode(',', array_fill(0, count($identifierChunk), '?'));
        $candidateStmt = db()->prepare("
            SELECT u.id, u.name, u.user_id, u.email, u.mobile, u.account_status,
                   CASE WHEN u.updated_at IS NOT NULL AND u.updated_at >= UTC_TIMESTAMP() - INTERVAL 90 SECOND AND COALESCE(ups.hide_online_status,0)=0 THEN 1 ELSE 0 END AS online
            FROM users u
            LEFT JOIN user_privacy_settings ups ON ups.user_id=u.id
            WHERE u.id <> ? AND u.account_status = 'active' AND u.{$column} IN ({$placeholders})
              AND NOT EXISTS (
                  SELECT 1 FROM user_blocks ub
                  WHERE (ub.user_id=? AND ub.blocked_user_id=u.id)
                     OR (ub.user_id=u.id AND ub.blocked_user_id=?)
              )
        ");
        $candidateStmt->execute(array_merge([(int)$user['id']], $identifierChunk, [(int)$user['id'], (int)$user['id']]));
        foreach ($candidateStmt->fetchAll() as $candidate) {
            $candidateId = (int)$candidate['id'];
            if (!isset($registeredUserIds[$candidateId])) {
                $registeredUserIds[$candidateId] = true;
                $registeredUsers[] = $candidate;
            }
        }
    }
};

if ($emailKeys) {
    $loadCandidates('email', $emailKeys);
}
if ($phoneKeys) {
    $loadCandidates('mobile', $phoneKeys);
}

$matchedContacts = match_registered_contacts($googleContacts, $registeredUsers, (int)$user['id']);
$total = count($matchedContacts);
$contacts = array_slice($matchedContacts, $offset, $pageSize);

out([
    'contacts' => $contacts,
    'pagination' => [
        'page' => $page,
        'page_size' => $pageSize,
        'total' => $total,
        'has_more' => ($offset + count($contacts)) < $total,
    ],
]);
