<?php
declare(strict_types=1);
require __DIR__ . '/../lib/user_validation.php';

$today = new DateTimeImmutable('2026-09-08', new DateTimeZone('UTC'));
foreach (['', '2050-01-01', '1990-02-30', '1900-02-29', '2000-13-01', '2000-00-01', '0000-01-01', '1990-1-01', 'January 1 1990', '1990-01-01 extra', "1990-01-01\0"] as $invalid) {
    if (age_from_dob($invalid, $today) !== -1) throw new RuntimeException('Invalid DOB accepted: ' . json_encode($invalid));
}
foreach (['2008-09-08'=>18, '2008-09-09'=>17, '2000-02-29'=>26, '2026-09-08'=>0] as $dob=>$age) {
    if (age_from_dob($dob, $today) !== $age) throw new RuntimeException('Incorrect age for ' . $dob);
}
echo "Date-of-birth validation tests passed\n";
