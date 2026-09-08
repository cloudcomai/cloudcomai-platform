<?php
declare(strict_types=1);

function poll_expiry(mixed $value, ?DateTimeImmutable $now = null): string {
    $now ??= new DateTimeImmutable('now', new DateTimeZone('UTC'));
    if ($value === null || $value === '') return $now->modify('+30 days')->format('Y-m-d H:i:s');
    if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/D', $value)) {
        throw new InvalidArgumentException('Choose a valid expiry date');
    }
    try { $expiry = new DateTimeImmutable($value); }
    catch (Throwable $error) { throw new InvalidArgumentException('Choose a valid expiry date'); }
    $errors = DateTimeImmutable::getLastErrors();
    if (($errors && ($errors['warning_count'] || $errors['error_count'])) || $expiry <= $now) {
        throw new InvalidArgumentException('Poll expiry must be a valid future date');
    }
    return $expiry->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
}
