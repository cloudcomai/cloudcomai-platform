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

    $membership = $pdo->prepare('SELECT p.chat_id,p.closed_at,p.closes_at FROM polls p INNER JOIN chat_members cm ON cm.chat_id=p.chat_id AND cm.user_id=? AND cm.status="active" WHERE p.id=? LIMIT 1');
    $membership->execute([$user['id'], $pollId]);
    $poll = $membership->fetch();
    if (!$poll) fail('Poll not found or access denied', 403);
    if ($poll['closed_at'] || ($poll['closes_at'] && $poll['closes_at'] <= gmdate('Y-m-d H:i:s'))) fail('This poll is closed', 409);
    assert_chat_allows_messages((int)$poll['chat_id'], (int)$user['id']);

    $messageQuery = $pdo->prepare('SELECT m.id
        FROM messages m
        INNER JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=? AND cm.status="active"
        LEFT JOIN chat_user_states cus ON cus.chat_id=m.chat_id AND cus.user_id=cm.user_id
        WHERE m.id>COALESCE(cus.cleared_through_message_id,0)
          AND m.chat_id=? AND m.type="poll" AND m.deleted_for_everyone=0
          AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP())
          AND JSON_VALID(m.body)
          AND CAST(JSON_UNQUOTE(JSON_EXTRACT(m.body,"$.poll_id")) AS UNSIGNED)=?
          AND NOT EXISTS (SELECT 1 FROM message_user_states mus WHERE mus.message_id=m.id AND mus.user_id=? AND mus.hidden=1)
        ORDER BY m.id DESC LIMIT 1');
    $messageQuery->execute([(int)$user['id'], (int)$poll['chat_id'], $pollId, (int)$user['id']]);
    $messageId = (int)$messageQuery->fetchColumn();
    if ($messageId <= 0) fail('Poll message not found or no longer visible', 404);

    $hiddenMessage = $pdo->prepare('SELECT hidden FROM message_user_states WHERE message_id=? AND user_id=? LIMIT 1');
    $hiddenMessage->execute([$messageId, (int)$user['id']]);
    if ((int)$hiddenMessage->fetchColumn() === 1) fail('Poll message not found or no longer visible', 404);

    try {
        $pdo->beginTransaction();
        $option = $pdo->prepare('SELECT id FROM poll_options WHERE id=? AND poll_id=? LIMIT 1');
        $option->execute([$optionId, $pollId]);
        if (!$option->fetch()) fail('Invalid poll option');
        $pdo->prepare('DELETE FROM poll_votes WHERE poll_id=? AND user_id=?')->execute([$pollId, $user['id']]);
        $pdo->prepare('INSERT INTO poll_votes(poll_id,option_id,user_id,created_at) VALUES(?,?,?,UTC_TIMESTAMP())')->execute([$pollId, $optionId, $user['id']]);
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

if ($action === 'edit') {
    $pollId = (int)($d['poll_id'] ?? 0);
    $question = trim((string)($d['question'] ?? ''));
    $inputOptions = $d['options'] ?? [];
    if ($pollId <= 0 || $question === '' || !is_array($inputOptions)) fail('Poll, question and options are required', 422);

    $cleanOptions = [];
    $requestedIds = [];
    foreach ($inputOptions as $option) {
        $optionId = 0;
        $value = '';
        if (is_array($option)) {
            $optionId = (int)($option['id'] ?? 0);
            $value = trim((string)($option['text'] ?? ''));
        } else {
            $value = trim((string)$option);
        }
        if ($value === '') continue;
        if ($optionId > 0) $requestedIds[] = $optionId;
        $cleanOptions[] = ['id' => $optionId, 'text' => $value];
    }
    $distinctTexts = [];
    foreach ($cleanOptions as $option) {
        if (!in_array($option['text'], $distinctTexts, true)) $distinctTexts[] = $option['text'];
    }
    if (count($distinctTexts) < 2 || count($distinctTexts) > 4 || count($distinctTexts) !== count($cleanOptions)) {
        fail('Invalid poll structure. Provide between 2 and 4 different options.', 422);
    }
    if (count($requestedIds) !== count(array_unique($requestedIds))) fail('Poll options must be unique.', 422);

    $pdo = db();
    $pollQuery = $pdo->prepare('SELECT p.id,p.chat_id,p.creator_id,p.closes_at,m.id AS message_id,m.created_at,m.edit_count,m.deleted_for_everyone,m.expires_at
        FROM polls p
        INNER JOIN messages m ON m.chat_id=p.chat_id AND m.type="poll" AND m.deleted_for_everyone=0 AND JSON_VALID(m.body) AND CAST(JSON_UNQUOTE(JSON_EXTRACT(m.body,"$.poll_id")) AS UNSIGNED)=p.id
        INNER JOIN chats c ON c.id=p.chat_id AND c.type="group"
        INNER JOIN chat_members cm ON cm.chat_id=p.chat_id AND cm.user_id=? AND cm.status="active"
        WHERE p.id=? AND p.creator_id=? LIMIT 1');
    $pollQuery->execute([$user['id'], $pollId, $user['id']]);
    $poll = $pollQuery->fetch();
    if (!$poll) fail('Poll not found or you are not allowed to edit it', 404);
    assert_chat_allows_messages((int)$poll['chat_id'], (int)$user['id']);
    if ((int)$poll['deleted_for_everyone'] === 1 || ($poll['expires_at'] && $poll['expires_at'] <= gmdate('Y-m-d H:i:s'))) fail('Poll cannot be edited because it is no longer available', 409);
    if ((int)$poll['edit_count'] >= 2 || strtotime((string)$poll['created_at']) < time() - 3 * 60 * 60) {
        fail('Poll cannot be edited, the 3-hour window has expired, or the edit limit has been reached', 409);
    }

    $expiryInput = $d['expires_at'] ?? null;
    try { $expiresAt = poll_expiry($expiryInput); }
    catch (InvalidArgumentException $error) { fail($error->getMessage(), 422); }

    try {
        $pdo->beginTransaction();
        $current = $pdo->prepare('SELECT id FROM poll_options WHERE poll_id=? ORDER BY display_order ASC,id ASC FOR UPDATE');
        $current->execute([$pollId]);
        $currentIds = array_map('intval', $current->fetchAll(PDO::FETCH_COLUMN));
        foreach ($requestedIds as $optionId) {
            if (!in_array($optionId, $currentIds, true)) fail('Invalid poll option', 422);
        }
        $keptIds = $requestedIds;
        $deleteIds = array_values(array_diff($currentIds, $keptIds));
        if ($deleteIds) {
            $marks = implode(',', array_fill(0, count($deleteIds), '?'));
            $pdo->prepare("DELETE FROM poll_votes WHERE poll_id=? AND option_id IN ($marks)")->execute(array_merge([$pollId], $deleteIds));
            $pdo->prepare("DELETE FROM poll_options WHERE poll_id=? AND id IN ($marks)")->execute(array_merge([$pollId], $deleteIds));
        }
        $updateOption = $pdo->prepare('UPDATE poll_options SET option_text=?,display_order=? WHERE id=? AND poll_id=?');
        $insertOption = $pdo->prepare('INSERT INTO poll_options(poll_id,option_text,display_order) VALUES(?,?,?)');
        foreach ($cleanOptions as $index => $option) {
            if ($option['id'] > 0) $updateOption->execute([$option['text'], $index, $option['id'], $pollId]);
            else $insertOption->execute([$pollId, $option['text'], $index]);
        }
        $pdo->prepare('UPDATE polls SET question=?,closes_at=? WHERE id=?')->execute([$question, $expiresAt, $pollId]);
        $pdo->prepare('UPDATE messages SET edit_count=edit_count+1,edited_at=UTC_TIMESTAMP(),expires_at=? WHERE id=?')->execute([$expiresAt, (int)$poll['message_id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('Poll edit failed: '.$e->getMessage());
        fail($e instanceof InvalidArgumentException ? $e->getMessage() : 'Poll edit failed', $e instanceof InvalidArgumentException ? 422 : 500);
    }

    $optionsQuery = $pdo->prepare('SELECT po.id,po.option_text AS text,po.display_order,COUNT(pv.user_id) AS votes,MAX(CASE WHEN pv.user_id=? THEN 1 ELSE 0 END) AS selected
        FROM poll_options po LEFT JOIN poll_votes pv ON pv.option_id=po.id AND pv.poll_id=po.poll_id
        WHERE po.poll_id=? GROUP BY po.id,po.option_text,po.display_order ORDER BY po.display_order ASC,po.id ASC');
    $optionsQuery->execute([$user['id'], $pollId]);
    $options = array_map(static fn($row) => ['id'=>(int)$row['id'],'text'=>$row['text'],'votes'=>(int)$row['votes'],'selected'=>(bool)$row['selected']], $optionsQuery->fetchAll());
    $updated = $pdo->prepare('SELECT m.id,m.chat_id,m.sender_id,m.type,m.body,m.reply_to_message_id,m.edit_count,m.edited_at,m.created_at,m.expires_at,u.name AS sender_name FROM messages m INNER JOIN users u ON u.id=m.sender_id WHERE m.id=?');
    $updated->execute([(int)$poll['message_id']]);
    $message = $updated->fetch();
    $message['poll_id'] = $pollId;
    $message['poll'] = ['id'=>$pollId,'question'=>$question,'options'=>$options,'expires_at'=>$expiresAt];
    out(['message'=>$message,'poll_id'=>$pollId]);
}

$chat = (int)($d['chat_id'] ?? 0);
$question = trim((string)($d['question'] ?? ''));
$options = $d['options'] ?? $d['choices'] ?? [];
if ((!is_array($options) || count($options) < 2) && isset($d['option_a'], $d['option_b'])) $options = [$d['option_a'], $d['option_b']];
if ($question === '' || !is_array($options)) fail('Invalid poll structure. Provide a question and 2 to 4 options.');

$cleanOptions = [];
foreach ($options as $option) {
    $value = trim((string)$option);
    if ($value !== '' && !in_array($value, $cleanOptions, true)) $cleanOptions[] = $value;
}
if (count($cleanOptions) < 2 || count($cleanOptions) > 4) fail('Invalid poll structure. Provide between 2 and 4 different options.', 422);

$membership = $pdo->prepare('SELECT c.type,c.retention_seconds FROM chats c INNER JOIN chat_members cm ON cm.chat_id=c.id WHERE c.id=? AND cm.user_id=? AND cm.status="active" LIMIT 1');
$membership->execute([$chat, $user['id']]);
$chatRow = $membership->fetch();
if (!$chatRow) fail('Not a member', 403);
if ($chatRow['type'] !== 'group') fail('Polls are available only in group chats.', 422);
assert_chat_allows_messages($chat, (int)$user['id']);

require_once __DIR__ . '/../lib/poll_expiry.php';
try { $expiresAt = poll_expiry($d['expires_at'] ?? null); }
catch (InvalidArgumentException $error) { fail($error->getMessage(), 422); }

try {
    $pdo->beginTransaction();
    $pdo->prepare('INSERT INTO polls(chat_id,creator_id,question,multiple_choice,anonymous,closes_at,created_at) VALUES(?,?,?,?,?,?,UTC_TIMESTAMP())')->execute([$chat,$user['id'],$question,!empty($d['multiple_choice'])?1:0,!empty($d['anonymous'])?1:0,$expiresAt]);
    $pollId = (int)$pdo->lastInsertId();
    $st = $pdo->prepare('INSERT INTO poll_options(poll_id,option_text,display_order) VALUES(?,?,?)');
    foreach ($cleanOptions as $index=>$option) $st->execute([$pollId,$option,$index]);
    $messageBody = json_encode(['poll_id'=>$pollId], JSON_UNESCAPED_SLASHES);
    $messageInsert = $pdo->prepare('INSERT INTO messages(chat_id,sender_id,type,body,expires_at,created_at) VALUES(?,?,?,?,?,UTC_TIMESTAMP())');
    $messageInsert->execute([$chat,$user['id'],'poll',$messageBody,$expiresAt]);
    $messageId = (int)$pdo->lastInsertId();
    $pdo->prepare('UPDATE chat_user_states SET hidden=0,updated_at=UTC_TIMESTAMP() WHERE chat_id=? AND user_id=?')->execute([$chat, $user['id']]);
    create_chat_notifications($chat, (int)$user['id'], (string)$user['name'], 'Created a poll: ' . $question, $messageId);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Poll creation failed: '.$e->getMessage());
    fail('Poll creation failed', 500);
}

$createdOptions = [];
$optionQuery = $pdo->prepare('SELECT id, option_text AS text, display_order FROM poll_options WHERE poll_id=? ORDER BY display_order ASC,id ASC');
$optionQuery->execute([$pollId]);
foreach ($optionQuery->fetchAll() as $row) $createdOptions[] = ['id'=>(int)$row['id'],'text'=>$row['text'],'votes'=>0,'selected'=>false];
$message = ['id'=>$messageId,'chat_id'=>$chat,'sender_id'=>(int)$user['id'],'type'=>'poll','body'=>$messageBody,'poll_id'=>$pollId,'poll'=>['id'=>$pollId,'question'=>$question,'options'=>$createdOptions,'expires_at'=>$expiresAt],'expires_at'=>$expiresAt];
out(['message'=>$message,'poll_id'=>$pollId],201);
