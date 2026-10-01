<?php
require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
$method = $_SERVER['REQUEST_METHOD'];
$action = (string)($_GET['action'] ?? '');
$pdo = db();

if ($method !== 'POST') fail('Method not allowed', 405);
$d = input();

if ($action === 'vote') {
    $pollId = (int)($d['poll_id'] ?? 0);
    $optionId = (int)($d['option_id'] ?? 0);
    if ($pollId <= 0 || $optionId <= 0) fail('Poll and option are required');

    try {
        $pdo->beginTransaction();
        // Serialize votes before reading or replacing a user's choice. Concurrent
        // first votes must not create multiple rows for this single-choice API.
        $membership = $pdo->prepare('SELECT p.chat_id,p.closed_at,p.closes_at FROM polls p INNER JOIN chat_members cm ON cm.chat_id=p.chat_id WHERE p.id=? AND cm.user_id=? AND cm.status="active" LIMIT 1 FOR UPDATE');
        $membership->execute([$pollId, $user['id']]);
        $poll = $membership->fetch();
        if (!$poll) fail('Poll not found or access denied', 403);
        if ($poll['closed_at'] || ($poll['closes_at'] && $poll['closes_at'] <= gmdate('Y-m-d H:i:s'))) fail('This poll is closed', 409);
        assert_chat_allows_messages((int)$poll['chat_id'], (int)$user['id']);

        $messageQuery = $pdo->prepare('SELECT id FROM messages WHERE chat_id=? AND type="poll" AND CAST(JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(body) THEN body ELSE "{}" END,"$.poll_id")) AS UNSIGNED)=? LIMIT 1');
        $messageQuery->execute([$poll['chat_id'], $pollId]);
        $messageId = (int)$messageQuery->fetchColumn();
        assert_visible_message($messageId, (int)$user['id']);

        $option = $pdo->prepare('SELECT id FROM poll_options WHERE id=? AND poll_id=? LIMIT 1');
        $option->execute([$optionId, $pollId]);
        if (!$option->fetch()) fail('Invalid poll option');

        $pdo->prepare('DELETE FROM poll_votes WHERE poll_id=? AND user_id=?')->execute([$pollId, $user['id']]);
        $pdo->prepare('INSERT INTO poll_votes(poll_id,option_id,user_id,created_at) VALUES(?,?,?,UTC_TIMESTAMP())')->execute([$pollId, $optionId, $user['id']]);
        // Existing clients synchronize already-loaded messages by edited_at.
        $pdo->prepare('UPDATE messages SET edited_at=UTC_TIMESTAMP() WHERE id=?')->execute([$messageId]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('poll vote error: '.$e->getMessage());
        fail('Failed to save vote', 500);
    }

    $options = $pdo->prepare('SELECT po.id, po.option_text AS text, COUNT(pv.user_id) AS votes, MAX(CASE WHEN pv.user_id=? THEN 1 ELSE 0 END) AS selected FROM poll_options po LEFT JOIN poll_votes pv ON pv.option_id=po.id AND pv.poll_id=po.poll_id WHERE po.poll_id=? GROUP BY po.id,po.option_text,po.display_order ORDER BY po.display_order ASC,po.id ASC');
    $options->execute([$user['id'], $pollId]);
    out(['poll_id'=>$pollId,'options'=>array_map(static function($row){return ['id'=>(int)$row['id'],'text'=>$row['text'],'votes'=>(int)$row['votes'],'selected'=>(bool)$row['selected']];}, $options->fetchAll())]);
}

$chatIds = $d['chat_ids'] ?? null;
if ($chatIds === null) {
    $singleChatId = (int)($d['chat_id'] ?? 0);
    $chatIds = $singleChatId > 0 ? [$singleChatId] : [];
}
if (!is_array($chatIds)) fail('Invalid poll destinations');
$normalizedChatIds = [];
foreach ($chatIds as $chatId) {
    $id = (int)$chatId;
    if ($id > 0 && !in_array($id, $normalizedChatIds, true)) $normalizedChatIds[] = $id;
}
if (!$normalizedChatIds) fail('At least one group is required');

$destinations = [];
$membership = $pdo->prepare('
    SELECT c.id, c.type, c.retention_seconds
    FROM chats c
    INNER JOIN chat_members cm ON cm.chat_id=c.id
    WHERE c.id=? AND cm.user_id=? AND cm.status="active"
    LIMIT 1
');

foreach ($normalizedChatIds as $chatId) {
    $membership->execute([$chatId, $user['id']]);
    $chatRow = $membership->fetch();
    if (!$chatRow) fail('Group not found or access denied', 403);
    if ($chatRow['type'] !== 'group') fail('Polls can only be created for groups', 403);
    assert_chat_allows_messages($chatId, (int)$user['id']);
    $destinations[] = ['id' => $chatId, 'retention_seconds' => $chatRow['retention_seconds']];
}

$question = trim((string)($d['question'] ?? ''));
$options = $d['options'] ?? $d['choices'] ?? [];
if ((!is_array($options) || count($options) < 3) && isset($d['option_a'], $d['option_b'], $d['option_c'])) {
    $options = [$d['option_a'], $d['option_b'], $d['option_c']];
}
if ($question === '' || !is_array($options)) fail('Invalid poll structure. Provide a question and at least 3 options.');

$cleanOptions = [];
foreach ($options as $option) {
    $value = trim((string)$option);
    if ($value !== '' && !in_array($value, $cleanOptions, true)) $cleanOptions[] = $value;
}
if (count($cleanOptions) < 3) fail('Please enter at least 3 poll options.');

require_once __DIR__ . '/../lib/poll_expiry.php';
try { $expiresAt = poll_expiry($d['expires_at'] ?? null); }
catch (InvalidArgumentException $error) { fail($error->getMessage(), 422); }

$createdMessages = [];
$createdPollIds = [];

try {
    $pdo->beginTransaction();

    foreach ($destinations as $destination) {
        $chatId = $destination['id'];

        $pdo->prepare('INSERT INTO polls(chat_id,creator_id,question,multiple_choice,anonymous,closes_at,created_at) VALUES(?,?,?,?,?,?,UTC_TIMESTAMP())')
            ->execute([$chatId,$user['id'],$question,!empty($d['multiple_choice'])?1:0,!empty($d['anonymous'])?1:0,$expiresAt]);
        $pollId = (int)$pdo->lastInsertId();
        $createdPollIds[] = $pollId;

        $st = $pdo->prepare('INSERT INTO poll_options(poll_id,option_text,display_order) VALUES(?,?,?)');
        foreach ($cleanOptions as $index=>$option) $st->execute([$pollId,$option,$index]);

        $messageBody = json_encode(['poll_id'=>$pollId], JSON_UNESCAPED_SLASHES);
        $messageInsert = $pdo->prepare('INSERT INTO messages(chat_id,sender_id,type,body,expires_at,created_at) VALUES(?,?,?,?,?,UTC_TIMESTAMP())');
        $messageInsert->execute([$chatId,$user['id'],'poll',$messageBody,$expiresAt]);
        $messageId = (int)$pdo->lastInsertId();

        $pdo->prepare('UPDATE chat_user_states SET hidden=0,updated_at=UTC_TIMESTAMP() WHERE chat_id=? AND user_id=?')
            ->execute([$chatId, $user['id']]);
        create_chat_notifications($chatId, (int)$user['id'], (string)$user['name'], 'Created a poll: ' . $question, $messageId);

        $createdOptions = [];
        $optionQuery = $pdo->prepare('SELECT id, option_text AS text, display_order FROM poll_options WHERE poll_id=? ORDER BY display_order ASC,id ASC');
        $optionQuery->execute([$pollId]);
        foreach ($optionQuery->fetchAll() as $row) {
            $createdOptions[] = ['id'=>(int)$row['id'],'text'=>$row['text'],'votes'=>0,'selected'=>false];
        }

        $createdMessages[] = [
            'id' => $messageId,
            'chat_id' => $chatId,
            'sender_id' => (int)$user['id'],
            'type' => 'poll',
            'body' => $messageBody,
            'poll_id' => $pollId,
            'poll' => ['id'=>$pollId,'question'=>$question,'options'=>$createdOptions,'expires_at'=>$expiresAt],
            'expires_at' => $expiresAt
        ];
    }

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Poll creation failed: '.$e->getMessage());
    fail('Poll creation failed', 500);
}

out([
    'messages' => $createdMessages,
    'poll_ids' => $createdPollIds,
    'message' => $createdMessages[0] ?? null,
    'poll_id' => $createdPollIds[0] ?? null
], 201);
