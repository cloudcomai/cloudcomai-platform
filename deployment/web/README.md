# Web deployment

The web application builds to static files in `apps/web/dist`. Production
deployment uploads only the validated build output and does not require a
Node.js production runtime.

The manual GoDaddy production workflow supports either the domain root or an
`/app/` base path through repository variables. Setup and verification are
documented in [`../GODADDY_PRODUCTION.md`](../GODADDY_PRODUCTION.md).
