<?php
declare(strict_types=1);
require __DIR__ . '/../lib/poll_expiry.php';
$now=new DateTimeImmutable('2026-09-08T12:00:00Z');
function expect_expiry(bool $ok): void { if (!$ok) throw new RuntimeException('Unexpected poll expiry'); }
expect_expiry(poll_expiry(null,$now)==='2026-10-08 12:00:00');
expect_expiry(poll_expiry('',$now)==='2026-10-08 12:00:00');
expect_expiry(poll_expiry('2026-09-09T18:00:00+05:30',$now)==='2026-09-09 12:30:00');
foreach (['2026-09-08T12:00:00Z','2026-02-30T12:00:00Z','2026-09-09','2026-09-09T99:00:00Z',[],false] as $value) {
    try { poll_expiry($value,$now); throw new RuntimeException('Invalid expiry accepted'); }
    catch (InvalidArgumentException $expected) {}
}
echo "Poll expiry validation passed\n";
