<?php
declare(strict_types=1);

$contract=json_decode((string)file_get_contents(__DIR__.'/../api-contract.json'),true,512,JSON_THROW_ON_ERROR);
assert(isset($contract['routes']['v1/hubs']));
assert($contract['routes']['v1/hubs']['handler']==='hubs.php');
assert(in_array('GET',$contract['routes']['v1/hubs']['methods'],true));
assert(in_array('POST',$contract['routes']['v1/hubs']['methods'],true));
assert(in_array('DELETE',$contract['routes']['v1/hubs']['methods'],true));
$handler=(string)file_get_contents(__DIR__.'/../api/hubs.php');
foreach(['hub_post','hub_posts','only_me','contacts','hub_members','react','comment','share','save','follow','friend_request','report','block','join_hub'] as $feature){assert(str_contains($handler,$feature),"Missing Hubs feature: {$feature}");}
assert(str_contains($handler,'stories'));
assert(str_contains($handler,'user_blocks'));
assert(str_contains($handler,'queue_user_notification'));
echo "hubs_test.php passed\n";
