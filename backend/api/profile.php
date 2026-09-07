<?php
require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') fail('Method not allowed', 405);

$current = db()->prepare('SELECT dob, gender, email, mobile, qualification FROM users WHERE id=? LIMIT 1');
$current->execute([$user['id']]);
$currentUser = $current->fetch();

$d = input();
$name = trim((string)($d['name'] ?? $user['name']));
$dob = trim((string)($d['dob'] ?? ($currentUser['dob'] ?? '')));
$gender = (string)($d['gender'] ?? ($currentUser['gender'] ?? ''));
$email = strtolower(trim((string)($d['email'] ?? ($currentUser['email'] ?? ''))));
$mobile = normalize_mobile_identifier((string)($d['mobile'] ?? ($currentUser['mobile'] ?? '')));
$qualification = trim((string)($d['qualification'] ?? ($currentUser['qualification'] ?? '')));
if ($name === '') fail('Name is required');
if ($dob === '' || age_from_dob($dob) < 18) fail('User must be at least 18 years old');
if (!in_array($gender, ['Male','Female'], true)) fail('Gender must be Male or Female');
if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Invalid email');
if ($mobile && !preg_match('/^\+?[0-9]{7,15}$/', $mobile)) fail('Invalid mobile number');
if (strlen($qualification) > 190) fail('Qualification is too long');

$pdo = db();
if ($email) {
    $check = $pdo->prepare('SELECT id FROM users WHERE email=? AND id<>? LIMIT 1');
    $check->execute([$email, $user['id']]);
    if ($check->fetch()) fail('Email address is already registered', 409);
}
if ($mobile) {
    $check = $pdo->prepare('SELECT id FROM users WHERE mobile=? AND id<>? LIMIT 1');
    $check->execute([$mobile, $user['id']]);
    if ($check->fetch()) fail('Mobile number is already registered', 409);
}

$st = $pdo->prepare('UPDATE users SET name=?, dob=?, gender=?, email=?, mobile=?, qualification=?, updated_at=UTC_TIMESTAMP() WHERE id=?');
$st->execute([$name, $dob, $gender, $email ?: null, $mobile ?: null, $qualification ?: null, $user['id']]);

out(['user'=>[
    'id'=>(int)$user['id'],
    'name'=>$name,
    'user_id'=>$user['user_id'],
    'email'=>$email,
    'mobile'=>$mobile,
    'gender'=>$gender,
    'dob'=>$dob,
    'age'=>age_from_dob($dob),
    'qualification'=>$qualification
]]);
