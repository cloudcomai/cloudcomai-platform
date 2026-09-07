<?php
require __DIR__ . '/../lib/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed',405);
$d=input(); $identifier=trim((string)($d['identifier']??'')); $mobileIdentifier=normalize_mobile_identifier($identifier); $password=(string)($d['password']??'');
if ($identifier===''||$password==='') fail('Identifier and password are required');
$st=db()->prepare('SELECT u.*, COALESCE(s.session_version,0) AS session_version FROM users u LEFT JOIN user_session_versions s ON s.user_id=u.id WHERE u.email=? OR u.mobile=? OR u.user_id=? LIMIT 1');
$st->execute([strtolower($identifier),$mobileIdentifier,strtolower($identifier)]); $u=$st->fetch();
if(!$u||!password_verify($password,$u['password_hash'])) fail('Invalid credentials',401);
if($u['account_status']!=='active') fail('Account unavailable',403);
out(['token'=>token_for((int)$u['id'], (int)$u['session_version']),'user'=>['id'=>(int)$u['id'],'name'=>$u['name'],'user_id'=>$u['user_id'],'email'=>$u['email'],'mobile'=>$u['mobile'],'gender'=>$u['gender']]]);
