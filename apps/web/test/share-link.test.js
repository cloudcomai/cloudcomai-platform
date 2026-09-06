import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInvitationUrl, inviteUrlFromResponse } from '../src/utils/shareLink.js';

test('builds an invitation URL from the current host and application path', () => {
  const location = { href: 'https://new-host.example/app/#app' };
  assert.equal(
    buildInvitationUrl('Abc_123', location),
    'https://new-host.example/app/#invite=Abc_123',
  );
});

test('prefers a portable invitation token over a backend-configured URL', () => {
  const location = { href: 'https://new-host.example/messenger/#app' };
  assert.equal(
    inviteUrlFromResponse({
      invite_token: 'portable-token',
      invite_url: 'https://old-host.example/#invite=portable-token',
    }, location),
    'https://new-host.example/messenger/#invite=portable-token',
  );
});
