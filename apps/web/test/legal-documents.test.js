import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLegalArtifacts, renderLegalHtml } from '../../../scripts/generate-legal.mjs';

test('public pages and offline mobile policies match the canonical policy text', async () => {
  await buildLegalArtifacts({ check: true });
});
test('public policy content is escaped and readable without JavaScript or authentication', () => {
  const html = renderLegalHtml('Privacy <test>', 'TITLE\n\n1. Privacy\n\n<script>alert(1)</script>\n\nsupport@cloudcomai.com\n\nhttps://example.com/?x=1&y=2');
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script|<iframe|<form/i);
  assert.match(html, /<h2>1\. Privacy<\/h2>/);
  assert.match(html, /href="mailto:support@cloudcomai.com"/);
  assert.match(html, /href="https:\/\/example.com\/\?x=1&amp;y=2"/);
  assert.match(html, /href="\.\/privacy-policy.html"/);
});
