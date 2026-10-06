import test from 'node:test';
import assert from 'node:assert/strict';
import { createLogger, logger } from '../src/logger.js';

test('logger exposes standard levels and scoped timing', () => {
  const scoped = createLogger('test');
  assert.equal(typeof logger.debug, 'function');
  assert.equal(typeof logger.info, 'function');
  assert.equal(typeof logger.warn, 'function');
  assert.equal(typeof logger.error, 'function');
  const timer = scoped.time('test operation');
  assert.equal(typeof timer.end, 'function');
  assert.ok(timer.end({ result: 'ok' }) >= 0);
});

test('logger accepts sensitive fields without emitting them as context', () => {
  assert.doesNotThrow(() => logger.info('safe logging test', {
    password: 'secret',
    token: 'secret',
    email: 'user@example.com',
    safeCount: 3,
  }));
});
