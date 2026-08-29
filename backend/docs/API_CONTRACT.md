# Backend API contract

`backend/api-contract.json` is the machine-readable inventory for the PHP API. It records supported HTTP methods and authentication requirements without changing existing endpoint URLs or response behavior.

The shared client maps application operations to these endpoints in `packages/api-client/src/cloudcomai-api.js`.

Run `pnpm verify:api` to confirm:

- every shared client endpoint has a contract entry;
- every contract entry points to a PHP file;
- endpoint constants are unique;
- every endpoint declares methods and an authentication rule.

When a PHP endpoint is added, removed, or renamed, update the contract and shared endpoint map in the same pull request.
