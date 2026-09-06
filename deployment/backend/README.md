# Backend deployment

The PHP deployment sequence is: validate, back up application and database,
deploy, migrate only after backup succeeds, run a health check, and roll back on
failure. Production configuration and secrets must remain protected.

The separate manual GoDaddy workflow, required secrets, database modes and
rollback boundary are documented in
[`../GODADDY_PRODUCTION.md`](../GODADDY_PRODUCTION.md).

## API forwarding adapter

Application clients use language-independent `/api/v1/*` routes. The PHP
implementation routes them through `backend/api/index.php`.

- Apache/GoDaddy uses the isolated `backend/api/.htaccess` adapter.
- Nginx, Caddy, serverless, Java, Node.js, and other platforms should forward
  the same public paths to their application entrypoint.

Only this forwarding adapter is hosting-specific. The API contract, clients,
routes, and response shapes remain unchanged when the backend language or
hosting provider changes.
