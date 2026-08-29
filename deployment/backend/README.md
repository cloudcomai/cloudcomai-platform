# Backend deployment

The PHP deployment sequence is: validate, back up application and database, deploy, migrate only after backup succeeds, run a health check, and roll back on failure. Production configuration and secrets must remain protected.

Production deployment is not enabled in the foundation milestone.

