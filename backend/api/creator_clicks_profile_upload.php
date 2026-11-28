<?php
declare(strict_types=1);

require __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/media_upload.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('Method not allowed', 405);
$user = auth_user();
$userId = (int)$user['id'];
$kind = strtolower(trim((string)($_POST['kind'] ?? 'creator')));
if (!in_array($kind, ['creator','channel'], true)) fail('Invalid Creator Clicks picture type', 422);
$column = $kind === 'channel' ? 'channel_avatar_path' : 'avatar_path';
$profile = db()->prepare('SELECT user_id,' . $column . ' AS old_path FROM creator_clicks_profiles WHERE user_id=? AND channel_deleted_at IS NULL LIMIT 1');
$profile->execute([$userId]);
$current = $profile->fetch();
if (!$current) fail('Create an active Creator Clicks channel first', 409);
$file = $_FILES['file'] ?? null;
if (!is_array($file) || (int)($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) fail('A profile picture is required', 422);
$tmp = (string)($file['tmp_name'] ?? '');
if ($tmp === '' || !is_uploaded_file($tmp)) fail('The uploaded picture could not be verified', 422);
$size = (int)($file['size'] ?? 0);
if ($size <= 0 || $size > 5 * 1024 * 1024) fail('Creator profile pictures must be 5 MB or smaller', 422);
$mime = cloudcomai_detect_mime_type($tmp);
$extensions = ['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];
if (!isset($extensions[$mime])) fail('Only JPG, PNG and WebP profile pictures are supported', 422);
$dimensions = @getimagesize($tmp);
if (!$dimensions || (int)$dimensions[0] > 6000 || (int)$dimensions[1] > 6000) fail('The selected picture is invalid or exceeds 6000 x 6000 pixels', 422);
$folder = dirname(__DIR__) . '/uploads/creator-clicks/' . $userId;
if (!is_dir($folder) && !mkdir($folder, 0755, true) && !is_dir($folder)) fail('Unable to prepare Creator Clicks picture storage', 500);
try { $filename = bin2hex(random_bytes(16)) . '.' . $extensions[$mime]; }
catch (Throwable $exception) { fail('Unable to generate a secure picture filename', 500); }
if (!move_uploaded_file($tmp, $folder . DIRECTORY_SEPARATOR . $filename)) fail('Unable to save Creator Clicks picture', 500);
$pdo = db();
$pdo->beginTransaction();
try {
    $pdo->prepare('UPDATE creator_clicks_profiles SET ' . $column . '=?,updated_at=UTC_TIMESTAMP() WHERE user_id=? AND channel_deleted_at IS NULL')->execute([$filename, $userId]);
    $old = (string)($current['old_path'] ?? '');
    if ($old !== '' && basename($old) === $old && preg_match('/^[a-f0-9]{32}\.(jpg|png|webp)$/i', $old)) {
        $pdo->prepare('INSERT IGNORE INTO creator_clicks_media_cleanup(creator_id,filename,status,created_at) VALUES(?,?,"pending",UTC_TIMESTAMP())')->execute([$userId, $old]);
    }
    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    @unlink($folder . DIRECTORY_SEPARATOR . $filename);
    throw $exception;
}
out(['kind'=>$kind,'filename'=>$filename,'media_url'=>'v1/creator-clicks/profile-media?kind=' . $kind . '&user_id=' . $userId], 201);
