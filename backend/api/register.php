<?php
require __DIR__ . '/../lib/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed', 405);
$d = input();
$name = trim((string)($d['name'] ?? ''));
$email = strtolower(trim((string)($d['email'] ?? '')));
$mobile = normalize_mobile_identifier((string)($d['mobile'] ?? ''));
$userId = strtolower(trim((string)($d['user_id'] ?? '')));
$password = (string)($d['password'] ?? '');
$dob = (string)($d['dob'] ?? '');
$gender = (string)($d['gender'] ?? '');
$qualification = trim((string)($d['qualification'] ?? ''));
if ($name === '' || strlen($password) < 8) fail('Name and a password of at least 8 characters are required');
if (!$userId) fail('CloudComAI User ID is required');
if (strlen($qualification) > 190) fail('Qualification is too long');
if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Invalid email');
if ($mobile && !preg_match('/^\+?[0-9]{7,15}$/', $mobile)) fail('Invalid mobile number');
if ($userId && !preg_match('/^[a-z0-9_]{3,30}$/', $userId)) fail('User ID must contain 3-30 letters, numbers or underscores');
if (!in_array($gender, ['Male','Female'], true)) fail('Gender must be Male or Female');
if (age_from_dob($dob) < 18) fail('CloudComAI is available only to users aged 18 or older');
try {
    $pdo = db();

    if ($email) {
        $check = $pdo->prepare('SELECT id FROM users WHERE email=? LIMIT 1');
        $check->execute([$email]);
        if ($check->fetch()) fail('Email address is already registered', 409);
    }

    if ($mobile) {
        $check = $pdo->prepare('SELECT id FROM users WHERE mobile=? LIMIT 1');
        $check->execute([$mobile]);
        if ($check->fetch()) fail('Mobile number is already registered', 409);
    }

    if ($userId) {
        $check = $pdo->prepare('SELECT id FROM users WHERE user_id=? LIMIT 1');
        $check->execute([$userId]);
        if ($check->fetch()) fail('CloudComAI User ID is already registered', 409);
    }

    $pdo->beginTransaction();
    $st = $pdo->prepare('INSERT INTO users (user_id,name,email,mobile,password_hash,dob,gender,qualification,email_verified,mobile_verified,account_status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP())');
    $st->execute([$userId,$name,$email ?: null,$mobile ?: null,password_hash($password,PASSWORD_DEFAULT),$dob,$gender,$qualification ?: null,$email?0:1,$mobile?0:1,'active']);
    $id = (int)$pdo->lastInsertId();
    $pdo->commit();
    out(['token'=>token_for($id),'user'=>['id'=>$id,'name'=>$name,'user_id'=>$userId,'email'=>$email,'mobile'=>$mobile,'gender'=>$gender,'dob'=>$dob,'qualification'=>$qualification]],201);
} catch (PDOException $e) {
    if (db()->inTransaction()) db()->rollBack();
    if ($e->getCode()==='23000') fail('Email, mobile number or User ID is already registered',409);
    fail('Registration failed',500);
}
