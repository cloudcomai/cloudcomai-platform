import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { ApiRoute } from '../packages/api-client/src/endpoints.js';

const contract = JSON.parse(
  await readFile(new URL('../backend/api-contract.json', import.meta.url), 'utf8'),
);

assert.equal(contract.contractVersion, '1.2.0');
assert.ok(contract.routes && typeof contract.routes === 'object');

const clientEndpoints = Object.values(ApiRoute);
assert.equal(
  new Set(clientEndpoints).size,
  clientEndpoints.length,
  'Shared API endpoint constants must be unique',
);

for (const endpoint of clientEndpoints) {
  const definition = contract.routes[endpoint];
  assert.ok(definition, `Missing API contract entry for ${endpoint}`);
  assert.ok(definition.methods.length > 0, `No HTTP methods declared for ${endpoint}`);
  await access(new URL(`../backend/api/${definition.handler}`, import.meta.url));
}

for (const [endpoint, definition] of Object.entries(contract.routes)) {
  assert.equal(typeof definition.auth, 'boolean', `Missing auth rule for ${endpoint}`);
  assert.equal(endpoint.includes('.php'), false, `Route exposes PHP: ${endpoint}`);
  await access(new URL(`../backend/api/${definition.handler}`, import.meta.url));
}

console.log(
  `API contract verified: ${Object.keys(contract.routes).length} language-independent routes, ${clientEndpoints.length} shared client routes.`,
);
