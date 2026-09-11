<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/contact_matching.php';
function expect_contact_match(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }

expect_contact_match(contact_email_key(' Alice@Example.COM ') === 'alice@example.com', 'Email normalization failed');
expect_contact_match(contact_phone_key(' (987) 654-3210 ') === '9876543210', 'Local phone normalization failed');
expect_contact_match(contact_phone_key('+91 98765-43210') === '9876543210', 'Indian international phone normalization failed');

$users = [
 ['id'=>1,'name'=>'Current User','user_id'=>'current','email'=>'current@example.com','mobile'=>null,'account_status'=>'active'],
 ['id'=>2,'name'=>'Kumar','user_id'=>'kumar','email'=>'kumar@example.com','mobile'=>'+91 98765-43210','account_status'=>'active','updated_at'=>gmdate('Y-m-d H:i:s')],
 ['id'=>3,'name'=>'G Kavitha','user_id'=>'kavitha','email'=>'kavitha@example.com','mobile'=>'9000011111','account_status'=>'active','updated_at'=>gmdate('Y-m-d H:i:s',time()-180)],
 ['id'=>4,'name'=>'Naveen Kumar','user_id'=>'naveen','email'=>'naveen@example.com','mobile'=>'9000022222','account_status'=>'active','updated_at'=>gmdate('Y-m-d H:i:s',time()-600)],
 ['id'=>5,'name'=>'Kalyan','user_id'=>'kalyan','email'=>'kalyan@example.com','mobile'=>'9000033333','account_status'=>'active','updated_at'=>gmdate('Y-m-d H:i:s',time()-30)],
 ['id'=>6,'name'=>'Suspended User','user_id'=>'suspended','email'=>'suspended@example.com','mobile'=>null,'account_status'=>'suspended'],
];

$google = [
 ['display_name'=>'Kumar Gmail','email'=>'KUMAR@example.com','phone'=>null,'source'=>'GOOGLE'],
 ['display_name'=>'G Kavitha Gmail','email'=>'kavitha@example.com','phone'=>null,'source'=>'GOOGLE'],
];
$phone = [
 ['display_name'=>'Kumar Phone','email'=>null,'phone'=>'+91 98765-43210','source'=>'PHONE'],
 ['display_name'=>'Naveen Phone','email'=>'naveen@example.com','phone'=>'9000022222','source'=>'PHONE'],
];
$friends = [
 ['id'=>2,'name'=>'Kumar'],
 ['id'=>5,'name'=>'Kalyan'],
];
$merged = merge_contact_sources($google,$phone,$friends,$users,1);
expect_contact_match(count($merged)===4,'Kumar, Kavitha, Naveen and Kalyan should merge into four contacts');
$byId=[]; foreach($merged as $item)$byId[$item['registered_user_id']]=$item;
expect_contact_match(count($byId)===4,'The same account must never appear twice across sources');
expect_contact_match($byId[2]['sources']===['CLOUDCOMAI','GOOGLE','PHONE'],'Kumar sources must be merged');
expect_contact_match($byId[2]['presence_status']==='ONLINE','Kumar should be online');
expect_contact_match($byId[3]['presence_status']==='AWAY','G Kavitha should be away');
expect_contact_match($byId[4]['presence_status']==='OFFLINE','Naveen Kumar should be offline');
expect_contact_match($byId[5]['presence_status']==='ONLINE','Kalyan should be online');
$leadingOnlineIds = array_column(array_slice($merged, 0, 2), 'registered_user_id');
sort($leadingOnlineIds);
expect_contact_match($leadingOnlineIds === [2,5], 'All online users must sort before away/offline contacts');
expect_contact_match($merged[2]['presence_status'] !== 'ONLINE' && $merged[3]['presence_status'] !== 'ONLINE', 'Away/offline contacts must follow online users');

$ambiguous = merge_contact_sources([
 ['display_name'=>'Ambiguous','email'=>'kumar@example.com','phone'=>'9000022222','source'=>'GOOGLE'],
],[],[],$users,1);
expect_contact_match($ambiguous===[],'A contact matching two different accounts must be hidden');

echo "Contact matching tests passed\n";
