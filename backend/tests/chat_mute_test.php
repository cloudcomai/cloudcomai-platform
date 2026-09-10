<?php
declare(strict_types=1);
require __DIR__ . '/../lib/chat_mute.php';

$now = new DateTimeImmutable('2026-09-10T12:00:00Z');
if (chat_mute_until('10_hours', $now) !== '2026-09-10 22:00:00') throw new RuntimeException('10-hour mute duration is incorrect');
if (chat_mute_until('1_week', $now) !== '2026-09-17 12:00:00') throw new RuntimeException('1-week mute duration is incorrect');
if (chat_mute_until('2_weeks', $now) !== '2026-09-24 12:00:00') throw new RuntimeException('2-week mute duration is incorrect');
if (chat_mute_until('always', $now) !== null || chat_mute_until('off', $now) !== null) throw new RuntimeException('Always/unmute should not have an expiry');
if (!chat_mute_enabled('always') || chat_mute_enabled('off')) throw new RuntimeException('Mute enabled state is incorrect');
foreach (['10 hours','forever','', '7_days'] as $invalid) {
    try { chat_mute_until($invalid, $now); throw new RuntimeException('Invalid mute choice accepted: ' . $invalid); }
    catch (InvalidArgumentException $expected) {}
}
echo "Chat mute duration tests passed\n";
