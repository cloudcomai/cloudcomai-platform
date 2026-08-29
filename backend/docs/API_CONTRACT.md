# Backend API contract

`backend/api-contract.json` is the language-independent API contract. Public routes use versioned paths such as `v1/auth/login` and never expose PHP filenames. Each route currently maps to a legacy PHP handler behind the front controller.

The shared client maps application operations to these endpoints in `packages/api-client/src/cloudcomai-api.js`.

The PHP front controller is `backend/api/index.php`, and its code-level router is `backend/lib/api_router.php`. Existing direct `.php` URLs remain available temporarily for compatibility, but new web and mobile work must use only the versioned routes.

Run `pnpm verify:api` to confirm:

- every shared client route has a contract entry;
- no public route contains `.php`;
- every handler referenced by the router exists;
- endpoint constants are unique;
- every endpoint declares methods and an authentication rule.

When the backend language changes, implement the same `v1` route and response contract in the new backend. The shared clients do not change unless the API contract itself changes.
