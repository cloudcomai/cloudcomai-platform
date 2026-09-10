<?php
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';

$user=auth_user();
if($_SERVER['REQUEST_METHOD']!=='POST')fail('Method not allowed',405);
$postId=(int)($_POST['post_id']??0);$file=$_FILES['media']??null;
if($postId<=0||!$file||($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK)fail('Media upload failed',422);
$st=db()->prepare('SELECT id,user_id FROM stories WHERE id=? AND type="hub_post" AND deleted_at IS NULL LIMIT 1');$st->execute([$postId]);$post=$st->fetch();if(!$post)fail('Post not found',404);if((int)$post['user_id']!==(int)$user['id'])fail('You can only update your own post media',403);
if((int)$file['size']>10*1024*1024)fail('Hubs media must be 10 MB or smaller',422);
$mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);$exts=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','video/mp4'=>'mp4','video/quicktime'=>'mov','video/webm'=>'webm'];if(!isset($exts[$mime]))fail('Only JPG, PNG, WebP, MP4, MOV and WebM are supported',422);
$folder=dirname(__DIR__).'/uploads/hubs';if(!is_dir($folder)&&!mkdir($folder,0755,true)&&!is_dir($folder))fail('Unable to prepare media storage',500);foreach(glob($folder.'/'.$postId.'.*')?:[] as $old)if(is_file($old))@unlink($old);
$filename=$postId.'.'.$exts[$mime];if(!move_uploaded_file($file['tmp_name'],$folder.'/'.$filename))fail('Unable to save media',500);
$data=json_decode((string)$post['content'],true)?:[];$baseUrl=rtrim((string)($config['app']['base_url']??''),'/');$data['media_url']=$baseUrl.'/media.php?type=hub&id='.$postId;$data['media_type']=str_starts_with($mime,'video/')?'video':'image';
$up=db()->prepare('UPDATE stories SET content=? WHERE id=?');$up->execute([json_encode($data,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),$postId]);out(['media_url'=>$data['media_url'],'media_type'=>$data['media_type']]);
