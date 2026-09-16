<?php
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed', 405);
$user = auth_user();
$file = $_FILES['file'] ?? null;
if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) fail('Media upload failed', 422);
if ((int)$file['size'] <= 0 || (int)$file['size'] > 50 * 1024 * 1024) fail('Ring Bell media must be 50 MB or smaller', 422);
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($file['tmp_name']);
$extensions = ['image/jpeg'=>['jpg','photo'],'image/png'=>['png','photo'],'image/webp'=>['webp','photo'],'video/mp4'=>['mp4','video'],'video/quicktime'=>['mov','video'],'video/webm'=>['webm','video']];
if (!isset($extensions[$mime])) fail('Ring Bells supports JPG, PNG, WebP, MP4, MOV and WebM files', 422);
[$extension,$kind] = $extensions[$mime];
$folder = dirname(__DIR__) . '/uploads/stories/' . (int)$user['id'];
if (!is_dir($folder) && !mkdir($folder,0755,true) && !is_dir($folder)) fail('Unable to prepare Ring Bells media storage',500);
$filename = bin2hex(random_bytes(16)) . '.' . $extension;
if (!move_uploaded_file($file['tmp_name'],$folder.'/'.$filename)) fail('Unable to save Ring Bells media',500);
out(['type'=>$kind,'mime_type'=>$mime,'filename'=>$filename],201);
