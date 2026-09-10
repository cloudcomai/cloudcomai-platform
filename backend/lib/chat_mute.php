<?php
declare(strict_types=1);

function chat_mute_until(string $choice, ?DateTimeImmutable $now = null): ?string {
    $durations = ['10_hours' => 10 * 3600, '1_week' => 7 * 86400, '2_weeks' => 14 * 86400, 'always' => null, 'off' => 0];
    if (!array_key_exists($choice, $durations)) throw new InvalidArgumentException('Choose 10 hours, 1 week, 2 weeks, Always, or Unmute');
    if ($choice === 'always' || $choice === 'off') return null;
    $now ??= new DateTimeImmutable('now', new DateTimeZone('UTC'));
    return $now->modify('+' . $durations[$choice] . ' seconds')->format('Y-m-d H:i:s');
}

function chat_mute_enabled(string $choice): bool {
    if ($choice === 'off') return false;
    if (!in_array($choice, ['10_hours','1_week','2_weeks','always'], true)) throw new InvalidArgumentException('Choose a valid mute duration');
    return true;
}
