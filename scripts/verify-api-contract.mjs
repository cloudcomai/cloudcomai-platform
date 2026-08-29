import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { ApiEndpoint } from '../packages/api-client/src/endpoints.js';

const contract = JSON.parse(
  await readFile(new URL('../backend/api-contract.json', import.meta.url), 'utf8'),
);

assert.equal(contract.contractVersion, '1.0.0');
assert.ok(contract.endpoints && typeof contract.endpoints === 'object');

const clientEndpoints = Object.values(ApiEndpoint);
assert.equal(
  new Set(clientEndpoints).size,
  clientEndpoints.length,
  'Shared API endpoint constants must be unique',
);

for (const endpoint of clientEndpoints) {
  const definition = contract.endpoints[endpoint];
  assert.ok(definition, `Missing API contract entry for ${endpoint}`);
  assert.ok(definition.methods.length > 0, `No HTTP methods declared for ${endpoint}`);
  await access(new URL(`../backend/api/${endpoint}`, import.meta.url));
}

for (const [endpoint, definition] of Object.entries(contract.endpoints)) {
  assert.equal(typeof definition.auth, 'boolean', `Missing auth rule for ${endpoint}`);
  await access(new URL(`../backend/api/${endpoint}`, import.meta.url));
}

console.log(
  `API contract verified: ${Object.keys(contract.endpoints).length} backend endpoints, ${clientEndpoints.length} shared client routes.`,
);
