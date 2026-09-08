<?php
declare(strict_types=1);

function age_from_dob(string $dob, ?DateTimeImmutable $today = null): int {
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $dob, $parts)
        || !checkdate((int)$parts[2], (int)$parts[3], (int)$parts[1])) return -1;

    $today = ($today ?? new DateTimeImmutable('today'))->setTime(0, 0);
    $birthDate = DateTimeImmutable::createFromFormat('!Y-m-d', $dob, $today->getTimezone());
    if (!$birthDate || $birthDate > $today) return -1;
    return $birthDate->diff($today)->y;
}
