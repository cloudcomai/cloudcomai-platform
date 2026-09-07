import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordResetLink, privatePasswordResetUrl, isPasswordResetToken } from '../src/utils/passwordRecovery.js';

const token = 'Ab_-0123456789'.padEnd(43, 'x');

test('opens new fragment and legacy query reset links on root and subdirectory deployments', () => {
  for (const path of ['/', '/app/']) {
    for (const link of ['#reset_token=' + token, '?reset_token=' + token + '#login']) {
      const href = 'https://example.test' + path + link;
      assert.deepEqual(passwordResetLink(href), { present: true, token });
      assert.equal(isPasswordResetToken(passwordResetLink(href).token), true);
    }
  }
});

test('removes legacy query tokens while preserving the web subdirectory and unrelated parameters', () => {
  const href = 'https://example.test/app/?campaign=mail&reset_token=' + token + '#login';
  const privateUrl = privatePasswordResetUrl(href);
  assert.equal(privateUrl, '/app/?campaign=mail#reset_token=' + token);
  assert.deepEqual(passwordResetLink('https://example.test' + privateUrl), { present: true, token });
});

test('blank or malformed reset links open recovery instead of silently showing sign-in', () => {
  for (const link of ['?reset_token=', '#reset_token=', '#reset', '#reset_token=bad%20token']) {
    const recovery = passwordResetLink('https://example.test/app/' + link);
    assert.equal(recovery.present, true);
    assert.equal(isPasswordResetToken(recovery.token), false);
  }
  for (const link of ['#login', '#register', '#forgot', '#app', '#invite=abc']) {
    assert.deepEqual(passwordResetLink('https://example.test/' + link), { present: false, token: '' });
  }
});
